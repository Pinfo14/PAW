/**
 * @fileoverview Rotas de autenticação e gestão de conta de utilizador.
 * Inclui endpoints para login, logout, registo e alteração de password.
 */

const express = require('express');
const router = express.Router();

// Controladores importados
const authController = require('../controllers/Users/auth');
const userController = require('../controllers/Users/userController');

/**
 * GET /
 * Exibe o formulário de login.
 */
router.get('/', authController.login);

/**
 * POST /loginSubmitted
 * Processa dados de login e gera token JWT(JSON Web Token), redirecionando conforme o "role".
 */
router.post('/loginSubmitted', authController.submittedLogin);

/**
 * GET /logout
 * Termina sessão do utilizador limpando o cookie com JWT.
 */
router.get('/logout', authController.logout);

/**
 * GET /register
 * Exibe o formulário de registo de um novo utilizador.
 */
router.get('/register', authController.createLogin);

/**
 * POST /registerSubmitted
 * Processa registo de novo utilizador (Client ou Staff), incluindo validações.
 */
router.post('/registerSubmitted', authController.createLoginSubmitted);

/**
 * GET /changePassword
 * Exibe o formulário de alteração de password para utilizadores autenticados.
 * Middleware: verifyLoginUser garante token válido.
 */
router.get(
  '/changePassword',
  authController.verifyLoginUser,
  userController.changePassword
);

/**
 * POST /changePassword
 * Submete as novas credenciais de password e redireciona conforme o "role".
 * Middleware: verifyLoginUser garante token válido.
 */
router.post(
  '/changePassword',
  authController.verifyLoginUser,
  userController.changePasswordSubmitted
);

module.exports = router;
