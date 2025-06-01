/**
 * @fileoverview Rotas para a interface de RestWorker (funcionário de restaurante).
 * Inclui endpoint para a homepage do funcionário, protegido por middleware JWT.
 */

const express = require('express');
const router = express.Router();

// Controladores importados
const auth = require('../controllers/Users/auth');
const employeeController = require('../controllers/Users/restWorker');
const userController = require('../controllers/Users/userController');

/**
 * GET /
 * Exibe a homepage do funcionário (RestWorker) e mostra encomendas recentes.
 * Middleware: verifyLoginRestWorker garante token JWT válido e role adequada.
 */
router.get(
  '/',
  auth.verifyLoginRestWorker,
  employeeController.getHomePage
);

module.exports = router;
