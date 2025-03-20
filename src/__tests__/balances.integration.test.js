"use strict";

const request = require("supertest");

const money = require("../money");
const { createTestContext, seedScenario } = require("./helpers/testDb");

let ctx;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await ctx.reset();
});

const deposit = (profileId, targetId, body) =>
  request(ctx.app)
    .post(`/balances/deposit/${targetId}`)
    .set("profile_id", String(profileId))
    .send(body);

describe("POST /balances/deposit/:userId", () => {
  it("credits the client and reports the new balance", async () => {
    const { client } = await seedScenario(ctx.models, {
      clientBalance: "100.00",
      jobs: [{ price: "400.00" }],
    });

    const response = await deposit(client.id, client.id, { amount: "100.00" }).expect(200);

    expect(response.body.profile.balance).toBe("200.00");
    const reloaded = await ctx.models.Profile.findByPk(client.id);
    expect(money.fromDatabase(reloaded.balanceCents)).toBe(money.toCents("200.00"));
  });

  it("caps the deposit at 25% of what is currently owed", async () => {
    const { client } = await seedScenario(ctx.models, {
      clientBalance: "0.00",
      jobs: [{ price: "400.00" }],
    });

    const response = await deposit(client.id, client.id, { amount: "100.01" }).expect(400);

    expect(response.body.error.details).toEqual({ owed: "400.00", maxDeposit: "100.00" });
    const reloaded = await ctx.models.Profile.findByPk(client.id);
    expect(money.fromDatabase(reloaded.balanceCents)).toBe(0);
  });

  it("rounds the cap down to the cent rather than up", async () => {
    const { client } = await seedScenario(ctx.models, {
      clientBalance: "0.00",
      jobs: [{ price: "202.01" }],
    });

    const rejected = await deposit(client.id, client.id, { amount: "50.51" }).expect(400);
    expect(rejected.body.error.details.maxDeposit).toBe("50.50");

    await deposit(client.id, client.id, { amount: "50.50" }).expect(200);
  });

  it("ignores paid jobs when computing what is owed", async () => {
    const { client } = await seedScenario(ctx.models, {
      clientBalance: "0.00",
      jobs: [{ price: "400.00", paid: true }, { price: "100.00" }],
    });

    const response = await deposit(client.id, client.id, { amount: "26.00" }).expect(400);
    expect(response.body.error.details).toEqual({ owed: "100.00", maxDeposit: "25.00" });
  });

  /**
   * The path parameter must be honoured rather than decorative: a caller who
   * writes `/balances/deposit/999` has to be told no, not quietly credited.
   */
  it("refuses a deposit aimed at another profile", async () => {
    const { client } = await seedScenario(ctx.models, {
      clientBalance: "0.00",
      jobs: [{ price: "400.00" }],
    });
    const other = await ctx.models.Profile.create({
      firstName: "Olive",
      lastName: "O",
      profession: "Buyer",
      type: "client",
      balanceCents: 0,
    });

    const response = await deposit(client.id, other.id, { amount: "10.00" }).expect(403);

    expect(response.body.error.code).toBe("forbidden");
    expect(money.fromDatabase((await ctx.models.Profile.findByPk(client.id)).balanceCents)).toBe(0);
    expect(money.fromDatabase((await ctx.models.Profile.findByPk(other.id)).balanceCents)).toBe(0);
  });

  it("refuses a contractor", async () => {
    const { contractor } = await seedScenario(ctx.models, { jobs: [{ price: "400.00" }] });

    const response = await deposit(contractor.id, contractor.id, { amount: "10.00" }).expect(403);
    expect(response.body.error.message).toMatch(/Only clients/);
  });

  it.each(["0", "-5.00", "abc", "1.005", ""])("refuses the malformed amount %p", async (amount) => {
    const { client } = await seedScenario(ctx.models, {
      clientBalance: "0.00",
      jobs: [{ price: "400.00" }],
    });

    await deposit(client.id, client.id, { amount }).expect(400);
    expect(money.fromDatabase((await ctx.models.Profile.findByPk(client.id)).balanceCents)).toBe(0);
  });

  it("refuses a deposit when nothing is owed, because 25% of nothing is nothing", async () => {
    const { client } = await seedScenario(ctx.models, { clientBalance: "0.00", jobs: [] });

    const response = await deposit(client.id, client.id, { amount: "1.00" }).expect(400);
    expect(response.body.error.details).toEqual({ owed: "0.00", maxDeposit: "0.00" });
  });

  it("only counts the depositing client's own unpaid jobs", async () => {
    const mine = await seedScenario(ctx.models, {
      clientBalance: "0.00",
      jobs: [{ price: "100.00" }],
    });
    await seedScenario(ctx.models, { clientBalance: "0.00", jobs: [{ price: "10000.00" }] });

    const response = await deposit(mine.client.id, mine.client.id, { amount: "26.00" }).expect(400);
    expect(response.body.error.details.owed).toBe("100.00");
  });
});
