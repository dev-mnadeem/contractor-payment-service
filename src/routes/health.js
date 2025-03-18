"use strict";

const express = require("express");

const { createHealthController } = require("../controllers/health.controller");
const { asyncHandler } = require("../middleware/errorHandler");

function createHealthRouter({ sequelize }) {
  const router = express.Router();
  const controller = createHealthController({ sequelize });

  /**
   * @openapi
   * /healthz:
   *   get:
   *     tags: [Operations]
   *     summary: Liveness probe
   *     responses:
   *       200: { description: The process is running }
   */
  router.get("/healthz", controller.live);

  /**
   * @openapi
   * /readyz:
   *   get:
   *     tags: [Operations]
   *     summary: Readiness probe
   *     description: Answers 503 when the database file cannot be opened.
   *     responses:
   *       200: { description: Database reachable }
   *       503: { description: Database unreachable }
   */
  router.get("/readyz", asyncHandler(controller.ready));

  return router;
}

module.exports = { createHealthRouter };
