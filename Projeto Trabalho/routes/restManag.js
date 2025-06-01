/**
 * @fileoverview Rotas de RestAdmin para gestão de pratos, menus, encomendas e funcionários.
 * Protegidas por middleware de autenticação e autorização via JWT.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Controladores importados
const auth = require('../controllers/Users/auth');
const clientsController = require('../controllers/Users/clients');
const mealsController = require('../controllers/Restaurant/meals');
const menusController = require('../controllers/Restaurant/menus');
const ordersController = require('../controllers/Restaurant/orders');
const employeesController = require('../controllers/Restaurant/employees');
const mealsCatController = require('../controllers/Restaurant/mealsCategory');

// Configuração do Multer para upload de imagens de pratos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

/**
 * ROTAS DE PRATOS (Meals)
 */
// GET /meals/addMeal - Formulário para adicionar novo prato
router.get(
  '/meals/addMeal',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  mealsController.getAddMealForm
);

// POST /meals/addMeal - Processa a criação de um prato (inclui upload de imagens)
router.post(
  '/meals/addMeal',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  upload.any(),
  mealsController.postAddMeal
);

// GET /meals - Lista todos os pratos do restaurante
router.get(
  '/meals',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  mealsController.getMeals
);

// GET /meals/mealDetail/:id - Detalhes de um prato específico
router.get(
  '/meals/mealDetail/:id',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  mealsController.getMealDetail
);

// GET /meals/edit/:id - Formulário de edição de prato
router.get(
  '/meals/edit/:id',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  mealsController.editMealForm
);

// POST /meals/edit/:id - Atualiza um prato existente (upload de novas imagens opcional)
router.post(
  '/meals/edit/:id',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  upload.array('image'),
  mealsController.updateMeal
);

// POST /meals/delete/:id - Remove um prato do restaurante
router.post(
  '/meals/delete/:id',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  mealsController.deleteMeal
);

// Rotas para criar nova categoria de pratos via interface REST
router.get(
  '/newCatgory',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  mealsCatController.getMealCatg
);
router.post(
  '/newCatgory',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  mealsCatController.postMealCatg
);

/**
 * ROTAS DE MENUS
 */
// GET /menu/new - Formulário para criação de um menu novo
router.get(
  '/menu/new',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  menusController.getNewMenuForm
);

// POST /menu/new - Cria um novo menu com seleção de pratos
router.post(
  '/menu/new',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  menusController.postNewMenu
);

// GET /menu - Lista todos os menus do restaurante
router.get(
  '/menu',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  menusController.getMenus
);

// GET /menu/:id/status - Altera estado ativo/inativo de um menu
router.get(
  '/menu/:id/status',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  menusController.toggleMenuStatus
);

// GET /menu/:id - Exibe detalhes de um menu específico
router.get(
  '/menu/:id',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  menusController.getMenuDetail
);

// GET /menu/:id/edit - Formulário de edição de menu
router.get(
  '/menu/:id/edit',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  menusController.getEditMenuForm
);

// POST /menu/:id/edit - Atualiza um menu existente
router.post(
  '/menu/:id/edit',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  menusController.postEditMenu
);

// POST /menu/:id/delete - Remove um menu
router.post(
  '/menu/:id/delete',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  menusController.deleteMenu
);

/**
 * ROTAS DE ENCOMENDAS (Orders)
 */
// GET /orders - Lista de encomendas do restaurante
router.get(
  '/orders',
  auth.verifyLoginUser,
  auth.verifyLoginRestStaff,
  ordersController.getOrders
);

// GET /orders/new - Formulário para criar nova encomenda
router.get(
  '/orders/new',
  auth.verifyLoginUser,
  auth.verifyLoginRestStaff,
  ordersController.getAddOrderForm
);

// POST /orders/new - Cria uma nova encomenda
router.post(
  '/orders/new',
  auth.verifyLoginUser,
  auth.verifyLoginRestStaff,
  ordersController.postAddOrder
);

// POST /orders/:id/status - Atualiza estado de uma encomenda
router.post(
  '/orders/:id/status',
  auth.verifyLoginUser,
  auth.verifyLoginRestStaff,
  ordersController.updateOrderStatus
);

// POST /orders/:id/cancel - Cancela uma encomenda
router.post(
  '/orders/:id/cancel',
  auth.verifyLoginUser,
  auth.verifyLoginRestStaff,
  ordersController.cancelOrder
);

// POST /prep-time - Atualiza tempo médio de preparação (definido pelos funcionários e gerente do restaurante consoante necessário)
router.post(
  '/prep-time',
  auth.verifyLoginUser,
  auth.verifyLoginRestStaff,
  ordersController.setPreparationTime
);

/**
 * ROTAS DE FUNCIONÁRIOS (Employees)
 */
// GET /employees - Lista todos os funcionários do restaurante
router.get(
  '/employees',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  employeesController.getEmployees
);

// GET /employees/new - Formulário de adição de funcionário
router.get(
  '/employees/new',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  employeesController.getEmployeesForm
);

// POST /employees/new - Cria um novo funcionário
router.post(
  '/employees/new',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  employeesController.createEmployee
);

// GET /employee/:id - Detalhes de um funcionário
router.get(
  '/employee/:id',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  employeesController.getEmployeeDetail
);

// POST /employees/delete/:id - Remove um funcionário
router.post(
  '/employees/delete/:id',
  auth.verifyLoginUser,
  auth.verifyLoginRestAdmin,
  employeesController.deleteEmployee
);

/**
 * ROTA PARA REGISTO DE CLIENTE DURANTE A ENCOMENDA
 */
router.post(
  '/clients/register',
  auth.verifyLoginUser,
  auth.verifyLoginRestStaff,
  clientsController.registerClient
);

module.exports = router;
