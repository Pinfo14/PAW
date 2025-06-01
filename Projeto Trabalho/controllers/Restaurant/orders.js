/**
 * @fileoverview Controller para gestão de encomendas no restaurante.
 * Inclui listagem, criação, atualização de estado, cancelamento e configuração de tempo de preparação.
 */

const mongoose = require('mongoose');
const MealCategory = require('../../models/MealCategory');
const Order = require('../../models/Orders');
const { Restaurant } = require('../../models/Restaurants');
const { Client } = require('../../models/Users');
const  {emitter }  = require('../RESTAPI/sse');
// Armazena o tempo de preparação médio por restaurante
const prepTime = {};

/**
 * Exibe a lista de encomendas do restaurante, com dropdown de datas e tempo de preparação.
 *
 * @async
 * @function getOrders
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.getOrders = async function(req, res, next) {
  const restActualId = res.locals.restId;
 
  try {
    // Pesquisa e ordena encomendas
    const orders = await Order.find({ restaurantId: restActualId })
      .sort({ createdAt: -1 })
      .exec();

    // Extrái datas únicas para filtros
    const datesSet = new Set(
      orders.map(o => o.createdAt.toISOString().split('T')[0])
    );
    const dates = Array.from(datesSet);

    // Gera IDs decrescentes por dia para apresentação
    const countMap = {};
    orders.forEach(order => {
      const day = order.createdAt.toISOString().split('T')[0];
      countMap[day] = (countMap[day] || 0) + 1;
    });
    const seqMap = {};
    orders.forEach(order => {
      const day = order.createdAt.toISOString().split('T')[0];
      seqMap[day] = seqMap[day] || countMap[day];
      order.customId = seqMap[day]--;
    });

    // Obtém tempo de preparação configurado ou default
    const currentPrepTime = prepTime[restActualId] || 3;

    // Renderiza view com layout dinâmico conforme o tipo de utilizador
    res.render('restAdmin/orders/order', {
      layout: req.userRole === 'RestAdmin'
        ? 'layout/restAdminLayout'
        : 'layout/restWorkerLayout',
      restActualId,
      orders,
      dates,
      currentPrepTime
    });
  } catch (err) {
    console.error('Erro ao buscar encomendas:', err);
    next(err);
  }
};

/**
 * Exibe o formulário para adicionar uma encomenda nova.
 * Preenche dropdown de menus ativos e lista de clientes.
 *
 * @async
 * @function getAddOrderForm
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.getAddOrderForm = async function(req, res, next) {
  try {
    const restActualId = res.locals.restId;
    const restaurant = await Restaurant.findById(restActualId).exec();
    if (!restaurant) return res.status(404).send('Restaurante não encontrado');

    // Monta lista de menus ativos com os respetivos pratos (subdocumentos)
    const activeMenus = restaurant.menu
      .filter(menu => menu.isActive)
      .map(menu => ({
        _id: menu._id,
        name: menu.name,
        isActive: menu.isActive,
        meals: menu.meals
          .map(id => restaurant.meals.id(id))
          .filter(Boolean)
      }));

    const defaultPreparationTime = 5;
    const clients = await Client.find().lean();
    const newClientId = req.query.newClientId || null;

    res.render('restAdmin/orders/addOrder', {
      error: req.query.error || null,
      layout: req.userRole === 'RestAdmin'
        ? 'layout/restAdminLayout'
        : 'layout/restWorkerLayout',
      restActualId,
      activeMenus,
      defaultPreparationTime,
      clients,
      newClientId
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Encontra ou cria cliente conforme modo (existing, placeholder ou new). Não altera documentos existentes.
 * $refactor: findClient e CreateClient
 * @async
 * @function findOrCreateClient
 * @param {Object} opts - Opções de pesquisa/criação de cliente.
 * @param {string} opts.mode - 'existing' para usar cliente existente.
 * @param {string} opts.existingClientId
 * @param {string} opts.customerEmail
 * @param {string} opts.customerName
 * @param {string} opts.customerNif
 * @param {string} opts.customerContact
 * @param {string} opts.customerCompanyName
 * @returns {Promise<Client>} Documento de cliente encontrado ou criado.
 */
async function findOrCreateClient({ mode, existingClientId, customerEmail,
  customerName, customerNif, customerContact, customerCompanyName }) {
  if (mode === 'existing' && existingClientId) {
    const client = await Client.findById(existingClientId);

    if (!client) throw new Error('Cliente não encontrado');
    return client;
  }

  const emailToUse = customerEmail?.trim()
    ? customerEmail.trim()
    : `${customerNif || 'unknown'}@noemail.com`;

  if (!customerEmail?.trim()) {
    const placeholder = await Client.findOne({ email: emailToUse });
    if (placeholder) return placeholder;
  }

  const data = {
    email: emailToUse,
    name: customerName?.trim() || 'Sem Nome',
    nif: customerNif?.trim() || '000000000',
    contact: customerContact?.trim() || '200000000',
    companyName: /^[568]/.test(customerNif || '')
      ? (customerCompanyName?.trim() || '')
      : undefined,
    location: { address: { street: 'Desconhecido', postalCode: '0000-000', city: 'Desconhecido'},
                coordinates: { lat: 0, lon: 0 } },
    deliveryLocation: { address: { street: 'Desconhecido', postalCode: '0000-000', city: 'Desconhecido'},
                        coordinates: { lat: 0, lon: 0 } }
  };
  return Client.create(data);
}

/**
 * Constrói itens da encomenda a partir de JSON, incluindo a "snapshot" do prato e tamanho escolhido.
 *
 * @function buildOrderItems
 * @param {string} itemsJson - JSON string de itens ({ mealId, size, price }[]).
 * @param {Object} restaurant - Documento lean do restaurante com meals embutidos.
 * @returns {Object[]} Array de objetos de refeição com chosenSize.
 */
function buildOrderItems(itemsJson, restaurant) {
  const parsed = JSON.parse(itemsJson);

  return parsed.map(i => {
    const mealDoc = restaurant.meals.find(m => m._id.toString() === i.mealId);

    if (!mealDoc) throw new Error(`Prato ${i.mealId} não encontrado`);

    // Encontra apenas o tamanho do prato que foi passado no front (i.size)
    const sizeObj = mealDoc.sizes.find(s => s.name === i.size);
    if (!sizeObj) throw new Error(`Tamanho "${i.size}" não encontrado para o prato ${i.mealId}`);

    const mealObj = JSON.parse(JSON.stringify(mealDoc));

    mealObj.sizes = [ sizeObj ];
    mealObj.chosenSize = sizeObj;

    return mealObj;
  });
}

/**
 * Calcula tempo de preparação: tempo por meal/prato + soma de tempos de 
 * pedidos pendentes (Pedido ou em Preparação) com a data do mesmo dia.
 *
 * @async
 * @function calculatePreparationTime
 * @param {string} restActualId
 * @param {number} itemCount
 * @returns {Promise<number>} Tempo total em minutos.
 */
async function calculatePreparationTime(restActualId, itemCount) {
  const defaultMealPrepTime = 3;
  const minutesPerItem = prepTime[restActualId] || defaultMealPrepTime;
  const baseTime = itemCount * minutesPerItem;

  const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
  const endOfDay   = new Date(); endOfDay.setHours(23,59,59,999);

  const pendings = await Order.find({
    restaurantId: restActualId,
    canceledMeal: false,
    currentStatus: { $in: ['Ordered','Preparing'] },
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  });

  const sumPending = pendings.reduce((sum, o) => sum + o.preparationTime, 0);
  return baseTime + sumPending;
}

/**
 * Atualiza tempo médio de preparação no controlador em memória e redireciona.
 *
 * @function setPreparationTime
 */
exports.setPreparationTime = function(req, res) {
  const restActualId = res.locals.restId;
  const newTime = parseInt(req.body.minutes);
  if (!isNaN(newTime) && newTime > 0) {
    prepTime[restActualId] = newTime;
  }
  res.redirect('/rest/orders');
};

/**
 * Cria uma nova encomenda, incluindo "snapshot" completo de cliente e restaurante.
 *
 * @async
 * @function postAddOrder
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.postAddOrder = async function(req, res, next) {
  try {
    const { mode, existingClientId, customerName, customerEmail,
      customerNif, customerContact, customerCompanyName, items } = req.body;
    const restActualId = res.locals.restId;

    // Pesquisa ou cria cliente
    let client;
    if (mode === 'existing') {
      client = await Client.findById(existingClientId).lean();
      if (!client) return res.status(404).send('Cliente não encontrado');
    } else {
      client = await findOrCreateClient({ mode, existingClientId,
        customerName, customerEmail, customerNif, customerContact, customerCompanyName });
    }

    // Carrega restaurante
    const restaurant = await Restaurant.findById(restActualId).lean();
    if (!restaurant) return res.status(404).send('Restaurante não encontrado');

    // Extrai nomes únicos de categorias para "snapshot"
    const allCatIds = restaurant.meals.flatMap(m => m.category || []);
    const cats = await MealCategory.find({ _id: { $in: allCatIds } }).lean();
    const catNames = [...new Set(cats.map(c => c.name))];

    const orderItems = buildOrderItems(items, restaurant);
    const preparationTime = await calculatePreparationTime(restActualId, orderItems.length);

    // Constrói documento da encomenda
    const orderDoc = {
      customer: {
        name: client.name,
        email: client.email,
        nif: client.nif,
        contact: client.contact,
        companyName: client.companyName || '',
        role: client.role,
        location: client.location,
        deliveryLocation: client.deliveryLocation
      },
      restaurant: {
        name: restaurant.name,
        location: restaurant.location,
        categories: catNames
      },
      worker: {
        name: req.user.name,
        email: req.user.email
      },
      meals: orderItems,
      preparationTime,
      restaurantId: restActualId
    };

    await Order.create(orderDoc);
    res.redirect('/rest/orders');
  } catch (err) {
    next(err);
  }
};

/**
 * Atualiza estado de uma encomenda (preparing, ready, delivered).
 *
 * @async
 * @function updateOrderStatus
 */
exports.updateOrderStatus = async function(req, res, next) {
  try {
    const { id } = req.params;
    const newStatus = req.body.next;
    const update = { currentStatus: newStatus };
    if (newStatus === 'Delivered') update.deliveredAt = Date.now();

    const updatedOrder = await Order.findByIdAndUpdate(id, update, { runValidators: true, new: true });
    // emite o SSE
    emitter.emit('order-updated', {
      type:  'order-updated',
      order: updatedOrder.toObject()
    });


    res.redirect('/rest/orders');
  } catch (err) {
    next(err);
  }
};

/**
 * Marca uma encomenda como cancelada.
 *
 * @async
 * @function cancelOrder
 */
exports.cancelOrder = async function(req, res, next) {
  try {
    const { id } = req.params;
    const updatedOrder = await Order.findByIdAndUpdate(id, { canceledMeal: true });
    emitter.emit('order-updated', {
      type:  'order-updated',
      order: updatedOrder.toObject()
    });

    res.redirect('/rest/orders');
  } catch (err) {
    next(err);
  }
};
