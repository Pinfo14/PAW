const express = require("express");
const router = express.Router();
const restaurantsRESTAPI = require("../../controllers/RESTAPI/restaurants");
const authAPIController = require("../../controllers/RESTAPI/auth");

router.get("/", restaurantsRESTAPI.getRestaurants);
router.get("/categories", restaurantsRESTAPI.listCategories);
router.get(
  "/:restaurantId/menus/:menuId/meals",
  restaurantsRESTAPI.getMealsByMenu
);
router.get("/location", restaurantsRESTAPI.getRestaurantsByLocation);
router.get("/:id", restaurantsRESTAPI.getRestaurantById);
router.post(
  "/comment/create",
  authAPIController.authenticateClient,
  restaurantsRESTAPI.createComment
);
router.get(
  "/comment/:restaurantId",
  restaurantsRESTAPI.listCommentsByRestaurant
);

module.exports = router;
