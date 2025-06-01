/**
 * @fileoverview Controller de autenticação e autorização de utilizadores.
 * Gere login/logout, criação de contas e verificação de permissões via JWT (JSON Web Token).
 */

const mongoose = require('mongoose');
const { Client, Staff } = require('../../models/Users');
const { Restaurant } = require('../../models/Restaurants');
const jwt = require('jsonwebtoken');
const config = require('../../jwt_secret/config');
const bcrypt = require('bcryptjs');
const validatePhoneNumber = require('../ExternalAPI/validatePhone');
const geoAddress = require('../ExternalAPI/geoAddress');

/**
 * Renderiza o formulário de login.
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.login = function(req, res) {
  res.render('login/index', { layout: 'layout/authLayout' });
};

/**
 * Processa credenciais do utilizador e gera JWT.
 *
 * @async
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.submittedLogin = async function(req, res, next) {
  const { email: emailInput, password: passwordInput } = req.body;

  try {
    const user = await findUserByEmail(emailInput);

    if (!user) {
      return res.render('login/index', { error: 'Email não registado!', layout: 'layout/authLayout' });
    }
    const isPasswordCorrect = await bcrypt.compare(passwordInput, user.password);

    if (!isPasswordCorrect) {
      return res.render('login/index', { error: 'Password incorreta!', layout: 'layout/authLayout' });
    }
    const authToken = jwt.sign(
      { 
        email: user.email, 
        role: user.role
      },
      config.secret,
      { expiresIn: 86400 }
    );
    res.cookie('auth-token', authToken, { maxAge: 86400 * 1000 });
    return handleRedirect(user, res);
  } catch (err) {
    next(err);
  }
};

/**
 * Logout: remove JWT do cookie.
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.logout = function(req, res) {
  res.clearCookie('auth-token');
  res.redirect('/');
};

/**
 * Renderiza formulário de registo de utilizador.
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.createLogin = function(req, res) {
  res.render('login/createUser', { data: {}, layout: 'layout/authLayout' });
};

/**
 * Processa criação de utilizador (Client ou Staff).
 *
 * @async
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.createLoginSubmitted = async function(req, res, next) {
  const role = req.body.role || 'Client';
  req.body.password = bcrypt.hashSync(req.body.password, 8);

  try {
    const Model = role === 'Client' ? Client : Staff;
    const existingUser = await Model.findOne({ email: req.body.email });

    if (existingUser) {
      return res.render('login/createUser', { error: 'Email já registado!', data: req.body, layout: 'layout/authLayout' });
    }

    if (role === 'Client') {
      const isContactValid = await validatePhoneNumber.validatePhoneNumber(req.body.contact);

      if (!isContactValid) {
        return res.status(400).render('login/createUser', { error: 'Número de telefone inválido.', data: req.body, layout: 'layout/authLayout' });
      }

      const billing = req.body.address;
      const billingCoords = await geoAddress.geocodeAddress(billing.street, billing.postalCode, billing.city, billing.country);
      let delivery = billing;
      let deliveryCoords = billingCoords;

      if (req.body.isDeliverySame !== 'on') {
        delivery = req.body.deliveryAddress;
        deliveryCoords = await geoAddress.geocodeAddress(delivery.street, delivery.postalCode, delivery.city, delivery.country);
      }
      if (!billingCoords || !deliveryCoords) {
        return res.status(400).render('login/createUser', { error: 'Erro na geocodificação.', data: req.body, layout: 'layout/authLayout' });
      }
      await Client.create({
        ...req.body,
        role: 'Client',
        location: { address: billing, coordinates: billingCoords },
        deliveryLocation: { address: delivery, coordinates: deliveryCoords }
      });
      return res.redirect('/');
    }

    if (role === 'RestAdmin') {
      await Staff.create(req.body);
      return res.redirect('/');
    }
    return res.status(400).send('Invalid User');
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: verifica JWT e adiciona req.user.
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.verifyLoginUser = function(req, res, next) {
  const token = req.cookies['auth-token'];
  if (!token) return res.redirect('/login');
  jwt.verify(token, config.secret, async (err, decoded) => {
    if (err) return res.redirect('/login');
    req.user = await findUserByEmail(decoded.email);
    next();
  });
};

/**
 * Middleware: verifica se é um RestAdmin.
 */
exports.verifyLoginRestAdmin = async function(req, res, next) {
  const token = req.cookies['auth-token'];

  if (!token) return res.redirect('/');
  try {
    const decoded = jwt.verify(token, config.secret);
    if (decoded.role !== 'RestAdmin') return res.status(403).send('Acesso não autorizado.');

    const user = await Staff.findOne({ email: decoded.email });
    if (!user) return res.status(404).send('User not found');

    if (user.restID) res.locals.restId = user.restID.toString();

    req.userRole = 'RestAdmin';
    next();
  } catch {
    res.redirect('/');
  }
};

/**
 * Middleware: verifica se é um RestWorker.
 */
exports.verifyLoginRestWorker = async function(req, res, next) {
  const token = req.cookies['auth-token'];

  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, config.secret);
    if (decoded.role !== 'RestWorker') return res.status(403).send('Acesso não autorizado.');

    const user = await Staff.findOne({ email: decoded.email });
    if (!user || !user.restID) return res.status(404).send('Funcionário não encontrado.');

    res.locals.restId = user.restID.toString();
    req.userRole = 'RestWorker';
    next();
  } catch {
    res.redirect('/login');
  }
};

/**
 * Middleware: verifica se é um RestWorker ou RestAdmin.
 */
exports.verifyLoginRestStaff = async function(req, res, next) {
  const token = req.cookies['auth-token'];
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, config.secret);

    if (decoded.role !== 'RestWorker' && decoded.role !== 'RestAdmin') return res.status(403).send('Acesso não autorizado.');

    const user = await Staff.findOne({ email: decoded.email });
    if (!user || !user.restID) return res.status(404).send('Funcionário não encontrado.');

    res.locals.restId = user.restID.toString();
    req.userRole = decoded.role;
    next();
  } catch {
    res.redirect('/login');
  }
};

/**
 * Middleware: verifica se é Administrador Geral (Admin).
 */
exports.verifyLoginAdmin = function(req, res, next) {
  const token = req.cookies['auth-token'];
  if (!token) return res.redirect('/login');

  jwt.verify(token, config.secret, (err, decoded) => {
    if (err || decoded.role !== 'Admin') return res.redirect('/login');

    req.user = Staff.findOne({ email: decoded.email });
    next();
  });
};

/**
 * Middleware: verifica Client.
 */
exports.verifyLoginClient = function(req, res, next) {
  const token = req.cookies['auth-token'];

  if (!token) return res.redirect('/login');

  jwt.verify(token, config.secret, (err, decoded) => {
    if (err || decoded.role !== 'Client') return res.redirect('/login');

    req.userRole = 'Client';
    req.userEmail = decoded.email;
    next();
  });
};

/**
 * Redireciona após login com base no "role" e estado de aprovação do restaurante.
 */
async function handleRedirect(user, res) {
  switch (user.role) {
    case 'Client':
      return res.redirect('/');
    case 'RestWorker':
      return res.redirect('/restWorker');
    case 'Admin':
      return res.redirect('/admin/dashboard');
    case 'RestAdmin':
      if (!user.restID) return res.redirect('/restAdmin/homePage');

      const restaurant = await Restaurant.findById(user.restID);
      if (!restaurant) return res.redirect('/restAdmin/homePage');

      return restaurant.approvedByAdmin
        ? res.redirect('/restAdmin')
        : res.redirect('/restAdmin/homePage');
    default:
      return res.status(400).render('login/index', { message: 'Unknown role', layout: 'layout/authLayout' });
  }
}

/**
 * Encontra utilizador em Client ou Staff pelo email.
 */
async function findUserByEmail(email) {
  let user = await Client.findOne({ email });

  if (!user) user = await Staff.findOne({ email });
  
  return user;
}
