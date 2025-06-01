const express = require("express");
const router = express.Router();
const authAPIController = require("../../controllers/RESTAPI/auth");
const clientController = require("../../controllers/RESTAPI/clientProfile");

router.get(
  "/profile",
  authAPIController.authenticateClient,
  clientController.getProfile
);
router.patch(
  "/updateProfile",
  authAPIController.authenticateClient,
  clientController.updateProfile
);
router.put(
  "/updatePassword",
  authAPIController.authenticateClient,
  clientController.updatePassword
);
router.put(
  "/delivery-location",
  authAPIController.authenticateClient,
  clientController.updateDeliveryLocation
);
module.exports = router;
