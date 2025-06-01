/**
 * @fileoverview Controller para geocodificação e cálculo de distâncias usando serviços externos.
 * Utiliza Nominatim (OpenStreetMap) para geocodificação (endereço -> coordenadas)
 * e OpenRouteService Matrix API para cálculo de distâncias.
 */

const axios = require("axios");

// Chave de acesso para OpenRouteService (gere em https://openrouteservice.org)
const ORS_API_KEY = SofiaKey;

/**
 * Geocodifica uma morada completa em coordenadas geográficas.
 * Usa o serviço Nominatim do OpenStreetMap.
 *
 * @async
 * @function geocodeAddress
 * @param {string} street - Rua e número.
 * @param {string} postalcode - Código postal (formato postal local).
 * @param {string} city - Cidade.
 * @param {string} country - País.
 * @returns {Promise<{lat: number, lon: number} | null>} Objeto com latitude e longitude em números,
 * ou null em caso de falha (parâmetros faltantes, sem resultado, ou erro de requisição).
 */
exports.geocodeAddress = async function (street, postalcode, city, country) {
  try {
    if (!street || !postalcode || !city || !country) {
      console.error("Faltam parâmetros para geocodificação!");
      return null;
    }

    const url = "https://nominatim.openstreetmap.org/search";
    const params = {
      street: street,
      postalcode: postalcode,
      city: city.trim(),
      country: country.trim(),
      format: "json",
      limit: 1,
    };

    console.log("URL da requisição:", url, "Parâmetros:", params);

    const response = await axios.get(url, {
      params,
      headers: { "User-Agent": "projeto-paw" },
    });

    if (!Array.isArray(response.data) || response.data.length === 0) {
      console.error("Nenhum resultado encontrado para a morada fornecida");
      return null;
    }

    const { lat, lon } = response.data[0];
    if (!lat || !lon) {
      console.error("Coordenadas inválidas retornadas pelo serviço");
      return null;
    }

    return { lat: parseFloat(lat), lon: parseFloat(lon) };
  } catch (error) {
    console.error("Erro na geocodificação:", error.message);
    return null;
  }
};

/**
 * Calcula distâncias de um ponto de origem para vários destinos de uma só vez,
 * usando a Matrix API do OpenRouteService.
 *
 * @async
 * @param {{lat:number,lon:number}} fromCoords
 * @param {{lat:number,lon:number}[]} toCoordsArray
 * @returns {Promise<number[]|null>} Array de distâncias (km) na mesma ordem,
 *   ou null em caso de erro.
 */
exports.calculateDistances = async function (fromCoords, toCoordsArray) {
  try {
    // 1) monta o payload: primeira linha é a origem, depois todos os destinos
    const locations = [
      [fromCoords.lon, fromCoords.lat],
      ...toCoordsArray.map((c) => [c.lon, c.lat]),
    ];

    const body = {
      locations,
      metrics: ["distance"],
      units: "km",
    };

    const res = await axios.post(
      "https://api.openrouteservice.org/v2/matrix/driving-car",
      body,
      {
        headers: {
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    // 2) distances[0] é um array com distâncias [orig→orig, orig→dest1, orig→dest2…]
    const row0 = res.data.distances?.[0];
    if (!Array.isArray(row0)) {
      console.error("Resposta inválida da Matrix API");
      return null;
    }
    // 3) descarta o primeiro elemento (orig→orig) e devolve só orig→cada destino
    return row0.slice(1);
  } catch (err) {
    console.error("Erro na Matrix API:", err.response?.data || err.message);
    return null;
  }
};

/**
 * Calcula a distância entre duas coordenadas usando OpenRouteService Matrix API.
 *
 * @async
 * @function calculateDistance
 * @param {{lat: number, lon: number}} fromCoords - Coordenadas de origem.
 * @param {{lat: number, lon: number}} toCoords - Coordenadas de destino.
 * @returns {Promise<number|null>} Distância em quilómetros, ou null em caso de erro.
 */
exports.calculateDistance = async function (fromCoords, toCoords) {
  try {
    const body = {
      locations: [
        [fromCoords.lon, fromCoords.lat],
        [toCoords.lon, toCoords.lat],
      ],
      metrics: ["distance"],
      units: "km",
    };

    const response = await axios.post(
      "https://api.openrouteservice.org/v2/matrix/driving-car",
      body,
      {
        headers: {
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const distance = response.data.distances?.[0]?.[1];
    if (typeof distance !== "number") {
      console.error("Resposta inválida da API de distâncias");
      return null;
    }

    return distance;
  } catch (error) {
    console.error(
      "Erro ao calcular distância (ORS):",
      error.response?.data || error.message
    );
    return null;
  }
};
