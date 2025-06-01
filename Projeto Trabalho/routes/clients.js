/**
 * @fileoverview Rotas para registo de clientes no fluxo de encomenda.
 * Utilizado pelo REST endpoint de encomendas para criar novos clientes.
 */

const express = require('express');
const router = express.Router();

// Controlador que lida com a lógica de criação de clientes
const clientsController = require('../controllers/Users/clients');
// Middleware de autenticação para garantir que apenas utilizadores autorizados podem registar clientes, se necessário
const authController = require('../controllers/Users/auth');

/**
 * POST /register
 * Regista um novo cliente para uso em pedidos de encomenda.
 * Valida dados de NIF, email, códigos postais e geocodifica endereços.
 * Redireciona de volta ao formulário de encomenda com parâmetros de sucesso ou erro.
 */
router.post(
  '/register',
  // Pode adicionar authController.verifyLoginUser se for necessário apenas para utilizadores autenticados
  clientsController.registerClient
);

module.exports = router;
