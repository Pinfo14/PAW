/**
 * @fileoverview Controller para gestão de menus de restaurante.
 * Fornece operações CRUD: listagem, criação, ativação, edição e remoção de menus,
 * além de exibição de detalhes.
 */

const { Restaurant } = require('../../models/Restaurants');

/**
 * Lista todos os menus do restaurante.
 *
 * @async
 * @function getMenus
 * @param {Express.Request} req - Objeto de requisição Express.
 * @param {Express.Response} res - Objeto de resposta Express.
 */
exports.getMenus = async function(req, res) {
  try {
    const restActualId = res.locals.restId;
    const restaurant = await Restaurant.findById(restActualId).exec();
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    // Renderiza a view de gestão de menus
    res.render('restAdmin/menus/menuGest', { restActualId, restaurant });
  } catch (err) {
    console.error('Erro ao buscar menus:', err);
    res.status(500).send('Erro ao carregar os menus.');
  }
};

/**
 * Exibe o formulário para criação de um menu novo.
 *
 * @async
 * @function getNewMenuForm
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.getNewMenuForm = async function(req, res) {
  try {
    const restActualId = res.locals.restId;
    const restaurant = await Restaurant.findById(restActualId).exec();
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    // Passa lista de pratos para seleção
    res.render('restAdmin/menus/creatMenu', {
      meals: restaurant.meals,
      restActualId
    });
  } catch (err) {
    console.error('Erro ao carregar formulário de novo menu:', err);
    res.status(500).send('Erro ao carregar o formulário de novo menu.');
  }
};

/**
 * Processa a criação de um menu novo.
 * Limita o número de pratos a 10.
 *
 * @async
 * @function postNewMenu
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.postNewMenu = async function(req, res) {
  const { name, meals } = req.body;
  const restActualId = res.locals.restId;
  const maxPlates = 10;

  try {
    const restaurant = await Restaurant.findById(restActualId);
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    // Garante que o número de pratos não excede o máximo de pratos permitidos (10 neste caso)
    const selectedMeals = Array.isArray(meals) ? meals : [meals];
    if (selectedMeals.length > maxPlates) {
      return res.status(400).send('O menu não pode conter mais de ${maxPlates} pratos.');
    }

    restaurant.menu.push({ name, meals: selectedMeals });
    await restaurant.save();

    res.redirect('/rest/menu');
  } catch (err) {
    console.error('Erro ao criar o menu:', err);
    res.status(500).send('Erro ao criar o menu.');
  }
};

/**
 * Altera o estado ativo/inativo de um menu.
 *
 * @async
 * @function toggleMenuStatus
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.toggleMenuStatus = async function(req, res) {
  const menuId = req.params.id;
  const restActualId = res.locals.restId;

  try {
    const restaurant = await Restaurant.findById(restActualId);
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    const menu = restaurant.menu.id(menuId);
    if (!menu) {
      return res.status(404).send('Menu não encontrado');
    }

    // Inverte flag isActive
    menu.isActive = !menu.isActive;
    await restaurant.save();

    res.redirect('/rest/menu');
  } catch (err) {
    console.error('Erro ao atualizar estado do menu:', err);
    res.status(500).send('Erro ao atualizar estado do menu.');
  }
};

/**
 * Exibe detalhes de um menu específico, incluindo os seus pratos.
 *
 * @async
 * @function getMenuDetail
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.getMenuDetail = async function(req, res) {
  const menuId = req.params.id;
  const restActualId = res.locals.restId;

  try {
    const restaurant = await Restaurant.findById(restActualId).exec();
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    const menu = restaurant.menu.id(menuId);
    if (!menu) {
      return res.status(404).send('Menu não encontrado');
    }

    // Mapeia IDs para subdocumentos de refeição
    const fullMeals = menu.meals.map(id => restaurant.meals.id(id));

    res.render('restAdmin/menus/menuDetails', {
      restActualId,
      menu,
      meals: fullMeals
    });
  } catch (err) {
    console.error('Erro ao buscar os detalhes do menu:', err);
    res.status(500).send('Erro ao carregar detalhes do menu.');
  }
};

/**
 * Exibe formulário de edição de um menu existente.
 *
 * @async
 * @function getEditMenuForm
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.getEditMenuForm = async function(req, res) {
  const menuId = req.params.id;
  const restActualId = res.locals.restId;

  try {
    const restaurant = await Restaurant.findById(restActualId).exec();
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    const menu = restaurant.menu.id(menuId);
    if (!menu) {
      return res.status(404).send('Menu não encontrado');
    }

    res.render('restAdmin/menus/editMenu', {
      menu,
      meals: restaurant.meals,
      restActualId
    });
  } catch (err) {
    console.error('Erro ao carregar formulário de edição do menu:', err);
    res.status(500).send('Erro ao carregar o formulário de edição.');
  }
};

/**
 * Processa edição de um menu existente.
 * Atualiza nome e lista de refeições.
 *
 * @async
 * @function postEditMenu
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.postEditMenu = async function(req, res) {
  const menuId = req.params.id;
  const { name, meals } = req.body;
  const restActualId = res.locals.restId;

  try {
    const restaurant = await Restaurant.findById(restActualId).exec();
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    const menu = restaurant.menu.id(menuId);
    if (!menu) {
      return res.status(404).send('Menu não encontrado');
    }

    menu.name = name;
    menu.meals = Array.isArray(meals) ? meals : [meals];
    await restaurant.save();

    res.redirect('/rest/menu');
  } catch (err) {
    console.error('Erro ao editar o menu:', err);
    res.status(500).send('Erro ao editar o menu.');
  }
};

/**
 * Remove um menu pelo ID.
 *
 * @async
 * @function deleteMenu
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.deleteMenu = async function(req, res) {
  const menuId = req.params.id;
  const restActualId = res.locals.restId;

  try {
    const restaurant = await Restaurant.findById(restActualId);
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }

    // Remove menu do array
    restaurant.menu.pull({ _id: menuId });
    await restaurant.save();

    res.redirect('/rest/menu');
  } catch (err) {
    console.error('Erro ao apagar menu:', err);
    res.status(500).send('Erro ao apagar menu.');
  }
};
