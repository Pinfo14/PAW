/**
 * @fileoverview Controller para gestão de restaurantes na interface de Admin Geral.
 * Inclui listagem, detalhes, aprovação, rejeição com email, remoção e lógica de persistência de dados.
 */

const mongoose = require('mongoose');
const { Restaurant } = require('../../models/Restaurants');
const RestaurantsCategory = require('../../models/RestaurantsCategory');
const { Staff } = require('../../models/Users');
const nodemailer = require('nodemailer');
const Order = require('../../models/Orders');

// Schema para armazenar restaurantes removidos, mantendo documentos flexíveis
const RemovedSchema = new mongoose.Schema({}, { strict: false, collection: 'removed_restaurants' });
const RestaurantsRemoved = mongoose.model('RestaurantsRemoved', RemovedSchema);

/**
 * Exibe o dashboard do restaurante para RestAdmin.
 * Constrói menu e extrái menus ativos.
 *
 * @async
 * @function getRestaurant
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.getRestaurant = async function(req, res, next) {
  try {
    const restActualId = res.locals.restId;
    const restaurant = await Restaurant.findById(restActualId)
      .populate('menu.meals')
      .exec();
    if (!restaurant) return res.status(404).send('Restaurante não encontrado');

    const activeMenus = restaurant.menu.filter(m => m.isActive);
    const userName = (req.user && req.user.name) || req.userName;

    res.render('restAdmin/resAdm', { restActualId, restName: restaurant.name, activeMenus, userName });
  } catch (err) {
    next(err);
  }
};

/**
 * Lista restaurantes na dashboard do Admin Geral.
 * Suporta filtros por cidade e categoria.
 *
 * @async
 * @function listRestaurantsAdmin
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.listRestaurantsAdmin = async function(req, res) {
  try {
    const filter = {};
    if (req.query.city?.trim()) {
      filter['location.address.city'] = new RegExp(req.query.city.trim(), 'i');
    }
    if (req.query.category?.trim()) {
      filter.categories = { $in: [req.query.category] };
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const count = await Restaurant.countDocuments(filter);
    const totalPages = Math.ceil(count / limit);

    const restaurants = await Restaurant.find(filter)
      .populate('categories')
      .skip(skip)
      .limit(limit);
    const categories = await RestaurantsCategory.find({});

    res.render('adminGeral/restaurantsList', {
      restaurants,
      categories,
      error: null,
      message: req.query.message || null,
      queryCity: req.query.city || '',
      queryCategory: req.query.category || '',
      currentPage: page,
      totalPages,
      layout: 'layout/adminGeralLayout'
    });
  } catch (err) {
    console.error('Erro ao carregar restaurantes:', err);
    res.render('adminGeral/restaurantsList', {
      restaurants: [],
      categories: [],
      error: 'Erro ao carregar restaurantes.',
      message: null,
      queryCity: '',
      queryCategory: '',
      currentPage: 1,
      totalPages: 1,
      layout: 'layout/adminGeralLayout'
    });
  }
};

/**
 * Exibe detalhes completos de um restaurante na admin Geral.
 * Renderiza formulário para ativar/desativar aprovação.
 *
 * @function getRestaurantDetailsAdmin
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.getRestaurantDetailsAdmin = function(req, res) {
  const restaurantId = req.params.id;
  Restaurant.findById(restaurantId)
    .then(restaurant => {
      if (!restaurant) return res.redirect('/admin/dashboard/restaurants');
      res.render('adminGeral/restaurantDetails', { restaurant, layout: 'layout/adminGeralLayout' });
    })
    .catch(err => {
      console.error('Erro ao buscar detalhes:', err);
      res.redirect('/admin/dashboard/restaurants');
    });
};

/**
 * Altera a aprovação do restaurante e sincroniza aprovação das categorias relacionadas.
 *
 * @function toggleApproval
 */
exports.toggleApproval = function(req, res) {
  const restaurantId = req.params.id;
  const action = req.body.action; // 'activate' ou 'deactivate'

  const approved = action === 'activate';
  Restaurant.findByIdAndUpdate(
    restaurantId,
    { approvedByAdmin: approved },
    { new: true, runValidators: false }
  )
    .then(async updated => {
      if (!updated) return res.redirect('/admin/restaurants');
      if (Array.isArray(updated.categories) && updated.categories.length) {
        await RestaurantsCategory.updateMany(
          { _id: { $in: updated.categories } },
          { $set: { approved } }
        );
      }
      res.redirect('/admin/restaurants?message=Estado alterado com sucesso');
    })
    .catch(err => {
      console.error('Erro ao alterar aprovação:', err);
      res.redirect('/admin/restaurants?error=Erro ao alterar estado');
    });
};

/**
 * Rejeita pedido de registo de restaurante: envia email ao RestAdmin e apaga o documento.
 * O Email está "hardcoded", pois os emails dos funcionários e administradores são fictícios,
 * no entanto este método funciona para o email predefinido, e funcionaria para emails reais (carece de configurações extra).
 *
 * @async
 * @function rejectRestaurant
 */
exports.rejectRestaurant = async function(req, res) {
  const restaurantId = req.params.id;
  const reason = req.body.reason;
  try {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.redirect('/admin/restaurants');

    const adminRest = await Staff.findOne({ role: 'RestAdmin', restID: restaurantId });
    if (!adminRest) {
      console.error('AdminRest não encontrado para:', restaurantId);
      return res.redirect('/admin/restaurants?error=Nenhum admin associado');
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: 'paw.trabalho@gmail.com', pass: 'lxzi zopu xvzo hogi' }
    });

    const mailOptions = {
      from: '"Admin Geral" <paw.trabalho@gmail.com>',
      to: adminRest.email,
      subject: 'Pedido de Registo Rejeitado',
      text: `O seu pedido foi rejeitado. Motivo: ${reason}`
    };

    await transporter.sendMail(mailOptions);
    await Restaurant.findByIdAndDelete(restaurantId);
    res.redirect('/admin/restaurants?message=Pedido rejeitado e remoção concluída');
  } catch (err) {
    console.error('Erro ao rejeitar restaurante:', err);
    res.redirect('/admin/restaurants?error=Erro ao rejeitar pedido');
  }
};

/**
 * Remove restaurante ativo, armazena histórico na coleção 'removed_restaurants'.
 *
 * @async
 * @function removeRestaurant
 */
exports.removeRestaurant = async function(req, res) {
  const restaurantId = req.params.id;
  try {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.redirect('/admin/restaurants?error=Restaurante não encontrado');

    const orders = await Order.find({ restID: restaurantId });
    const historico = orders.length > 0 ? orders.map(o => o._id) : null;

    const data = restaurant.toObject();
    if (historico) data.historicoDeEncomendas = historico;

    await RestaurantsRemoved.create(data);
    await Restaurant.deleteOne({ _id: restaurantId });

    res.redirect('/admin/restaurants?message=Restaurante removido com sucesso');
  } catch (err) {
    console.error('Erro ao remover restaurante:', err);
    res.redirect('/admin/restaurants?error=Erro ao remover restaurante');
  }
};
