/**
 * @fileoverview Controller para gestão de restaurante e pratos (meals) de um restaurante.
 * Inclui métodos para visualizar dados do restaurante, CRUD de pratos e paginação/filtros.
 */

const path = require('path');
const fs = require('fs');
const MealCategory = require('../../models/MealCategory');
const { Restaurant } = require('../../models/Restaurants');

/**
 * Exibe o dashboard do restaurante, com menus ativos.
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
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    // Filtra apenas menus ativos
    const activeMenus = restaurant.menu.filter(m => m.isActive);
    const userName = (req.user && req.user.name) || req.userName;

    res.render('restAdmin/resAdm', {
      restActualId,
      restName: restaurant.name,
      activeMenus,
      userName
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Exibe formulário para adicionar um novo prato.
 *
 * @async
 * @function getAddMealForm
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.getAddMealForm = async function(req, res) {
  try {
    const restActualId = res.locals.restId;
    const restaurant = await Restaurant.findById(restActualId);
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    // Carrega categorias aprovadas para o select
    const categories = await MealCategory.find({ approved: true });
    
    res.render('restAdmin/meals/addMeal', { restActualId, categories });
  } catch (err) {
    console.error('Erro ao carregar formulário:', err);
    res.status(500).send('Erro ao carregar formulário');
  }
};

/**
 * Processa criação de novo prato, incluindo parse de tamanhos e upload de imagens.
 *
 * @async
 * @function postAddMeal
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.postAddMeal = async function(req, res) {
  const { name, description, sizes, category } = req.body;
  const restActualId = res.locals.restId;
  const images = req.files?.map(file => ({ imagePath: file.filename })) || [];

  // Parse JSON de sizes
  let parsedSizes;
  try {
    parsedSizes = JSON.parse(sizes);
  } catch (e) {
    return res.status(400).send(
      'Formato inválido para as doses (sizes). Use JSON válido.'
    );
  }

  // Valida apenas categorias aprovadas
  const categoryIds = Array.isArray(category) ? category : [category];
  const approved = await MealCategory
    .find({ _id: { $in: categoryIds }, approved: true })
    .distinct('_id');

  if (approved.length !== categoryIds.length) {
    return res
      .status(400)
      .send('Só podem ser usadas categorias que já tenham sido aprovadas pelo Administrador.');
  }

  try {
    const restaurant = await Restaurant.findById(restActualId);
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    const newMeal = {
      name,
      description,
      sizes: parsedSizes,
      category: Array.isArray(category) ? category : [category],
      images
    };

    // Cria e adiciona subdocumento
    const meal = restaurant.meals.create(newMeal);
    restaurant.meals.push(meal);
    await restaurant.save();

    res.redirect('/rest/meals');
  } catch (err) {
    console.error('Erro ao adicionar prato:', err);
    res.status(500).send('Erro ao adicionar prato');
  }
};

/**
 * Lista pratos com paginação e filtros de nome e categoria.
 *
 * @async
 * @function getMeals
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.getMeals = async function(req, res) {
  try {
    const restActualId = res.locals.restId;
    const restaurant = await Restaurant.findById(restActualId);
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const startIndex = (page - 1) * limit;
    const searchQuery = req.query.search || '';
    const selectedCategory = req.query.category || '';

    // Carrega todas as categorias
    const categories = await MealCategory.find({ approved: true }); //mostra apenas categorias aprovadas

    // Filtra localmente o array de meals
    let filtered = restaurant.meals;
    if (searchQuery) {
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (selectedCategory) {
      filtered = filtered.filter(m =>
        m.category.includes(selectedCategory)
      );
    }

    const totalMeals = filtered.length;
    const meals = filtered.slice(startIndex, startIndex + limit);
    const totalPages = Math.ceil(totalMeals / limit);

    res.render('restAdmin/meals/mealGest', {
      restActualId,
      meals,
      page,
      totalPages,
      searchQuery,
      selectedCategory,
      categories
    });
  } catch (err) {
    console.error('Erro ao obter os pratos:', err);
    res.status(500).send('Erro ao obter os pratos');
  }
};

/**
 * Exibe detalhes de um prato específico.
 *
 * @async
 * @function getMealDetail
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.getMealDetail = async function(req, res, next) {
  const mealId = req.params.id;
  const restActualId = res.locals.restId;

  try {
    const restaurant = await Restaurant.findById(restActualId)
      .populate('meals.category')
      .exec();
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    const meal = restaurant.meals.id(mealId);
    if (!meal) {
      return res.status(404).send('Prato não encontrado');
    }

    const categories = await MealCategory.find({
      _id: { $in: meal.category }
    });

    res.render('restAdmin/meals/mealDetails', {
      restaurant,
      meal,
      categories
    });
  } catch (err) {
    console.error('Erro ao buscar detalhes do prato:', err);
    next(err);
  }
};

/**
 * Exibe formulário de edição de um prato.
 *
 * @async
 * @function editMealForm
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.editMealForm = async function(req, res) {
  try {
    const mealId = req.params.id;
    const restActualId = res.locals.restId;
    const restaurant = await Restaurant.findById(restActualId)
      .populate('meals.category')
      .exec();
    const meal = restaurant.meals.id(mealId);
    const categories = await MealCategory.find({ approved: true });

    // Converte IDs de categoria para strings p/ seleção no form
    meal.category = meal.category.map(cat => cat._id.toString());

    res.render('restAdmin/meals/editMeal', {
      meal,
      categories,
      restActualId
    });
  } catch (err) {
    console.error('Erro ao carregar o prato:', err);
    res.status(500).send('Erro ao carregar o prato.');
  }
};

/**
 * Atualiza um prato existente, incluindo remoção/adição de imagens.
 *
 * @async
 * @function updateMeal
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.updateMeal = async function(req, res) {
  try {
    const { name, description, category, removeImages } = req.body;
    const sizes = JSON.parse(req.body.sizes);
    const files = req.files;
    const mealId = req.params.id;
    const restActualId = res.locals.restId;

    if (!restActualId) {
      return res.status(400).send('ID do restaurante em falta.');
    }

    // Valida apenas categorias aprovadas
    const categoryIds = Array.isArray(category) ? category : [category];
    const approved = await MealCategory
      .find({ _id: { $in: categoryIds }, approved: true })
      .distinct('_id');
    if (approved.length !== categoryIds.length) {
      return res
        .status(400)
        .send('Só podem ser usadas categorias que já tenham sido aprovadas pelo Administrador.');
    }

    const restaurant = await Restaurant.findById(restActualId)
      .populate('meals.category')
      .exec();
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado.');
    }

    const meal = restaurant.meals.id(mealId);
    if (!meal) {
      return res.status(404).send('Prato não encontrado.');
    }

    // Atualiza campos do prato
    meal.name = name;
    meal.description = description;
    meal.category = Array.isArray(category) ? category : [category];
    meal.sizes = sizes;

    // Remove imagens apagadas pelo utilizador
    if (removeImages) {
      const toRemove = Array.isArray(removeImages) ? removeImages : [removeImages];
      meal.images = meal.images.filter(img => {
        if (toRemove.includes(img.imagePath)) {
          const imgPath = path.join(__dirname, '..', 'public', 'uploads', img.imagePath);
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
          return false;
        }
        return true;
      });
    }

    // Adiciona novas imagens
    if (files && files.length) {
      const newImages = files.map(file => ({ imagePath: file.filename }));
      meal.images.push(...newImages);
    }

    await restaurant.save();
    res.redirect('/rest/meals');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao atualizar o prato.');
  }
};

/**
 * Exclui um prato, removendo também as imagens do filesystem,
 * desde que o prato não esteja incluído em nenhum menu ativo.
 *
 * @async
 * @function deleteMeal
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.deleteMeal = async function(req, res) {
  const restActualId = res.locals.restId;
  const mealID = req.params.id;

  try {
    const restaurant = await Restaurant.findById(restActualId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurante não encontrado.' });
    }

    // Verifica se o prato está em algum menu
    const isInMenu = restaurant.menu.some(menu =>
      menu.meals.includes(mealID)
    );
    if (isInMenu) {
      return res.status(400).json({
        message: 'Não é possível eliminar o prato porque está incluído num menu.'
      });
    }

    // Apaga imagens associadas
    const meal = restaurant.meals.id(mealID);
    for (const img of meal.images) {
      const imagePath = path.join(__dirname, '..', 'public', 'uploads', img.imagePath);
      fs.access(imagePath, fs.constants.F_OK, err => {
        if (!err) fs.unlink(imagePath, err2 => {
          if (err2) console.error('Erro ao apagar imagem:', err2);
        });
      });
    }

    // Remove o subdocumento do prato e grava o resultado
    restaurant.meals = restaurant.meals.filter(m => m._id.toString() !== mealID);
    await restaurant.save();

    res.redirect('/rest/meals');
  } catch (error) {
    console.error('Erro ao eliminar prato:', error);
    res.status(500).json({ message: 'Erro ao eliminar prato.' });
  }
};
