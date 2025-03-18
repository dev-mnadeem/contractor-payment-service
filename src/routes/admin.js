"use strict";

const express = require("express");

const { createAdminController } = require("../controllers/admin.controller");
const { asyncHandler } = require("../middleware/errorHandler");

function createAdminRouter(services) {
  const router = express.Router();
  const controller = createAdminController(services);

  /**
   * @openapi
   * /admin/best-profession:
   *   get:
   *     tags: [Admin]
   *     summary: The profession that earned the most in a date range
   *     description: Requires an administrator profile.
   *     parameters:
   *       - $ref: '#/components/parameters/ProfileId'
   *       - in: query
   *         name: start
   *         required: true
   *         schema: { type: string, format: date }
   *       - in: query
   *         name: end
   *         required: true
   *         schema: { type: string, format: date }
   *     responses:
   *       200: { description: "{ profession, totalEarned }" }
   *       400: { description: Missing or unparseable dates }
   *       403: { description: Not an administrator }
   *       404: { description: No jobs were paid in that range }
   */
  router.get("/best-profession", asyncHandler(controller.bestProfession));

  /**
   * @openapi
   * /admin/best-clients:
   *   get:
   *     tags: [Admin]
   *     summary: The clients who paid the most in a date range
   *     description: Requires an administrator profile. `limit` defaults to 2 and is capped at 100.
   *     parameters:
   *       - $ref: '#/components/parameters/ProfileId'
   *       - in: query
   *         name: start
   *         required: true
   *         schema: { type: string, format: date }
   *       - in: query
   *         name: end
   *         required: true
   *         schema: { type: string, format: date }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, minimum: 1, maximum: 100, default: 2 }
   *     responses:
   *       200: { description: Ranked clients, highest spend first }
   *       400: { description: Missing dates or a malformed limit }
   *       403: { description: Not an administrator }
   */
  router.get("/best-clients", asyncHandler(controller.bestClients));

  return router;
}

module.exports = { createAdminRouter };
