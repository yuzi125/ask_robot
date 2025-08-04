const express = require("express");
const router = express.Router();
const healthCheckController = require("../controller/system/healthCheck");

router.get("/serverHealthCheckList", healthCheckController.serverHealthCheckList);
router.get("/serverHealthRedisCheck", healthCheckController.serverHealthRedisCheck);
router.get("/serverHealthDbCheck", healthCheckController.serverHealthDbCheck);

router.get("/healthCheck", (req, res) => {
    res.status(200).send("ok");
});

module.exports = router;
