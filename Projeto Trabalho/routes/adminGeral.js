const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Users/adminGeral');
const restaurantsController = require('../controllers/Restaurant/restaurant');
const categoryController = require('../controllers/Restaurant/restaurantsCategory');
const mealsCategoryController = require('../controllers/Restaurant/mealsCategory');
const userController = require('../controllers/Users/userController');
const authController = require('../controllers/Users/auth');

// Rota para o dashboard do admin (acessível via "/admin/adminDashboard")
router.get('/dashboard',authController.verifyLoginUser, authController.verifyLoginAdmin, adminController.getDashboard);

// Rota para exibir a página de alteração de password ("/admin/changePassword")
router.get('/changePassword',authController.verifyLoginUser, userController.changePassword);

// Rota para processar a alteração da password via POST ("/admin/changePassword")
router.post('/changePassword', authController.verifyLoginUser, userController.changePasswordSubmitted);

// Rota para listar os restaurantes (para Admin)
router.get('/restaurants', authController.verifyLoginUser, authController.verifyLoginAdmin, restaurantsController.listRestaurantsAdmin);

// Rota para visualizar os detalhes de um restaurante (para Admin)
router.get('/restaurants/:id', authController.verifyLoginUser, authController.verifyLoginAdmin, restaurantsController.getRestaurantDetailsAdmin);

// Rota para alternar o status de aprovação do restaurante (ativar/desativar)
router.post('/restaurants/:id/toggle', authController.verifyLoginUser, authController.verifyLoginAdmin, restaurantsController.toggleApproval);

// Rota para rejeitar pedido (para restaurantes inativos)
router.post('/restaurants/:id/reject', authController.verifyLoginUser, authController.verifyLoginAdmin, restaurantsController.rejectRestaurant);

// Rota para remover restaurante ativo
router.post('/restaurants/:id/remove', authController.verifyLoginUser, authController.verifyLoginAdmin, restaurantsController.removeRestaurant);

// Rotas para gestão de categorias de restaurantes:
router.get('/categories', authController.verifyLoginUser,  authController.verifyLoginAdmin, categoryController.listCategories);
router.post('/categories',authController.verifyLoginUser,  authController.verifyLoginAdmin, categoryController.addCategory);
router.post('/categories/:id/toggle', authController.verifyLoginUser,  authController.verifyLoginAdmin, categoryController.toggleCategoryApproval);
router.post('/categories/:id/delete', authController.verifyLoginUser, authController.verifyLoginAdmin, categoryController.removeCategory);

// Rotas para gestão de categorias de pratos
router.get('/mealCategories', authController.verifyLoginUser, authController.verifyLoginAdmin, mealsCategoryController.listMealCategories);
router.post('/mealCategories', authController.verifyLoginUser, authController.verifyLoginAdmin, mealsCategoryController.addMealCategory);
router.post('/mealCategories/:id/toggle', authController.verifyLoginUser, authController.verifyLoginAdmin, mealsCategoryController.toggleMealCategoryApproval);
router.post('/mealCategories/:id/delete', authController.verifyLoginUser, authController.verifyLoginAdmin, mealsCategoryController.removeMealCategory);

module.exports = router;
