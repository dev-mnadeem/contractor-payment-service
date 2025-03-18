"use strict";

const express = require("express");

const { createBalancesController } = require("../controllers/balances.controller");
const { asyncHandler } = require("../middleware/errorHandler");

function createBalancesRouter(services) {
  const router = express.Router();
  const controller = createBalancesController(services);

  /**
   * @openapi
   * /balances/deposit/{userId}:
   *   post:
   *     tags: [Balances]
   *     summary: Top up a client's balance
   *     description: >
   *       `userId` must equal the calling profile — a profile may only fund
   *       itself. The deposit may not exceed 25% of the total currently owed
   *       across the client's unpaid jobs, measured inside the same transaction
   *       as the credit.
   *     parameters:
   *       - $ref: '#/components/parameters/ProfileId'
   *       - in: path
   *         name: userId
   *         required: true
   *         schema: { type: integer }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [amount]
   *             properties:
   *               amount:
   *                 description: Decimal amount with at most two places, e.g. "50.00".
   *                 oneOf: [{ type: string }, { type: number }]
   *     responses:
   *       200: { description: Deposit accepted, returns the updated profile }
   *       400: { description: Malformed amount, or the 25% cap was exceeded }
   *       401: { $ref: '#/components/responses/Error' }
   *       403: { description: Not a client, or depositing into someone else's balance }
   */
  router.post("/deposit/:userId", asyncHandler(controller.deposit));

  return router;
}

module.exports = { createBalancesRouter };
