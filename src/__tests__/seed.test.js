"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Seeding has to be safe to repeat: refreshing the demo data should converge
 * on the fixture rather than destroy the database or trip a unique constraint.
 * These tests pin that contract.
 */

let directory;
let seed;
let models;

beforeAll(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "cps-seed-"));
  process.env.DB_STORAGE = path.join(directory, "seed.sqlite3");
  jest.resetModules();
  ({ seed } = require("../../scripts/seedDb"));
  models = require("../model");
});

afterAll(async () => {
  await models.sequelize.close();
  fs.rmSync(directory, { recursive: true, force: true });
  delete process.env.DB_STORAGE;
});

describe("seedDb", () => {
  it("creates the demo dataset", async () => {
    const counts = await seed({ force: true });
    expect(counts).toEqual({
      profiles: 9,
      contracts: 9,
      jobs: 14,
      payments: 9,
      unpaidJobs: 5,
    });
  });

  it("is idempotent — a second run does not duplicate rows", async () => {
    const first = await seed({ force: false });
    const second = await seed({ force: false });
    expect(second).toEqual(first);
  });

  it("restores fixture state that has drifted", async () => {
    await seed({ force: false });
    await models.Job.update({ paid: true, paymentDate: new Date() }, { where: { id: 2 } });
    expect(await models.Job.count({ where: { paid: false } })).toBe(4);

    await seed({ force: false });
    expect(await models.Job.count({ where: { paid: false } })).toBe(5);
  });

  it("gives every paid job a matching ledger row", async () => {
    await seed({ force: true });
    const paidJobs = await models.Job.findAll({ where: { paid: true } });
    for (const job of paidJobs) {
      expect(await models.Payment.count({ where: { JobId: job.id } })).toBe(1);
    }
  });

  it("stores every amount as an integer number of cents", async () => {
    await seed({ force: true });
    const jobs = await models.Job.findAll();
    const profiles = await models.Profile.findAll();
    for (const job of jobs) expect(Number.isInteger(Number(job.priceCents))).toBe(true);
    for (const profile of profiles) {
      expect(Number.isInteger(Number(profile.balanceCents))).toBe(true);
    }
  });

  it("includes exactly one administrator", async () => {
    await seed({ force: true });
    expect(await models.Profile.count({ where: { isAdmin: true } })).toBe(1);
  });
});
