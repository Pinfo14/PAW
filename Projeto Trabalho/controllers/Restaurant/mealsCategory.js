/**
 * @fileoverview Controller para gestão de categorias de pratos.
 * Inclui listagem, criação, ativação/desativação e remoção, além de endpoints específicos para interfaces REST.
 */

const MealCategory = require('../../models/MealCategory');
const { Restaurant } = require('../../models/Restaurants');

/**
 * Exibe lista de todas as categorias de pratos.
 * Renderiza view com possíveis mensagens de erro ou sucesso via query string.
 *
 * @async
 * @function listMealCategories
 * @param {Express.Request} req  - Objeto de requisição Express.
 * @param {Express.Response} res - Objeto de resposta Express.
 */
exports.listMealCategories = async function(req, res) {
  try {
    const categories = await MealCategory.find({});
    res.render('adminGeral/mealCategoriesList', {
      categories,
      error: req.query.error || null,
      message: req.query.message || null,
      layout: 'layout/adminGeralLayout'
    });
  } catch (err) {
    console.error('Erro ao carregar categorias de pratos:', err);
    res.render('adminGeral/mealCategoriesList', {
      categories: [],
      error: 'Erro ao carregar categorias de pratos.',
      message: null,
      layout: 'layout/adminGeralLayout'
    });
  }
};

/**
 * Adiciona uma nova categoria de pratos.
 * Valida que o nome não é vazio, grava e redireciona com uma mensagem.
 *
 * @async
 * @function addMealCategory
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.addMealCategory = async function(req, res) {
  const { name } = req.body;
  // Verifica campo obrigatório
  if (!name || name.trim() === '') {
    return res.redirect('/admin/mealCategories?error=' +
      encodeURIComponent('Nome da categoria é obrigatório')
    );
  }

  const newCategory = new MealCategory({ name: name.trim() });
  try {
    await newCategory.save();
    res.redirect('/admin/mealCategories?message=' +
      encodeURIComponent('Categoria adicionada com sucesso')
    );
  } catch (err) {
    console.error('Erro ao adicionar categoria:', err);
    res.redirect('/admin/mealCategories?error=' +
      encodeURIComponent('Erro ao adicionar categoria, possivelmente já existente')
    );
  }
};

/**
 * Ativa ou desativa aprovação de uma categoria de pratos.
 * Se for desativada, verifica se categoria está em uso por algum prato.
 *
 * @async
 * @function toggleMealCategoryApproval
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.toggleMealCategoryApproval = async function(req, res) {
  const categoryId = req.params.id;
  const action = req.body.action; // 'activate' ou 'deactivate'

  try {
    // Se desativar, verifica a existência de dependências
    if (action === 'deactivate') {
      const inUse = await Restaurant.findOne({ 'meals.category': categoryId });
      if (inUse) {
        return res.redirect('/admin/mealCategories?error=' +
          encodeURIComponent('Não é possível desativar: esta categoria ainda está em uso.')
        );
      }
    }

    // Atualiza flag approved
    const updated = await MealCategory.findByIdAndUpdate(
      categoryId,
      { approved: action === 'activate' },
      { new: true, runValidators: false }
    );

    if (!updated) {
      return res.redirect('/admin/mealCategories?error=' +
        encodeURIComponent('Categoria não encontrada')
      );
    }

    res.redirect('/admin/mealCategories?message=' +
      encodeURIComponent('Status alterado com sucesso')
    );
  } catch (err) {
    console.error('Erro ao alterar status da categoria:', err);
    res.redirect('/admin/mealCategories?error=' +
      encodeURIComponent('Erro ao alterar status da categoria')
    );
  }
};

/**
 * Remove uma categoria de pratos, apenas se não existirem pratos associados.
 *
 * @async
 * @function removeMealCategory
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.removeMealCategory = async function(req, res) {
  const categoryId = req.params.id;
  try {
    // Verifica a existência de pratos com essa categoria
    const inUse = await Restaurant.findOne({ 'meals.category': categoryId });
    if (inUse) {
      return res.redirect('/admin/mealCategories?error=' +
        encodeURIComponent('Não é possível remover: categoria está em uso.')
      );
    }

    await MealCategory.findByIdAndDelete(categoryId);
    res.redirect('/admin/mealCategories?message=' +
      encodeURIComponent('Categoria removida com sucesso')
    );
  } catch (err) {
    console.error('Erro ao remover categoria:', err);
    res.redirect('/admin/mealCategories?error=' +
      encodeURIComponent('Erro ao remover categoria')
    );
  }
};

/**
 * Exibe formulário para criação de nova categoria via interface restWorker.
 *
 * @async
 * @function getMealCatg
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.getMealCatg = async function(req, res) {
  try {
    const restActualId = res.locals.restId;
    const restaurant = await Restaurant.findById(restActualId);
    if (!restaurant) {
      return res.status(404).send('Restaurante não encontrado');
    }
    res.render('restAdmin/newCategory', { restActualId });
  } catch (err) {
    console.error('Erro ao carregar formulário de categoria:', err);
    res.status(500).send('Erro ao carregar formulário de categoria.');
  }
};

/**
 * Processa criação de categoria de pratos na interface restWorker.
 * Cria com approved=false e redireciona para a listagem de pratos.
 *
 * @async
 * @function postMealCatg
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.postMealCatg = async function(req, res) {
  try {
    const { name } = req.body;
    const novaCategoria = new MealCategory({ name, approved: false });
    await novaCategoria.save();
    res.redirect('/rest/meals');
  } catch (err) {
    console.error('Erro ao salvar categoria:', err);
    res.status(500).send('Erro ao salvar categoria.');
  }
};
