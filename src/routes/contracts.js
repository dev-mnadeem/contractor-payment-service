"use strict";

const express = require("express");

const { createContractsController } = require("../controllers/contracts.controller");
const { asyncHandler } = require("../middleware/errorHandler");

/**
 * @openapi
 * components:
 *   parameters:
 *     ProfileId:
 *       in: header
 *       name: profile_id
 *       required: true
 *       description: Identifies the calling profile.
 *       schema: { type: integer, minimum: 1 }
 *     Limit:
 *       in: query
 *       name: limit
 *       description: Page size. Defaults to 25, capped by MAX_PAGE_SIZE.
 *       schema: { type: integer, minimum: 1 }
 *     Offset:
 *       in: query
 *       name: offset
 *       description: Number of rows to skip.
 *       schema: { type: integer, minimum: 0 }
 *   responses:
 *     Error:
 *       description: "Error envelope: { error: { code, message } }"
 */
function createContractsRouter(services) {
  const router = express.Router();
  const controller = createContractsController(services);

  /**
   * @openapi
   * /contracts:
   *   get:
   *     tags: [Contracts]
   *     summary: List contracts the caller is a party to
   *     description: >
   *       Defaults to contracts in status `new` or `in_progress`. Pass
   *       `?status=terminated` (or a comma-separated list) to widen it.
   *     parameters:
   *       - $ref: '#/components/parameters/ProfileId'
   *       - $ref: '#/components/parameters/Limit'
   *       - $ref: '#/components/parameters/Offset'
   *       - in: query
   *         name: status
   *         schema: { type: string, example: in_progress }
   *     responses:
   *       200: { description: A page of contracts }
   *       400: { $ref: '#/components/responses/Error' }
   *       401: { $ref: '#/components/responses/Error' }
   */
  router.get("/", asyncHandler(controller.list));

  /**
   * @openapi
   * /contracts/{id}:
   *   get:
   *     tags: [Contracts]
   *     summary: Fetch one contract the caller is a party to
   *     description: >
   *       A contract belonging to another profile answers 404, not 403, so the
   *       endpoint cannot be used to discover which contract ids exist.
   *     parameters:
   *       - $ref: '#/components/parameters/ProfileId'
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: The contract }
   *       401: { $ref: '#/components/responses/Error' }
   *       404: { $ref: '#/components/responses/Error' }
   */
  router.get("/:id", asyncHandler(controller.getById));

  return router;
}

module.exports = { createContractsRouter };
