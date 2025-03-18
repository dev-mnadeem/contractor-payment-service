"use strict";

const express = require("express");

const { createPaymentsController } = require("../controllers/payments.controller");
const { asyncHandler } = require("../middleware/errorHandler");

function createPaymentsRouter(services) {
  const router = express.Router();
  const controller = createPaymentsController(services);

  /**
   * @openapi
   * /payments:
   *   get:
   *     tags: [Payments]
   *     summary: The caller's settled payments, as payer or payee
   *     description: Newest first. This is the append-only ledger behind every balance change.
   *     parameters:
   *       - $ref: '#/components/parameters/ProfileId'
   *       - $ref: '#/components/parameters/Limit'
   *       - $ref: '#/components/parameters/Offset'
   *     responses:
   *       200: { description: A page of payments }
   *       401: { $ref: '#/components/responses/Error' }
   */
  router.get("/", asyncHandler(controller.list));

  return router;
}

module.exports = { createPaymentsRouter };
