"use strict";

const { createContractsRepository } = require("./repositories/contracts.repository");
const { createJobsRepository } = require("./repositories/jobs.repository");
const { createPaymentsRepository } = require("./repositories/payments.repository");
const { createProfilesRepository } = require("./repositories/profiles.repository");
const { createBalancesService } = require("./services/balances.service");
const { createContractsService } = require("./services/contracts.service");
const { createJobsService } = require("./services/jobs.service");
const { createPaymentsService } = require("./services/payments.service");
const { createReportsService } = require("./services/reports.service");

/**
 * Wires repositories and services over a given Sequelize instance and model
 * set. Nothing below the routes reaches for a module-level singleton, so the
 * test suite builds the same graph over an in-memory database and exercises
 * real SQL instead of asserting on mocked ORM call arguments.
 */
function createContainer({ sequelize, models }) {
  const contracts = createContractsRepository(models);
  const jobs = createJobsRepository(models);
  const payments = createPaymentsRepository(models);
  const profiles = createProfilesRepository(models);

  return {
    sequelize,
    models,
    repositories: { contracts, jobs, payments, profiles },
    services: {
      balances: createBalancesService({ sequelize, jobs, profiles }),
      contracts: createContractsService({ contracts }),
      jobs: createJobsService({ jobs }),
      payments: createPaymentsService({ sequelize, jobs, profiles, payments }),
      reports: createReportsService({ jobs }),
    },
  };
}

module.exports = { createContainer };
