/**
 * @fileoverview Controllers para gestão de restaurantes e comentários.
 * Inclui rotas para listar restaurantes, filtrar por localização, obter detalhes, gerir menus e comentários de clientes.
 */

// Importação de modelos e dependências
const { Restaurant } = require("../../models/Restaurants");
const RestaurantsCategory = require("../../models/RestaurantsCategory");
const { calculateDistances } = require("../ExternalAPI/geoAddress");
const Comment = require("../../models/Comment");

/**
 * Obtém todos os restaurantes aprovados pelo administrador.
 *
 * @async
 * @function getRestaurants
 * @param {Express.Request} req - Objeto de requisição Express.
 * @param {Express.Response} res - Objeto de resposta Express.
 * @param {Function} next - Middleware para tratamento de erros.
 * @returns {Promise<Express.Response>} Lista de restaurantes em JSON.
 */
exports.getRestaurants = async function (req, res, next) {
  try {
    const restaurants = await Restaurant.find({ approvedByAdmin: true }).lean();

    return res.json(restaurants);
  } catch (err) {
    return next(err);
  }
};

/**
 * Obtém dados de um restaurante específico pelo seu ID.
 *
 * @async
 * @function getRestaurantById
 * @param {Express.Request} req - Requisição Express com params.id.
 * @param {Express.Response} res - Resposta Express.
 * @param {Function} next - Middleware de erro.
 * @returns {Promise<Express.Response>} Objeto do restaurante ou erro 404.
 */
exports.getRestaurantById = async function (req, res, next) {
  const { id } = req.params;
  try {
    const rest = await Restaurant.findById(id).lean();

    if (!rest)
      return res.status(404).json({ error: "Restaurante não encontrado" });
    return res.json(rest);
  } catch (err) {
    return next(err);
  }
};

/**
 * Lista restaurantes próximos de uma localização fornecida e filtra por tipo e categoria.
 *
 * @async
 * @function getRestaurantsByLocation
 * @param {Express.Request} req - Requisição Express com query params lat, lon, type e category.
 * @param {Express.Response} res - Resposta Express com lista de restaurantes próximos.
 * @param {Function} next - Middleware para erros.
 * @returns {Promise<Express.Response>} Restaurantes filtrados com distância e categorias.
 */
exports.getRestaurantsByLocation = async function (req, res, next) {
  const maxLocationFromClient = 30;

  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const type = req.query.type === "delivery" ? "delivery" : "pickup";
    const category = req.query.category;

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res
        .status(400)
        .json({ error: "Query params lat e lon são obrigatórios e numéricos" });
    }

    const all = await Restaurant.find({ approvedByAdmin: true }).lean();

    // Extrai coordenadas dos restaurantes
    const destCoords = all.map((r) => r.location.coordinates);

    // Calcula distâncias em batch
    const dists = await calculateDistances({ lat, lon }, destCoords);
    if (!dists) throw new Error("Falha ao calcular distâncias em batch");

    // Mapeia categorias para nomes
    const allCats = await RestaurantsCategory.find().lean();
    const catMap = allCats.reduce((m, c) => ((m[c._id] = c.name), m), {});

    // Filtra restaurantes dentro do alcance e da categoria desejada
    const nearby = all.reduce((arr, r, i) => {
      const dist = dists[i];
      const range =
        type === "delivery" ? r.maxDeliveryRange || 0 : maxLocationFromClient;
      if (dist <= range) {
        const names = (r.categories || []).map(
          (id) => catMap[id.toString()] || "Desconhecido"
        );
        if (!category || names.includes(category)) {
          arr.push({ ...r, distance: dist, categoriesNames: names });
        }
      }
      return arr;
    }, []);

    return res.json(nearby);
  } catch (err) {
    return next(err);
  }
};

/**
 * Obtém refeições ativas de um menu específico de um restaurante.
 *
 * @async
 * @function getMealsByMenu
 * @param {Express.Request} req - Requisição com params.restaurantId e params.menuId.
 * @param {Express.Response} res - Resposta com lista de refeições ou erro.
 * @param {Function} next - Middleware de erro.
 * @returns {Promise<Express.Response>} Lista de refeições JSON.
 */
exports.getMealsByMenu = async function (req, res, next) {
  try {
    const { restaurantId, menuId } = req.params;
    const rest = await Restaurant.findById(restaurantId).lean();
    if (!rest) {
      return res.status(404).json({ error: "Restaurante não encontrado" });
    }

    const menu = rest.menu.find(
      (m) => String(m._id) === String(menuId) && m.isActive
    );
    if (!menu) {
      return res.status(404).json({ error: "Menu não encontrado ou inativo" });
    }

    const menuMealIds = menu.meals.map((mid) => String(mid));

    const meals = rest.meals.filter((meal) =>
      menuMealIds.includes(String(meal._id))
    );

    return res.json(meals);
  } catch (err) {
    console.error("Erro em getMealsByMenu:", err);
    return next(err);
  }
};

/**
 * Cria um comentário para um restaurante com texto e até 3 imagens em base64.
 *
 * @async
 * @function createComment
 * @param {Express.Request} req - Requisição com body.text, body.restaurantId e body.images.
 * @param {Express.Response} res - Resposta com comentário criado ou erro.
 * @param {Function} next - Middleware de erro.
 * @returns {Promise<Express.Response>} Comentário em JSON.
 */
exports.createComment = async (req, res, next) => {
  try {
    const { text, restaurantId, images } = req.body;
    const clientId = req.user.id;

    const imgsArray = Array.isArray(images) ? images : [];
    if (imgsArray.length > 3) {
      return res.status(400).json({ error: "Máx. 3 imagens." });
    }
    for (const b64 of imgsArray) {
      if (typeof b64 !== "string" || !b64.startsWith("data:image/")) {
        return res.status(400).json({ error: "Imagem inválida." });
      }
    }

    const imageDocs = imgsArray.map((b64) => ({ imagePath: b64 }));

    const comment = new Comment({
      clientId,
      restaurantId,
      text,
      images: imageDocs,
    });
    await comment.save();
    return res.status(201).json(comment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno." });
  }
};

/**
 * Lista comentários associados a um restaurante, ordenados por data.
 *
 * @async
 * @function listCommentsByRestaurant
 * @param {Express.Request} req - Requisição com params.restaurantId.
 * @param {Express.Response} res - Resposta com lista de comentários.
 * @param {Function} next - Middleware de erro.
 * @returns {Promise<Express.Response>} Array de comentários.
 */
exports.listCommentsByRestaurant = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const comments = await Comment.find({ restaurantId })
      .sort({ createdAt: -1 })
      .populate("clientId", "name");

    res.json(comments);
  } catch (err) {
    next(err);
  }
};

/**
 * Lista todas as categorias de restaurantes disponíveis.
 *
 * @async
 * @function listCategories
 * @param {Express.Request} req - Requisição Express.
 * @param {Express.Response} res - Resposta com categorias.
 * @param {Function} next - Middleware de erro.
 * @returns {Promise<Express.Response>} Array de categorias.
 */
exports.listCategories = async (req, res, next) => {
  try {
    const cats = await RestaurantsCategory.find().sort("name").lean();
    res.json(cats);
  } catch (err) {
    next(err);
  }
};
