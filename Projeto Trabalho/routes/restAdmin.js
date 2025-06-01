/**
 * @fileoverview Rotas de RestAdmin para gerenciamento de restaurante e pedido de registo.
 * As rotas utilizam middleware de autenticação e autorização via JWT,
 * garantindo que apenas RestAdmin autenticados acessem os recursos.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Controladores importados
const authController       = require('../controllers/Users/auth');
const restAdminController  = require('../controllers/Users/restAdmin');
const restaurantController = require('../controllers/Restaurant/restaurant');
const userController       = require('../controllers/Users/userController');

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/uploads/restaurants';
    // Cria o diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'));
    }
  }
}).single('image');

// Middleware para tratar erros do Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.redirect('/restAdmin/requestRestaurant?error=' + 
        encodeURIComponent('O arquivo é muito grande. Tamanho máximo permitido: 5MB'));
    }
    return res.redirect('/restAdmin/requestRestaurant?error=' + 
      encodeURIComponent('Erro ao fazer upload do arquivo'));
  } else if (err) {
    return res.redirect('/restAdmin/requestRestaurant?error=' + 
      encodeURIComponent(err.message));
  }
  next();
};
/**
 * GET /restAdmin/homePage
 * Exibe a homepage de RestAdmin quando ainda não há restaurante atribuído.
 * Middleware: verifica login e "role" RestAdmin.
 */
router.get(
  '/homePage',
  authController.verifyLoginUser,
  authController.verifyLoginRestAdmin,
  restAdminController.homepageWithoutRestaurant
);

/**
 * GET /restAdmin/requestRestaurant
 * Renderiza formulário de pedido de registo de restaurante.
 * Middleware: verifica login e "role" RestAdmin.
 */
router.get(
  '/requestRestaurant',
  authController.verifyLoginUser,
  authController.verifyLoginRestAdmin,
  restAdminController.requestRestaurant
);

/**
 * POST /restAdmin/requestRestaurantSubmitted
 * Processa submissão do pedido de registo de restaurante.
 * Middleware: verifica login e "role" RestAdmin.
 */
router.post(
  '/requestRestaurantSubmitted',
  authController.verifyLoginUser,
  authController.verifyLoginRestAdmin,
  upload,
  handleMulterError,
  restAdminController.requestRestaurantSubmitted
);

/**
 * GET /restAdmin/
 * Exibe os detalhes do restaurante atribuído a este RestAdmin (resAdm view).
 * Middleware: verifica login e "role" RestAdmin.
 */
router.get(
  '/',
  authController.verifyLoginUser,
  authController.verifyLoginRestAdmin,
  restaurantController.getRestaurant
);

module.exports = router;
