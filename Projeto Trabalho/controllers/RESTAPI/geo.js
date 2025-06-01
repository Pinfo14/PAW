
/**
 * @fileoverview Controllers para geocodificação de moradas e cálculo de distâncias utilizando API externa.
 * Inclui rotas para obter coordenadas geográficas e para calcular distância entre dois pontos.
 */

// Importa funções de geocodificação e cálculo de distância
const {
  geocodeAddress,
  calculateDistance,
} = require("../../controllers/ExternalAPI/geoAddress");

/**
 * Obtém coordenadas geográficas para uma morada fornecida.
 *
 * @async
 * @function getCoords
 * @param {Express.Request} req - Objeto de requisição Express, com corpo contendo street, postalCode, city e opcionalmente country.
 * @param {Express.Response} res - Objeto de resposta Express.
 * @param {Function} next - Próximo middleware para tratamento de erros.
 * @returns {Promise<Express.Response>} JSON com coordenadas { lat, lon } ou mensagem de erro.
 */
exports.getCoords = async function (req, res, next) {
  try {
    // Extrai campos obrigatórios do corpo da requisição
    const { street, postalCode, city, country } = req.body;
    // Valida presença de street, postalCode e city
    if (!street || !postalCode || !city) {
      return res
        .status(400)
        .json({ error: "street, postalCode e city são obrigatórios" });
    }
    // Chama função de geocodificação, definindo Portugal como país padrão
    const coords = await geocodeAddress(
      street,
      postalCode,
      city,
      country || "Portugal"
    );
    // Se não for possível obter coordenadas, retorna erro 404
    if (!coords) {
      return res
        .status(404)
        .json({ error: "Não foi possível geocodificar a morada" });
    }

    // Retorna coordenadas em JSON
    return res.json(coords); 
  } catch (err) {
    // Encaminha erro para middleware de tratamento
    return next(err);
  }
};

/**
 * Calcula distância entre dois pontos geográficos.
 *
 * @async
 * @function getDistance
 * @param {Express.Request} req - Objeto de requisição Express, com corpo contendo objetos from e to, cada um com lat e lon.
 * @param {Express.Response} res - Objeto de resposta Express.
 * @param {Function} next - Próximo middleware para tratamento de erros.
 * @returns {Promise<Express.Response>} JSON com valor da distância ou mensagem de erro.
 */
exports.getDistance = async function (req, res, next) {
  try {
    // Extrai objetos de coordenadas 'from' e 'to' do corpo da requisição
    const { from, to } = req.body;
    
    // Valida existência de lat e lon em ambos
    if (!from?.lat || !from?.lon || !to?.lat || !to?.lon) {
      return res
        .status(400)
        .json({ error: 'Campos "from" e "to" com lat e lon são obrigatórios' });
    }
    // Chama função para calcular distância
    const distance = await calculateDistance(from, to);
    // Se ocorrer falha no cálculo, retorna erro 502
    if (distance === null) {
      return res.status(502).json({ error: "Falha ao calcular distância" });
    }

    // Retorna distância calculada em JSON
    return res.json({ distance });
  } catch (err) {
    // Encaminha erro para middleware de tratamento
    return next(err);
  }
};
