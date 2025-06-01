/**
 * @fileoverview Controllers de autenticação: login, registo e autenticação de clientes.
 * Inclui geração e verificação de tokens JWT, validação de dados e integração com APIs externas.
 */

// Dependências externas
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../../jwt_secret/config");
const { Client } = require("../../models/Users");
const validatePhone = require("../ExternalAPI/validatePhone");
const geoAddress = require("../ExternalAPI/geoAddress");
const {
  isValidNif,
  isValidEmail,
  isValidPostalCode,
} = require("../Users/clients");

/**
 * Procura um utilizador (Client ou Staff) pelo email.
 *
 * @async
 * @param {string} email - Email do utilizador.
 * @returns {Promise<Object|null>} Objeto do utilizador ou null.
 */
async function findUserByEmail(email) {
  let user = await Client.findOne({ email });
  if (!user) user = await Staff.findOne({ email });

  return user;
}

/**
 * Controller de login de utilizador.
 * Valida campos, compara password, gera token e retorna dados de utilizador.
 *
 * @async
 * @param {Express.Request} req - Objeto de requisição Express.
 * @param {Express.Response} res - Objeto de resposta Express.
 * @param {Function} next - Próximo middleware de tratamento de erros.
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email e password são obrigatórios" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Email não registado" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Password incorreta" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      config.secret,
      { expiresIn: "24h" }
    );

    const client = {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      nif: user.nif,
      companyName: user.companyName,
      contact: user.contact,
      location: user.location,
      deliveryLocation: user.deliveryLocation,
    };

    return res.json({
      token,
      user: client,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller de registo de novos clientes.
 * Valida inputs, verifica duplicados, geocodifica endereços, cria hash da password e regista cliente.
 *
 * @async
 * @param {Express.Request} req - Objeto de requisição Express.
 * @param {Express.Response} res - Objeto de resposta Express.
 * @param {Function} next - Próximo middleware de tratamento de erros.
 */
exports.register = async (req, res, next) => {
  try {
    const {
      email,
      password,
      name,
      nif,
      companyName,
      contact,
      address,
      isDeliverySame,
      deliveryAddress,
    } = req.body;


    if (!email || !password || !name || !nif || !contact || !address) {
      return res.status(400).json({ error: "Faltam campos obrigatórios." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email inválido." });
    }
    if (!isValidNif(nif)) {
      return res
        .status(400)
        .json({ error: "O NIF deve conter exatamente 9 dígitos." });
    }
    if (!isValidPostalCode(address.postalCode)) {
      return res
        .status(400)
        .json({ error: "Código postal de faturação inválido." });
    }
    if (!isDeliverySame && !isValidPostalCode(deliveryAddress.postalCode)) {
      return res
        .status(400)
        .json({ error: "Código postal de entrega inválido." });
    }
    const phoneOK = await validatePhone.validatePhoneNumber(contact);
    if (!phoneOK) {
      return res.status(400).json({ error: "Número de contato inválido." });
    }

    const existingEmail = await Client.findOne({ email }).lean();
    const existingNif = await Client.findOne({ nif }).lean();
    if (existingEmail) {
      return res.status(409).json({ error: "Email já registado." });
    }
    if (existingNif) {
      return res
        .status(409)
        .json({ error: "Já existe um cliente com este NIF." });
    }

    const billingCoords = await geoAddress.geocodeAddress(
      address.street,
      address.postalCode,
      address.city,
      address.country
    );
    if (!billingCoords) {
      return res.status(400).json({
        error: "Não foi possível geocodificar o endereço de faturação.",
      });
    }

    let finalDeliveryAddr = address;
    let deliveryCoords = billingCoords;
    if (!isDeliverySame) {
      const coords = await geoAddress.geocodeAddress(
        deliveryAddress.street,
        deliveryAddress.postalCode,
        deliveryAddress.city,
        deliveryAddress.country
      );
      if (!coords) {
        return res.status(400).json({
          error: "Não foi possível geocodificar o endereço de entrega.",
        });
      }
      finalDeliveryAddr = deliveryAddress;
      deliveryCoords = coords;
    }

    const hashed = await bcrypt.hash(password, 10);

    const client = await Client.create({
      email: email.toLowerCase().trim(),
      password: hashed,
      name: name.trim(),
      nif,
      companyName: companyName?.trim() || undefined,
      contact,
      role: "Client",
      location: {
        address,
        coordinates: billingCoords,
      },
      deliveryLocation: {
        address: finalDeliveryAddr,
        coordinates: deliveryCoords,
      },
    });

    const token = jwt.sign(
      { email: client.email, role: client.role },
      config.secret,
      { expiresIn: 86400 * 1000 }
    );

    return res.status(201).json({
      token,
      user: {
        id: client._id,
        email: client.email,
        role: client.role,
        name: client.name,
      },
    });
  } catch (err) {
    console.error("Erro no register:", err);
    return res
      .status(500)
      .json({ error: err.message || "Erro interno no servidor" });
  }
};

/**
 * Middleware para autenticar pedidos de clientes.
 * Verifica presença de token JWT e autoriza apenas utilizadores com role 'Client'.
 *
 * @param {Express.Request} req - Objeto de requisição Express.
 * @param {Express.Response} res - Objeto de resposta Express.
 * @param {Function} next - Próximo middleware.
 */
exports.authenticateClient = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Token em falta" });
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Token mal formado" });
  }

  jwt.verify(token, config.secret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido ou expirado" });
    }
    if (decoded.role !== "Client") {
      return res.status(403).json({ error: "Acesso restrito a clientes" });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  });
};
