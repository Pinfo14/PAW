/**
 * @fileoverview Controller para dashboard do Admin Geral e alteração de senha.
 * Inclui visualização de número de restaurantes pendentes e exibição de formulário de alteração de password.
 */
const { Restaurant } = require('../../models/Restaurants');

/**
 * Renderiza o dashboard do Admin Geral.
 * Exibe contagem de restaurantes pendentes de aprovação.
 *
 * @async
 * @function getDashboard
 * @param {Express.Request} req - Objeto de requisição Express, contendo usuário autenticado em req.user.
 * @param {Express.Response} res - Objeto de resposta Express.
 */
exports.getDashboard = async function(req, res) {
  try {
    // Conta restaurantes ainda não aprovados (approvedByAdmin = false)
    const pendingCount = await Restaurant.countDocuments({ approvedByAdmin: false });
    // Renderiza view com layout de Admin Geral
    res.render('adminGeral/adminDashboard', {
      admin: req.user,
      pendingCount,
      layout: 'layout/adminGeralLayout'
    });
  } catch (err) {
    console.error('Erro ao carregar dashboard do Admin Geral:', err);
    // Em caso de erro, renderiza dashboard com contagem zero
    res.render('adminGeral/adminDashboard', {
      admin: req.user,
      pendingCount: 0,
      layout: 'layout/adminGeralLayout'
    });
  }
};

/**
 * Exibe o formulário para alteração de senha do utilizador.
 *
 * @function getChangePassword
 * @param {Express.Request} req - Objeto de requisição Express.
 * @param {Express.Response} res - Objeto de resposta Express.
 */
exports.getChangePassword = function(req, res) {
  // Renderiza a página changePassword usando o layout de Admin Geral
  res.render('changePassword', {
    layout: 'layout/adminGeralLayout'
  });
};
