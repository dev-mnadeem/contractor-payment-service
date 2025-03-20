"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const { createApp } = require("../../app");
const { createContainer } = require("../../container");
const { createSequelize } = require("../../db");
const { defineModels } = require("../../model");
const money = require("../../money");

/**
 * Each suite gets its own SQLite file rather than `:memory:`, because the
 * concurrency tests need several connections looking at the same database.
 * The container is built by the same factory the server uses, so these suites
 * exercise real SQL — including the conditional UPDATEs and unique indexes the
 * money guarantees rest on, which a mocked ORM cannot show.
 */
async function createTestContext() {
  const storage = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cps-test-")), "test.sqlite3");
  const sequelize = createSequelize({ storage, logging: false });
  const models = defineModels(sequelize);
  await sequelize.sync({ force: true });

  const container = createContainer({ sequelize, models });
  const app = createApp(container);

  return {
    app,
    container,
    models,
    sequelize,
    storage,
    services: container.services,
    repositories: container.repositories,
    async close() {
      await sequelize.close();
      fs.rmSync(path.dirname(storage), { recursive: true, force: true });
    },
    async reset() {
      await sequelize.sync({ force: true });
    },
  };
}

/** Insert a client, a contractor, a contract and its jobs in one call. */
async function seedScenario(
  models,
  { clientBalance = "1000.00", jobs = [], status = "in_progress" } = {}
) {
  const client = await models.Profile.create({
    firstName: "Cora",
    lastName: "Client",
    profession: "Buyer",
    type: "client",
    balanceCents: money.toCents(clientBalance),
  });
  const contractor = await models.Profile.create({
    firstName: "Cal",
    lastName: "Contractor",
    profession: "Programmer",
    type: "contractor",
    balanceCents: 0,
  });
  const contract = await models.Contract.create({
    terms: "Test engagement",
    status,
    ClientId: client.id,
    ContractorId: contractor.id,
  });
  const createdJobs = [];
  for (const job of jobs) {
    createdJobs.push(
      await models.Job.create({
        description: job.description || "Test job",
        priceCents: money.toCents(job.price),
        paid: Boolean(job.paid),
        paymentDate: job.paid ? new Date() : null,
        ContractId: contract.id,
      })
    );
  }

  return { client, contractor, contract, jobs: createdJobs };
}

/** Re-read both balances from the database as integer cents. */
async function readBalances(models, clientId, contractorId) {
  const [client, contractor] = await Promise.all([
    models.Profile.findByPk(clientId),
    models.Profile.findByPk(contractorId),
  ]);
  return {
    client: money.fromDatabase(client.balanceCents),
    contractor: money.fromDatabase(contractor.balanceCents),
  };
}

module.exports = { createTestContext, readBalances, seedScenario };
