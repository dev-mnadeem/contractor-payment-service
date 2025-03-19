"use strict";

/**
 * Load the demo dataset.
 *
 *   npm run seed            idempotent — converges the database on the fixture
 *   npm run seed -- --force drop every table first, then recreate
 *
 * The default path is safe to run repeatedly: rows are written by primary key,
 * so a second run restores the fixture state rather than duplicating it or
 * failing on a unique constraint. Every paid job also gets its matching ledger
 * row, so `GET /payments` is populated from a cold start.
 */

const { sequelize, Profile, Contract, Job, Payment } = require("../src/model");
const money = require("../src/money");
const { contracts, jobs, profiles } = require("./fixtures");

async function seed({ force }) {
  await sequelize.sync({ force });

  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));

  await upsertAll(
    Profile,
    profiles.map((profile) => ({
      ...profile,
      isAdmin: Boolean(profile.isAdmin),
      balanceCents: money.toCents(profile.balance),
      balance: undefined,
    }))
  );

  await upsertAll(Contract, contracts);

  await upsertAll(
    Job,
    jobs.map((job) => ({
      ...job,
      priceCents: money.toCents(job.price),
      paymentDate: job.paymentDate ? new Date(job.paymentDate) : null,
      price: undefined,
    }))
  );

  await upsertAll(
    Payment,
    jobs
      .filter((job) => job.paid)
      .map((job) => {
        const contract = contractById.get(job.ContractId);
        return {
          id: job.id,
          JobId: job.id,
          ClientId: contract.ClientId,
          ContractorId: contract.ContractorId,
          amountCents: money.toCents(job.price),
          createdAt: new Date(job.paymentDate),
        };
      })
  );

  return {
    profiles: await Profile.count(),
    contracts: await Contract.count(),
    jobs: await Job.count(),
    payments: await Payment.count(),
    unpaidJobs: await Job.count({ where: { paid: false } }),
  };
}

/** Sequential rather than Promise.all: SQLite serialises writers anyway, and
 *  the fixture has foreign keys that must land in order. */
async function upsertAll(model, rows) {
  for (const row of rows) {
    await model.upsert(row);
  }
}

async function main() {
  const force = process.argv.slice(2).includes("--force");
  try {
    const counts = await seed({ force });
    console.log(
      `Seeded ${counts.profiles} profiles, ${counts.contracts} contracts, ` +
        `${counts.jobs} jobs (${counts.unpaidJobs} unpaid) and ${counts.payments} payments.`
    );
    console.log("Try:  curl -H 'profile_id: 1' http://localhost:3001/jobs/unpaid");
  } catch (error) {
    console.error(`Seeding failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { seed };
