/**
 * @fileoverview Controllers para gestão de encomendas: listagem, validação, criação, atualização via SSE e cancelamento.
 * Inclui lógica de cálculos de distância, tempo de preparação e controlo de blacklist.
 */

// Modelos e dependências externas
const Order = require("../../models/Orders");
const Blacklist = require("../../models/blacklist");
const { emitter } = require("../RESTAPI/sse");
const { Client } = require("../../models/Users");
const { Restaurant } = require("../../models/Restaurants");
const { calculateDistance } = require("../ExternalAPI/geoAddress");
const mongoose = require("mongoose");

/**
 * Lista encomendas entregues ou canceladas para o cliente autenticado.
 * Formata histórico de encomendas com detalhes de refeições e status.
 *
 * @async
 * @param {Express.Request} req - Requisição Express contendo req.user.email.
 * @param {Express.Response} res - Resposta Express para enviar JSON de resultados.
 * @param {Function} next - Próximo middleware de erro.
 */
exports.listDeliveredOrCanceled = async (req, res, next) => {
  try {
    const clientEmail = req.user.email;
    const host = `${req.protocol}://${req.get("host")}`;

     // Busca encomendas do cliente com status Delivered ou canceladas
     const orders = await Order.find({
      "customer.email": clientEmail,
      $or: [{ currentStatus: "Delivered" }, { canceledMeal: true }],
    })
      .sort({ createdAt: -1 }) // Ordena da mais recente para a mais antiga
      .lean();

    // Mapeia cada encomenda para formato de resposta
    const result = orders.map((o) => ({
      id: o._id.toString(),
      restaurantId: o.restaurantId.toString(),
      restaurantName: o.restaurant.name,
      date: o.createdAt.toISOString(),
      status: o.canceledMeal ? "Canceled" : o.currentStatus,
      meals: o.meals.map((m) => {
        // Seleciona tamanho e imagem padrão
        const sz =
          Array.isArray(m.sizes) && m.sizes.length
            ? m.sizes[0]
            : { name: "—", price: 0 };
        const imgPath =
          Array.isArray(m.images) && m.images.length
            ? `${host}/uploads/${m.images[0].imagePath}`
            : null;
        return {
          name: m.name,
          size: sz.name,
          price: sz.price,
          image: imgPath,
        };
      }),
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Valida se a localização do cliente está dentro do alcance de entrega do restaurante.
 *
 * @async
 * @param {Express.Request} req - Requisição Express com { restaurantId, userLat, userLon }.
 * @param {Express.Response} res - Resposta Express com JSON { ok, distance, maxRange }.
 * @param {Function} next - Próximo middleware de erro.
 */
exports.validateDelivery = async (req, res, next) => {
  try {
    const { restaurantId, userLat, userLon } = req.body;
    const rest = await Restaurant.findById(restaurantId).lean();
    if (!rest)
      return res.status(404).json({ error: "Restaurante não encontrado" });

    // Calcula distância entre cliente e restaurante
    const dist = await calculateDistance(
      { lat: userLat, lon: userLon },
      rest.location.coordinates
    );
    if (dist === null)
      return res.status(500).json({ error: "Falha ao calcular distância" });

    return res.json({
      ok: dist <= rest.maxDeliveryRange,
      distance: dist,
      maxRange: rest.maxDeliveryRange,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Calcula tempo de preparação de uma nova encomenda.
 * Verifica limite de encomendas simultâneas e calcula tempo com base em número de refeições.
 *
 * @async
 * @param {ObjectId} restaurantId - ID do restaurante.
 * @param {number} newMealsCount - Número de refeições na encomenda nova.
 * @throws {Error} Se restaurante não existir ou limite de encomendas excedido.
 * @returns {Promise<number>} Tempo total de preparação em minutos.
 */
async function calculatePreparationTime(restaurantId, newMealsCount) {
  const rest = await Restaurant.findById(restaurantId).lean();
  if (!rest) {
    throw new Error("Restaurante não encontrado");
  }
  // Recolhe encomendas pendentes (ordered/preparing/ready)
  const pendings = await Order.find({
    restaurantId,
    canceledMeal: { $ne: true },
    currentStatus: { $in: ["Ordered", "Preparing", "Ready"] },
  }).lean();

  // Limita número máximo de encomendas simultâneas
  if (pendings.length + 1 > rest.maxOrders) {
    throw new Error(
      `Número máximo de encomendas simultâneas (${rest.maxOrders}) excedido.`
    );
  }

  // Calcula tempo com base em média de 3 min por refeição
  const pendingMealsCount = pendings.reduce(
    (sum, o) => sum + o.meals.length,
    0
  );
  const averagePrepMinutes = 3;

  const totalMeals = pendingMealsCount + newMealsCount;
  const totalTime = totalMeals * averagePrepMinutes;

  return totalTime;
}

/**
 * Cria uma nova encomenda e notifica via SSE.
 * Gera código de pickup se aplicável e calcula tempo de preparação.
 *
 * @async
 * @param {Express.Request} req - Requisição Express com dados de encomenda em req.body.
 * @param {Express.Response} res - Resposta Express com a encomenda criada.
 * @param {Function} next - Próximo middleware de erro.
 */
exports.createOrder = async (req, res, next) => {
  console.log('>>> createOrder chamado com payload:', req.body);
  try {
    const {
      type,
      customer,
      restaurant,
      restaurantId,
      meals: payloadMeals,
    } = req.body;

    // Gera código de pickup para encomendas de recolha
    let pickupCode = null;
    if (type === "pickup") {
      pickupCode = String(Math.floor(10000 + Math.random() * 90000));
    }

    // Calcula tempo de preparação
    const preparationTime = await calculatePreparationTime(
      restaurantId,
      payloadMeals.length
    );

    // Definição de trabalhador padrão
    const worker = {
      name: "Funcionário Padrão",
      email: "worker@example.com",
    };

    // Valida existência do restaurante e obtém dados de refeições
    const restDoc = await Restaurant.findById(restaurantId)
      .select("meals")
      .lean();

    if (!restDoc) {
      return res.status(404).json({ error: "Restaurante não encontrado" });
    }

    // Mapeia payload para doc de refeições completo
    const meals = payloadMeals.map((pm) => {
      const m = restDoc.meals.find((x) => x._id.toString() === pm._id);
      if (!m) {
        throw new Error(`Meal ${pm._id} não encontrada no restaurante`);
      }
      return {
        _id: m._id,
        name: m.name,
        description: m.description,
        category: m.category,
        images: m.images,
        sizes: pm.sizes,
      };
    });

    // Cria e guarda encomenda
    const order = new Order({
      customer,
      restaurant,
      restaurantId,
      worker,
      meals,
      preparationTime,
      currentStatus: "Ordered",
    });
    const saved = await order.save();
    emitter.emit("order-updated", saved);

    const response = { ...saved.toObject(), pickupCode };
    return res.status(201).json(response);
  } catch (err) {
    console.error("Erro em createOrder:", err);
    return next(err);
  }
};

/**
 * Stream de Server-Sent Events para atualizações de encomendas.
 * Mantém conexão aberta e envia eventos 'order-updated'.
 *
 * @param {Express.Request} req - Objeto de requisição.
 * @param {Express.Response} res - Objeto de resposta configurado para SSE.
 */
exports.streamOrders = (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no",
  });
  res.write(":\n\n");
  const onUpdate = (orderDoc) => {
    const payload = {
      type: "order-updated",
      order: orderDoc,
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  emitter.on("order-updated", onUpdate);

  req.on("close", () => {
    emitter.off("order-updated", onUpdate);
  });
};

/**
 * Obtém encomenda pendente (Ordered/Preparing/Ready) do cliente.
 *
 * @async
 * @param {Express.Request} req - Objeto de requisição com req.user.email.
 * @param {Express.Response} res - Objeto de resposta com encomenda ou null.
 * @param {Function} next - Próximo middleware de erro.
 */
exports.getClientPending = async function (req, res, next) {
  try {
    const clientEmail = req.user.email;
    const host = `${req.protocol}://${req.get("host")}`;

    // Procura encomenda pendente
    const pending = await Order.findOne({
      "customer.email": clientEmail,
      canceledMeal: false,
      currentStatus: { $in: ["Ordered", "Preparing", "Ready"] },
    }).lean();
    if (!pending) {
      return res.json(null);
    }

    // Formata objeto de resposta
    const full = {
      _id: pending._id.toString(),
      customer: pending.customer,
      restaurant: pending.restaurant,
      restaurantId: pending.restaurantId.toString(),
      worker: pending.worker,
      meals: pending.meals.map((m) => ({
        _id: m._id.toString(),
        name: m.name,
        description: m.description,
        sizes: m.sizes,
        category: m.category,
        images: m.images.map((img) => ({
          imagePath: `${host}/uploads/${img.imagePath}`,
        })),
      })),
      canceledMeal: pending.canceledMeal,
      createdAt: pending.createdAt.toISOString(),
      deliveredAt: pending.deliveredAt,
      currentStatus: pending.currentStatus,
      preparationTime: pending.preparationTime,
    };

    return res.json(full);
  } catch (err) {
    return next(err);
  }
};

/**
 * Cancela encomenda do cliente e potencialmente adiciona à blacklist.
 * Utiliza transação para garantir atomicidade.
 *
 * @async
 * @param {Express.Request} req - Requisição Express com params.id e req.user.email.
 * @param {Express.Response} res - Resposta Express com resultado do cancelamento.
 * @param {Function} next - Próximo middleware de erro.
 */
exports.cancelOrder = async function (req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const orderId = req.params.id;
    const clientEmail = req.user.email;

    // Verifica existência de encomenda
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Encomenda não encontrada" });
    }
    // Só permite cancelamento se status for 'Ordered'
    if (order.currentStatus !== "Ordered") {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ error: "Não podes cancelar fora do prazo" });
    }
    // Marca como cancelado e atualiza timestamp
    order.canceledMeal = true;
    order.updatedAt = new Date();
    await order.save({ session });

    // Conta cancelamentos dos últimos 30 dias
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cancelCount = await Order.countDocuments({
      "customer.email": clientEmail,
      canceledMeal: true,
      updatedAt: { $gte: cutoff },
    }).session(session);

    // Se exceder 5 cancelamentos, adiciona à blacklist
    if (cancelCount >= 5) {
      const client = await Client.findOne({ email: clientEmail }).session(
        session
      );
      if (client) {
        await Blacklist.findOneAndUpdate(
          { clientId: client._id },
          {
            reason: `5 cancelamentos em 30 dias (${cancelCount})`,
            blacklistedAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          },
          {
            upsert: true,
            new: true,
            runValidators: true,
            context: "query",
            session,
          }
        );
      }
    }

    await session.commitTransaction();
    session.endSession();
    // Emite evento de atualização e retorna resultado
    const payload = { type: "order-updated", order: order.toObject() };
    emitter.emit("order-updated", payload);
    res.json({
      ok: true,
      canceledOrderId: orderId,
      cancelCount,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[cancelOrder] erro:", err);
    return res
      .status(500)
      .json({ error: "Erro interno ao cancelar a encomenda." });
  }
};

/**
 * Bloqueia novas encomendas se existir entrada válida.
 *
 * @async
 * @param {Express.Request} req - Requisição Express com req.user.id.
 * @param {Express.Response} res - Resposta Express ou próximo middleware.
 * @param {Function} next - Próximo middleware.
 */
exports.checkBlacklist = async function (req, res) {
  const clientId = req.user.id;
  const now = new Date();
  const entry = await Blacklist.findOne({ clientId, expiresAt: { $gt: now } });
  if (entry) {
    return res.status(403).json({
      error: "Estás temporariamente impedido de fazer novas encomendas",
      reason: entry.reason,
      until: entry.expiresAt.toISOString(),
    });
  }
  return res.status(200).json({ ok: true });
};
