const express = require("express");
const router = express.Router();
const geoController = require("../../controllers/RESTAPI/geo");

router.post("/", geoController.getCoords);
router.post("/distance", geoController.getDistance);

module.exports = router;
