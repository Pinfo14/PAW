/**
 * @fileoverview Controller para interface de RestAdmin: homepage, formulário e submissão de pedido de registo de restaurante.
 */

const mongoose = require('mongoose');
const { Staff } = require('../../models/Users');
const { Restaurant } = require('../../models/Restaurants');
const RestaurantsCategory = require('../../models/RestaurantsCategory');
const RestaurantsForApproval = require('../../models/RestaurantsForApproval');
const { geocodeAddress } = require('../ExternalAPI/geoAddress');
const restaurantCatController = require('../Restaurant/restaurantsCategory');

/**
 * Exibe a homepage de RestAdmin quando não há restaurante atribuído.
 *
 * @async
 * @param {Express.Request} req - Objeto de requisição, com utilizador em req.user
 * @param {Express.Response} res - Objeto de resposta
 */
exports.homepageWithoutRestaurant = async function(req, res) {
  const restaurant = req.user.restID
    ? await Restaurant.findById(req.user.restID)
    : null;
  res.render('restAdmin/indexWithoutRestaurant', {
    user: req.user,
    restaurant,
    layout: 'layout/restHomePageLayout'
  });
};

/**
 * Renderiza o formulário de pedido de registo de restaurante.
 *
 * @async
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.requestRestaurant = async function(req, res) {
  const categories = await restaurantCatController.getApprovedCategories();
  res.render('restAdmin/requestRestaurant', {
    categories,
    error: req.query.error || null,
    message: req.query.message || null,
    layout: 'layout/restHomePageLayout'
  });
};

/**
 * Processa submissão de pedido de registo de restaurante.
 * Valida campos, geocodifica endereço, gere categorias e cria o pedido.
 *
 * @async
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.requestRestaurantSubmitted = async function(req, res) {
  // Procura categorias aprovadas
  const approvedCategories = await RestaurantsCategory.find({ approved: true });

  try {
    const {
      name,
      nif,
      companyName,
      maxOrders,
      maxDeliveryRange,
      location: address,
      categories,
      newCategory,
      image
    } = req.body;

    // Verifica a duplicação de NIF
    if (await Restaurant.findOne({ nif })) {
      return res.redirect(
        '/restAdmin/requestRestaurant?error=' +
        encodeURIComponent('Já existe um restaurante com esse NIF.')
      );
    }

    // Valida campos de endereço
    const { street, postalCode, city, country } = address || {};
    if (!street || !postalCode || !city || !country) {
      return res.redirect(
        '/restAdmin/requestRestaurant?error=' +
        encodeURIComponent('Todos os campos da morada são obrigatórios.')
      );
    }

    // Geocodificação
    const coords = await geocodeAddress(street, postalCode, city, country);
    if (!coords) {
      return res.redirect(
        '/restAdmin/requestRestaurant?error=' +
        encodeURIComponent('Não foi possível obter coordenadas para a morada fornecida.')
      );
    }
    const finalLocation = { coordinates: coords, address };

    // Prepara IDs de categoria selecionadas
    let categoryIds = [];
    if (categories) {
      categoryIds = Array.isArray(categories) ? categories : [categories];
    }

    // Limite de 3 categorias no total
    if (categoryIds.length + (newCategory?.trim() ? 1 : 0) > 3) {
      return res.redirect(
        '/restAdmin/requestRestaurant?error=' +
        encodeURIComponent('Só pode escolher até 3 categorias no total.')
      );
    }

    // Tratamento de nova categoria sugerida
    if (newCategory && newCategory.trim()) {
      const nameCat = newCategory.trim();
      let existing = await RestaurantsCategory.findOne({ name: nameCat });
      
      if (!existing) {
        existing = await RestaurantsCategory.create({ name: nameCat, approved: false });
      }
      categoryIds.push(existing._id.toString());
    }

    // Converte para ObjectId
    categoryIds = categoryIds.map(id => new mongoose.Types.ObjectId(id));

    // Cria documento de restaurante
    const restaurant = new Restaurant({
      name,
      nif,
      companyName,
      maxOrders,
      maxDeliveryRange,
      location: finalLocation,
      approvedByAdmin: false,
      categories: categoryIds,
      image: req.file ? req.file.filename : 'default-restaurant.jpg'
    });

    // Validação antes de gravar
    const validationError = restaurant.validateSync();

    if (validationError) {
      return res.redirect(
        '/restAdmin/requestRestaurant?error=' +
        encodeURIComponent('Erro nos dados do restaurante.')
      );
    }

    await restaurant.save();

    // Atribui restaurante ao Staff atual
    await Staff.findByIdAndUpdate(req.user._id, { restID: restaurant._id });

    // Registra pedido para aprovação
    await RestaurantsForApproval.create({ restaurant: restaurant._id });

    res.redirect(
      '/restAdmin/homePage?message=' +
      encodeURIComponent('Pedido de registo submetido com sucesso!')
    );
  } catch (err) {
    console.error('Erro interno ao submeter o pedido:', err);
    res.redirect(
      '/restAdmin/requestRestaurant?error=' +
      encodeURIComponent('Erro interno ao submeter o pedido.')
    );
  }
};
