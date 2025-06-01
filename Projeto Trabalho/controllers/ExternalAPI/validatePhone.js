/**
 * @fileoverview Validação de números de telefone portugueses usando API externa.
 * Remove formatação local, aplica prefixo internacional se necessário e verifica a validade via REST.
 */

const axios = require('axios');

// Chave de acesso para Apilayer Phone Validation API (gere em https://apilayer.com)


/**
 * Valida um número de telefone português.
 *
 * - Remove caracteres não numéricos.
 * - Verifica se tem exatamente 9 dígitos e começa por 2 ou 9.
 * - Adiciona o indicativo "+351" se não existir.
 * - Consulta a API de validação para confirmação definitiva.
 *
 * @async
 * @function validatePhoneNumber
 * @param {string} phone - Número de telefone a validar (com ou sem formatação).
 * @returns {Promise<boolean>} `true` se o número for válido, `false` caso contrário ou erro.
 */
exports.validatePhoneNumber = async function(phone) {
  // Remove tudo que não seja dígito
  const digits = phone.replace(/\D/g, '');

  // Deve ter 9 dígitos
  if (digits.length !== 9) {
    return false;
  }

  // Deve começar por 2 (fixo) ou 9 (móvel)
  if (!/^[29]/.test(digits)) {
    return false;
  }

  // Prepara formato internacional com prefixo +351
  let formatted = phone.trim();
  if (!formatted.startsWith('+')) {
    formatted = `+351${formatted}`;
  }

  const url = `http://apilayer.net/api/validate`;
  const params = { access_key: ACCESS_KEY, number: formatted };

  try {
    const response = await axios.get(url, { params });
    const data = response.data;

    // Retorna true apenas se API indicar validade
    return Boolean(data.valid);
  } catch (error) {
    console.error('Erro ao validar número de telefone:', error.message);
    return false;
  }
};
