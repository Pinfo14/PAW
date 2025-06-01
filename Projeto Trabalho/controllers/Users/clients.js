/**
 * @fileoverview Controller para gestão de clientes no fluxo de encomendas.
 * Inclui validação de dados, geocodificação de moradas e registo de clientes via PRG (Post/Redirect/Get).
 */

const { Client, Staff } = require('../../models/Users');
const bcrypt = require('bcrypt');
const { validatePhoneNumber } = require('../ExternalAPI/validatePhone');
const { geocodeAddress } = require('../ExternalAPI/geoAddress');

/**
 * Valida se o NIF tem exatamente 9 dígitos.
 * @param {string} nif
 * @returns {boolean}
 */
exports.isValidNif = function(nif) {
  return /^\d{9}$/.test(nif);
};

/**
 * Valida o formato de e-mail.
 * @param {string} email
 * @returns {boolean}
 */
exports.isValidEmail= function(email) {
  return /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
}

/**
 * Valida o formato de código postal (XXXX-XXX).
 * @param {string} code
 * @returns {boolean}
 */
exports.isValidPostalCode= function(code) {
  return /^\d{4}-\d{3}$/.test(code);
}

/**
 * Verifica existência de email ou NIF nos modelos Client e Staff.
 * @async
 * @param {string} email
 * @param {string} nif
 * @returns {Promise<{emailExists: boolean, nifExists: boolean}>}
 */
async function emailOrNifExists(email, nif) {
  const [clientEmail, staffEmail, nifEntry] = await Promise.all([
    Client.findOne({ email }).lean(),
    Staff.findOne({ email }).lean(),
    Client.findOne({ nif }).lean()
  ]);
  return {
    emailExists: Boolean(clientEmail || staffEmail),
    nifExists: Boolean(nifEntry)
  };
}

/**
 * Helper para redirecionar com mensagem de erro via query string.
 * Mantém newClientId se existir.
 * @param {Express.Response} res
 * @param {string} msg
 * @param {string} [newClientId]
 */
function redirectError(res, msg, newClientId) {
  const params = new URLSearchParams({ error: msg });
  if (newClientId) params.set('newClientId', newClientId);
  res.redirect(`/rest/orders/new?${params.toString()}`);
}

/**
 * Regista um novo cliente via fluxo de encomenda.
 * Valida campos, geocodifica e faz PRG(Post/Redirect/Get) para mostrar erros.
 *
 * @async
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
exports.registerClient = async function(req, res) {
  const {
    customerName,
    customerEmail,
    customerPassword,
    customerNif,
    customerCompany,
    customerContact,
    resStreet,
    resPostal,
    resCity,
    resCountry,
    delStreet,
    delPostal,
    delCity,
    delCountry
  } = req.body;

  const newClientId = req.query.newClientId;

  try {
    // Validações básicas
    if (!isValidNif(customerNif)) {
      return redirectError(res, 'O NIF deve ter exatamente 9 dígitos.', newClientId);
    }
    if (!isValidEmail(customerEmail)) {
      return redirectError(res, 'Email inválido.', newClientId);
    }
    if (!isValidPostalCode(resPostal) || !isValidPostalCode(delPostal)) {
      return redirectError(res, 'Código postal inválido. Formato esperado: XXXX-XXX.', newClientId);
    }
    const phoneValid = await validatePhoneNumber(customerContact);
    if (!phoneValid) {
      return redirectError(res, 'Contacto inválido.', newClientId);
    }

    const { emailExists, nifExists } = await emailOrNifExists(customerEmail, customerNif);
    if (emailExists) {
      return redirectError(res, 'Email já existe na base de dados.', newClientId);
    }
    if (nifExists) {
      return redirectError(res, 'Já existe um cliente com este NIF.', newClientId);
    }

    // Geocodificação das moradas
    const location = await geocodeAddress(resStreet, resPostal, resCity, 'Portugal');
    const deliveryLocation = await geocodeAddress(delStreet, delPostal, delCity, 'Portugal');

    if (!location) {
      return redirectError(res, 'Não foi possível obter coordenadas da morada de faturação.', newClientId);
    }
    if (!deliveryLocation) {
      return redirectError(res, 'Não foi possível obter coordenadas da morada de entrega.', newClientId);
    }

    // Criação do cliente
    const hashedPassword = await bcrypt.hash(customerPassword, 10);
    const client = await Client.create({
      name: customerName,
      email: customerEmail,
      password: hashedPassword,
      nif: customerNif,
      companyName: customerCompany || null,
      contact: customerContact,
      location: { address: { street: resStreet, postalCode: resPostal, city: resCity }, coordinates: location },
      deliveryLocation: { address: { street: delStreet, postalCode: delPostal, city: delCity }, coordinates: deliveryLocation }
    });

    // Redireciona para o form de encomenda com novo clientId
    res.redirect(`/rest/orders/new?newClientId=${client._id}`);
  } catch (err) {
    console.error('Erro ao registar cliente:', err);
    //debug
    console.error(err.stack);
    //
    redirectError(res, 'Ocorreu um erro interno. Por favor tente novamente.', newClientId);
  }
};
