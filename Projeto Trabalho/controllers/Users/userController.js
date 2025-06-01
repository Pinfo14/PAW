/**
 * @fileoverview Controller para alteração de password de utilizadores.
 * Dá suporte aos "roles": Client, RestAdmin, Admin e RestWorker.
 * Utiliza bcryptjs para comparação e hash de passwords.
 */

const mongoose = require('mongoose');
const { Client, Staff } = require('../../models/Users');
const bcrypt = require('bcryptjs');

/**
 * Renderiza o formulário de alteração de password.
 *
 * @param {Express.Request} req  - Objeto de requisição Express.
 * @param {Express.Response} res - Objeto de resposta Express.
 */
exports.changePassword = function(req, res) {
  res.render('changePassword', {
    error: null,
    success: null,
    layout: 'layout/authLayout'
  });
};

/**
 * Processa a submissão de alteração de password.
 * 1. Verifica a password atual.
 * 2. Valida confirmação da nova password.
 * 3. Atualiza e encripta a nova password.
 * 4. Redireciona para a homepage/index específica do role.
 *
 * @async
 * @param {Express.Request} req  - Deve conter req.user com role e email.
 * @param {Express.Response} res
 */
exports.changePasswordSubmitted = async function(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const role = req.user.role;
  const email = req.user.email;

  // Carrega o utilizador conforme o seu "role"
  let user;
  if (role === 'Client') {
    user = await Client.findOne({ email });
  } else if (['RestAdmin', 'Admin', 'RestWorker'].includes(role)) {
    user = await Staff.findOne({ email });
  } else {
    return res.status(403).render('error', {
      message: 'Tipo de utilizador não suportado.',
      error: { status: 403, stack: '' },
      layout: 'layout/authLayout'
    });
  }

  // Verifica se a password atual está correta
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.render('changePassword', {
      error: 'Password atual incorreta.',
      success: null,
      layout: 'layout/authLayout'
    });
  }

  // Garante que a nova password e a confirmação coincidem
  if (newPassword !== confirmPassword) {
    return res.render('changePassword', {
      error: 'Passwords novas devem ser iguais.',
      success: null,
      layout: 'layout/authLayout'
    });
  }

  // Hash da nova password e atualização no documento
  const hashed = await bcrypt.hash(newPassword, 10);
  user.password = hashed;
  await user.save();

  // Mapa de redirecionamento por role
  const redirectMap = {
    Client:    '/',
    RestAdmin: '/restAdmin',
    Admin:     '/admin/dashboard',
    RestWorker:'/restWorker'
  };
  const destination = redirectMap[role] || '/';
  return res.redirect(destination);
};
