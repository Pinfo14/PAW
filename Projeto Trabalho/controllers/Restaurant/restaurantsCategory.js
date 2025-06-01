/**
 * @fileoverview Controller para gestão de categorias de restaurantes na interface de Admin Geral.
 * Inclui listagem, criação, ativação/desativação e remoção de categorias, com verificação de dependências.
 */

const RestaurantsCategory = require('../../models/RestaurantsCategory');
const { Restaurant } = require('../../models/Restaurants');

/**
 * Lista todas as categorias para o Admin Geral.
 * Renderiza a view com possíveis mensagens de erro ou sucesso via query string.
 *
 * @function listCategories
 * @param {Express.Request} req  - Objeto de requisição Express.
 * @param {Express.Response} res - Objeto de resposta Express.
 */
exports.listCategories = function(req, res) {
  RestaurantsCategory.find({})
    .then(categories => {
      const error = req.query.error || null;
      const message = req.query.message || null;
      res.render('adminGeral/restaurantsCategoriesList', {
        categories,
        error,
        message,
        layout: 'layout/adminGeralLayout'
      });
    })
    .catch(err => {
      console.error('Erro ao carregar categorias:', err);
      res.render('adminGeral/restaurantsCategoriesList', {
        categories: [],
        error: 'Erro ao carregar categorias.',
        message: null,
        layout: 'layout/adminGeralLayout'
      });
    });
};

/**
 * Devolve a lista de categorias aprovadas.
 *
 * @async
 * @function getApprovedCategories
 * @returns {Promise<RestaurantsCategory[]>} Array de categorias com approved = true.
 */
exports.getApprovedCategories = async function() {
  try {
    const categories = await RestaurantsCategory.find({ approved: true });
    return categories;
  } catch (err) {
    console.error('Erro ao buscar categorias aprovadas:', err);
    return [];
  }
};

/**
 * Adiciona uma nova categoria.
 * Valida nome não vazio e faz redirect com mensagem via query string.
 *
 * @function addCategory
 * @param {Express.Request} req  - Deve conter req.body.name.
 * @param {Express.Response} res
 */
exports.addCategory = function(req, res) {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.redirect(
      '/admin/categories?error=' +
      encodeURIComponent('Nome da categoria é obrigatório')
    );
  }

  const newCategory = new RestaurantsCategory({ name: name.trim() });
  newCategory.save()
    .then(() => {
      res.redirect(
        '/admin/categories?message=' +
        encodeURIComponent('Categoria adicionada com sucesso')
      );
    })
    .catch(err => {
      console.error('Erro ao adicionar categoria:', err);
      res.redirect(
        '/admin/categories?error=' +
        encodeURIComponent('Erro ao adicionar categoria, possivelmente já existente')
      );
    });
};

/**
 * Alterna o estado de aprovação de uma categoria.
 * Se desativar, verifica se nenhuma entidade Restaurant a está a utilizar.
 *
 * @async
 * @function toggleCategoryApproval
 * @param {Express.Request} req  - Deve conter req.params.id e req.body.action.
 * @param {Express.Response} res
 */
exports.toggleCategoryApproval = async function(req, res) {
  const categoryId = req.params.id;
  const action = req.body.action; // 'activate' ou 'deactivate'

  try {
    if (action === 'deactivate') {
      const inUse = await Restaurant.findOne({ categories: categoryId });
      if (inUse) {
        return res.redirect(
          '/admin/categories?error=' +
          encodeURIComponent('Não é possível desativar: a categoria está em uso por um restaurante.')
        );
      }
    }

    const updated = await RestaurantsCategory.findByIdAndUpdate(
      categoryId,
      { approved: action === 'activate' },
      { new: true, runValidators: false }
    );

    if (!updated) {
      return res.redirect(
        '/admin/categories?error=' +
        encodeURIComponent('Categoria não encontrada')
      );
    }

    res.redirect(
      '/admin/categories?message=' +
      encodeURIComponent('Estado alterado com sucesso')
    );
  } catch (err) {
    console.error('Erro ao alterar o estado da categoria:', err);
    res.redirect(
      '/admin/categories?error=' +
      encodeURIComponent('Erro ao alterar o estado da categoria')
    );
  }
};

/**
 * Remove uma categoria caso não esteja associada a nenhum restaurante.
 *
 * @async
 * @function removeCategory
 * @param {Express.Request} req  - Deve conter req.params.id.
 * @param {Express.Response} res
 */
exports.removeCategory = async function(req, res) {
  const categoryId = req.params.id;
  console.log('Tentando remover categoria ID:', categoryId);

  try {
    const inUse = await Restaurant.findOne({ categories: categoryId });
    if (inUse) {
      return res.redirect(
        '/admin/categories?error=' +
        encodeURIComponent('Não é possível remover: categoria em uso por pelo menos um restaurante.')
      );
    }

    const deleted = await RestaurantsCategory.findByIdAndDelete(categoryId);
    if (!deleted) {
      return res.redirect(
        '/admin/categories?error=' +
        encodeURIComponent('Categoria não encontrada ou já removida.')
      );
    }

    res.redirect(
      '/admin/categories?message=' +
      encodeURIComponent('Categoria removida com sucesso')
    );
  } catch (err) {
    console.error('Erro ao remover categoria:', err);
    res.redirect(
      '/admin/categories?error=' +
      encodeURIComponent('Erro ao remover categoria')
    );
  }
};
