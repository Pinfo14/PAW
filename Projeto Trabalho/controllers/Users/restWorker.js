/**
 * @fileoverview Controller para a homepage do funcionário (RestWorker).
 * Exibe as 5 encomendas mais recentes e informação do restaurante.
 */

const mongoose = require('mongoose');
const Order = require('../../models/Orders');
const { Restaurant } = require('../../models/Restaurants');

/**
 * Renderiza a dashboard inicial do funcionário, mostrando o nome do restaurante,
 * nome do utilizador e cinco encomendas mais recentes.
 *
 * @async
 * @param {Express.Request} req - Objeto de requisição Express contendo restId em res.locals.
 * @param {Express.Response} res - Objeto de resposta Express.
 * @param {Function} next - Callback para o próximo middleware de erro.
 */
exports.getHomePage = async function(req, res, next) {
  try {
    const restActualId = res.locals.restId;
    // Busca documento do restaurante pelo ID atribuído
    const restaurant = await Restaurant.findById(restActualId);
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    // Pesquisa as 5 encomendas mais recentes para este restaurante
    const recentOrders = await Order.find({ restID: restActualId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('customerId', 'name'); // preenche apenas o campo "name" do cliente

    // Nome do utilizador que fez o login
    const userName = (req.user && req.user.name) || req.userName;

    // Renderiza a view com layout específico de RestWorker
    res.render('employee/employeeHomePage', {
      restActualId,
      restName: restaurant.name,
      userName,
      orders: recentOrders,
      layout: 'layout/restWorkerLayout'
    });
  } catch (err) {
    // Transfere erro para o middleware de tratamento
    next(err);
  }
};