"use strict";

const express = require("express");
const swaggerUi = require("swagger-ui-express");

const { createContainer } = require("./container");
const defaultModels = require("./model");
const { createGetProfile } = require("./middleware/getProfile");
const { asyncHandler, errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { requireAdmin } = require("./middleware/requireAdmin");
const { buildOpenApiSpec } = require("./openapi");
const { createAdminRouter } = require("./routes/admin");
const { createBalancesRouter } = require("./routes/balances");
const { createContractsRouter } = require("./routes/contracts");
const { createHealthRouter } = require("./routes/health");
const { createJobsRouter } = require("./routes/jobs");
const { createPaymentsRouter } = require("./routes/payments");

const JSON_BODY_LIMIT = "100kb";

/**
 * Build the Express application over a given container. The default container
 * is the one wired to the configured SQLite file, but the test suite passes its
 * own so a request can be driven end to end against an in-memory database.
 */
function createApp(container = defaultContainer()) {
  const { services, models, sequelize } = container;

  const app = express();
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.disable("x-powered-by");

  const getProfile = asyncHandler(createGetProfile({ models }));

  app.use(createHealthRouter({ sequelize }));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(buildOpenApiSpec()));

  app.use("/contracts", getProfile, createContractsRouter(services));
  app.use("/jobs", getProfile, createJobsRouter(services));
  app.use("/balances", getProfile, createBalancesRouter(services));
  app.use("/payments", getProfile, createPaymentsRouter(services));
  app.use("/admin", getProfile, requireAdmin, createAdminRouter(services));

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.set("container", container);
  return app;
}

function defaultContainer() {
  const { sequelize, ...models } = defaultModels;
  return createContainer({
    sequelize,
    models: {
      Profile: models.Profile,
      Contract: models.Contract,
      Job: models.Job,
      Payment: models.Payment,
    },
  });
}

module.exports = { createApp, defaultContainer };
