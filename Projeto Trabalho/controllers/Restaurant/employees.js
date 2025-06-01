/**
 * @fileoverview Controller para gestão de funcionários do restaurante (RestWorker).
 * Inclui operações CRUD: listagem, criação, exibição de detalhe e remoção.
 */

const mongoose = require('mongoose');
const { Staff } = require('../../models/Users');
const bcrypt = require('bcryptjs');

/**
 * Exibe a lista de funcionários (utilizadores do tipo RestWorker) associados ao restaurante
 * obtido em res.locals.restId.
 *
 * @async
 * @function getEmployees
 * @param {Express.Request} req  - Objeto de requisição Express.
 * @param {Express.Response} res - Objeto de resposta Express.
 */
exports.getEmployees = async (req, res) => {
  const restActualId = res.locals.restId;

  try {
    // Converte string de ID para ObjectId
    const objectId = new mongoose.Types.ObjectId(restActualId);

    // Pesquisa todos os Staff com restID e role = 'RestWorker'
    const employees = await Staff.find({ restID: objectId, role: 'RestWorker' });

    // Renderiza a view de listagem, passando o array de funcionários por parâmetro
    res.render('restAdmin/employees/employees', { employees });
  } catch (err) {
    console.error('Erro ao buscar funcionários:', err);
    res.status(500).send('Erro ao carregar funcionários');
  }
};

/**
 * Exibe o formulário para adicionar um funcionário novo.
 * Captura possível mensagem de erro via query param e transfere para a view.
 *
 * @async
 * @function getEmployeesForm
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.getEmployeesForm = async (req, res) => {
  try {
    const restActualId = res.locals.restId;

    // Renderiza o formulário de criação, incluindo erro se existir
    res.render('restAdmin/employees/addEmployee', {
      restActualId,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Erro ao carregar formulário de funcionário:', err);
    res.status(500).send('Erro ao carregar formulário de funcionário');
  }
};

/**
 * Cria um novo funcionário (RestWorker) para o restaurante.
 * - Verifica existência de e-mail duplicado.
 * - Faz hash da password.
 * - Redireciona com mensagem de erro ou sucesso via query string.
 *
 * @async
 * @function createEmployee
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.createEmployee = async (req, res) => {
  const { name, email, password } = req.body;
  const restID = res.locals.restId;

  try {
    // Checa duplicado de e-mail
    const existing = await Staff.findOne({ email });
    if (existing) {
      return res.redirect(
        '/rest/employees/new?error=' +
        encodeURIComponent('Esse email já se encontra usado!')
      );
    }

    // Gera hash da password e cria o novo funcionário
    const hashedPassword = await bcrypt.hash(password, 10);
    const newEmployee = new Staff({
      name,
      email,
      password: hashedPassword,
      role: 'RestWorker',
      restID
    });
    await newEmployee.save();

    // Redireciona para listagem com mensagem de sucesso
    return res.redirect(
      '/rest/employees?message=' +
      encodeURIComponent('Funcionário criado com sucesso')
    );
  } catch (err) {
    console.error('Erro ao criar funcionário:', err);
    return res.redirect(
      '/rest/employees?error=' +
      encodeURIComponent('Erro ao criar funcionário')
    );
  }
};

/**
 * Exibe os detalhes de um funcionário específico.
 * Busca pelo ID passado na rota e renderiza a view de detalhe.
 *
 * @async
 * @function getEmployeeDetail
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.getEmployeeDetail = async (req, res) => {
  const employeeId = req.params.id;
  const restActualId = res.locals.restId;

  try {
    const employee = await Staff.findById(employeeId);
    if (!employee) {
      return res.status(404).send('Funcionário não encontrado');
    }

    res.render('restAdmin/employees/employeeDetails', {
      employee,
      restActualId
    });
  } catch (err) {
    console.error('Erro ao buscar detalhes do funcionário:', err);
    res.status(500).send('Erro ao carregar detalhes do funcionário.');
  }
};

/**
 * Remove um funcionário pelo ID.
 * Após exclusão, redireciona de volta à listagem de funcionários.
 *
 * @async
 * @function deleteEmployee
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.deleteEmployee = async (req, res) => {
  const employeeId = req.params.id;

  try {
    const deleted = await Staff.findByIdAndDelete(employeeId);
    if (!deleted) {
      return res.status(404).send('Funcionário não encontrado');
    }

    return res.redirect('/rest/employees');
  } catch (err) {
    console.error('Erro ao apagar funcionário:', err);
    res.status(500).send('Erro ao apagar funcionário.');
  }
};
