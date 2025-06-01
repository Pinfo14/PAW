const express = require("express");
const router = express.Router();
const authAPIController = require("../../controllers/RESTAPI/auth");

router.post("/login", authAPIController.login);
router.post("/register", authAPIController.register);

module.exports = router;
