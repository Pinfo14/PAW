/**
 * @fileoverview Controllers para gestão de perfil de clientes.
 * Inclui visualização de perfil, atualização de dados, alteração de password e atualização de morada de entrega.
 */

// Dependências externas e modelos
const { Client } = require("../../models/Users");
const bcrypt = require("bcrypt");
const validatePhone = require("../ExternalAPI/validatePhone");
const geoAddress = require("../ExternalAPI/geoAddress");

/**
 * Recupera perfil do cliente autenticado.
 * Procura dados do cliente no BD e retorna informações básicas.
 *
 * @async
 * @param {Express.Request} req - Requisição Express com req.user.id definido.
 * @param {Express.Response} res - Resposta Express.
 * @param {Function} next - Próximo middleware de erro.
 * @returns {Promise<Express.Response>} Objeto JSON com perfil ou erro 404.
 */
exports.getProfile = async (req, res, next) => {
  try {
    // ID obtido do middleware de autenticação
    const userId = req.user.id; 
    //Procura cliente por ID
    const client = await Client.findById(userId).lean();
    if (!client) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

     // Formata objeto de perfil a devolver
    const profile = {
      id: client._id,
      email: client.email,
      name: client.name,
      nif: client.nif,
      contact: client.contact,
      address: {
        street: client.location.address.street,
        postalCode: client.location.address.postalCode,
        city: client.location.address.city,
        country: client.location.address.country,
      },
      deliveryAddress: {
        street: client.deliveryLocation.address.street,
        postalCode: client.deliveryLocation.address.postalCode,
        city: client.deliveryLocation.address.city,
        country: client.deliveryLocation.address.country,
      },
    };

    // Retorna perfil em JSON
    return res.json(profile);
  } catch (err) {
    next(err);
  }
};

/**
 * Atualiza dados de perfil do cliente.
 * Valida email, NIF, número de contacto e geocodifica moradas.
 *
 * @async
 * @param {Express.Request} req - Requisição Express com corpo contendo campos a atualizar.
 * @param {Express.Response} res - Resposta Express.
 * @param {Function} next - Próximo middleware de erro.
 * @returns {Promise<Express.Response>} Perfil atualizado ou código de erro.
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
        // Clona dados enviados pelo cliente
    const updates = { ...req.body }; 

        // Verifica duplicação de email (exclui próprio id)
    if (updates.email) {
      const exists = await Client.findOne({
        email: updates.email,
        _id: { $ne: userId },
      }).lean();
      if (exists) {
        return res
          .status(409)
          .json({ error: "Email já inscrito por outro cliente." });
      }
    }

        // Verifica duplicação de NIF
    if (updates.nif) {
      const exists = await Client.findOne({
        nif: updates.nif,
        _id: { $ne: userId },
      }).lean();
      if (exists) {
        return res
          .status(409)
          .json({ error: "NIF já inscrito por outro cliente." });
      }
    }

    // Valida número de contacto via API externa
    if (updates.contact) {
      const ok = await validatePhone.validatePhoneNumber(updates.contact);
      if (!ok) {
        return res.status(400).json({ error: "Número de contacto inválido." });
      }
    }

        // Processa atualização de morada de faturação
    if (updates.address) {
      const { street, postalCode, city, country } = updates.address;
      const coords = await geoAddress.geocodeAddress(
        street,
        postalCode,
        city,
        country
      );
      if (!coords) {
        return res.status(400).json({ error: "Morada de faturação inválida." });
      }

      // Substitui address por campo location com coordenadas
      updates.location = {
        address: updates.address,
        coordinates: coords,
      };
      delete updates.address;
    }

        // Processa atualização de morada de entrega
    if (updates.deliveryAddress) {
      const { street, postalCode, city, country } = updates.deliveryAddress;
      const coords = await geoAddress.geocodeAddress(
        street,
        postalCode,
        city,
        country
      );
      if (!coords) {
        return res.status(400).json({ error: "Morada de entrega inválida." });
      }
      updates.deliveryLocation = {
        address: updates.deliveryAddress,
        coordinates: coords,
      };
      delete updates.deliveryAddress;
    }

    // Atualiza documento no BD retornando a nova versão
    const updatedClient = await Client.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    // Formata e devolve perfil atualizado
    if (!updatedClient) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    const profile = {
      id: updatedClient._id,
      email: updatedClient.email,
      name: updatedClient.name,
      nif: updatedClient.nif,
      contact: updatedClient.contact,
      address: {
        street: updatedClient.location.address.street,
        postalCode: updatedClient.location.address.postalCode,
        city: updatedClient.location.address.city,
        country: updatedClient.location.address.country,
      },
      deliveryAddress: {
        street: updatedClient.deliveryLocation.address.street,
        postalCode: updatedClient.deliveryLocation.address.postalCode,
        city: updatedClient.deliveryLocation.address.city,
        country: updatedClient.deliveryLocation.address.country,
      },
    };
    return res.json(profile);
  } catch (err) {
    next(err);
  }
};

/**
 * Atualiza password do cliente.
 * Compara password atual, valida nova password, faz hash e guarda.
 *
 * @async
 * @param {Express.Request} req - Requisição Express com currentPassword e newPassword.
 * @param {Express.Response} res - Resposta Express.
 * @param {Function} next - Próximo middleware de erro.
 * @returns {Promise<Express.Response>} Mensagem de sucesso ou erro.
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; 

    // Verifica campos obrigatórios
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current and new passwords are required." });
    }

    // Procura cliente para comparação de password
    const client = await Client.findById(userId);
    if (!client) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    // Compara password atual
    const match = await bcrypt.compare(currentPassword, client.password);
    if (!match) {
      return res.status(400).json({ error: "Password atual incorreta." });
    }

    // Valida comprimento da nova password
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "A nova password deve ter pelo menos 6 caracteres." });
    }

    // Atualiza hash e guarda
    client.password = await bcrypt.hash(newPassword, 10);
    await client.save();

    return res.json({ message: "Password atualizada com sucesso." });
  } catch (err) {
    next(err);
  }
};

/**
 * Atualiza morada de entrega do cliente.
 * Geocodifica nova morada e atualiza campos específicos.
 *
 * @async
 * @param {Express.Request} req - Requisição Express com street, postalCode, city, country.
 * @param {Express.Response} res - Resposta Express.
 * @param {Function} next - Próximo middleware de erro.
 * @returns {Promise<Express.Response>} Objeto deliveryLocation ou erro.
 */
exports.updateDeliveryLocation = async (req, res, next) => {
  try {
    const clientId = req.user.id;
    const { street, postalCode, city, country } = req.body;

    // Geocodifica morada via API externa
    const coords = await geoAddress.geocodeAddress(
      street,
      postalCode,
      city,
      country
    );
    if (!coords) {
      return res.status(400).json({ error: "Morada inválida" });
    }

    // Atualiza apenas campos de deliveryLocation
    const updated = await Client.findByIdAndUpdate(
      clientId,
      {
        "deliveryLocation.address.street": street,
        "deliveryLocation.address.postalCode": postalCode,
        "deliveryLocation.address.city": city,
        "deliveryLocation.address.country": country || "Portugal",
        "deliveryLocation.coordinates.lat": coords.lat,
        "deliveryLocation.coordinates.lon": coords.lon,
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    return res.json(updated.deliveryLocation);
  } catch (err) {
    console.error("Erro em updateDeliveryLocation:", err.stack);
    next(err);
  }
};
