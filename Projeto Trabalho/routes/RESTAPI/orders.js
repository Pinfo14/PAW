const express = require("express");
const router = express.Router();
const authAPIController = require("../../controllers/RESTAPI/auth");
const ordersAPIController = require("../../controllers/RESTAPI/orders");

router.get(
  "/historico",
  authAPIController.authenticateClient,
  ordersAPIController.listDeliveredOrCanceled
);
router.post(
  "/validateDelivery",
  authAPIController.authenticateClient,
  ordersAPIController.validateDelivery
);
router.post(
  "/createOrder",
  authAPIController.authenticateClient,
  ordersAPIController.createOrder
);
router.get("/stream", ordersAPIController.streamOrders);
router.get(
  "/pending",
  authAPIController.authenticateClient,
  ordersAPIController.getClientPending
);
router.post(
  "/:id/cancel",
  authAPIController.authenticateClient,
  ordersAPIController.cancelOrder
);
router.get(
  "/checkBlacklist",
  authAPIController.authenticateClient,
  ordersAPIController.checkBlacklist
);
module.exports = router;
