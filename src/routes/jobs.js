"use strict";

const express = require("express");

const { createJobsController } = require("../controllers/jobs.controller");
const { asyncHandler } = require("../middleware/errorHandler");

function createJobsRouter(services) {
  const router = express.Router();
  const controller = createJobsController(services);

  /**
   * @openapi
   * /jobs/unpaid:
   *   get:
   *     tags: [Jobs]
   *     summary: List the caller's unpaid jobs on active contracts
   *     description: >
   *       Only contracts in status `in_progress` are included. Returns an empty
   *       page when there is nothing outstanding.
   *     parameters:
   *       - $ref: '#/components/parameters/ProfileId'
   *       - $ref: '#/components/parameters/Limit'
   *       - $ref: '#/components/parameters/Offset'
   *     responses:
   *       200: { description: A page of unpaid jobs }
   *       401: { $ref: '#/components/responses/Error' }
   */
  router.get("/unpaid", asyncHandler(controller.listUnpaid));

  /**
   * @openapi
   * /jobs/{job_id}/pay:
   *   post:
   *     tags: [Jobs]
   *     summary: Settle a job from the client's balance
   *     description: >
   *       The amount is taken from the stored job price, never from the request
   *       body. Send an `Idempotency-Key` header to make a retry safe: repeating
   *       the same key returns the original payment with `replayed: true` and
   *       status 200 instead of moving money again.
   *     parameters:
   *       - $ref: '#/components/parameters/ProfileId'
   *       - in: path
   *         name: job_id
   *         required: true
   *         schema: { type: integer }
   *       - in: header
   *         name: Idempotency-Key
   *         required: false
   *         schema: { type: string, maxLength: 255 }
   *     responses:
   *       201: { description: Payment settled }
   *       200: { description: Replay of an earlier payment with the same Idempotency-Key }
   *       401: { $ref: '#/components/responses/Error' }
   *       404: { description: No payable job with that id belongs to this client }
   *       409: { description: Already paid, or the contract is terminated }
   *       422: { description: The client's balance does not cover the job price }
   */
  router.post("/:job_id/pay", asyncHandler(controller.pay));

  return router;
}

module.exports = { createJobsRouter };
