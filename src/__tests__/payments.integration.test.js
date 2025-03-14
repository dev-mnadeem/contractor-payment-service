"use strict";

const request = require("supertest");

const money = require("../money");
const { createTestContext, readBalances, seedScenario } = require("./helpers/testDb");

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

const pay = (jobId, profileId, headers = {}) => {
  const req = request(ctx.app).post(`/jobs/${jobId}/pay`).set("profile_id", String(profileId));
  Object.entries(headers).forEach(([name, value]) => req.set(name, value));
  return req;
};

describe("POST /jobs/:job_id/pay", () => {
  it("moves the job price from the client to the contractor", async () => {
    const { client, contractor, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "120.50" }],
    });

    const response = await pay(jobs[0].id, client.id).expect(201);

    expect(response.body.replayed).toBe(false);
    expect(response.body.payment).toMatchObject({
      jobId: jobs[0].id,
      clientId: client.id,
      contractorId: contractor.id,
      amount: "120.50",
    });

    const balances = await readBalances(ctx.models, client.id, contractor.id);
    expect(balances).toEqual({
      client: money.toCents("379.50"),
      contractor: money.toCents("120.50"),
    });
  });

  it("takes the amount from the stored job price and ignores the request body", async () => {
    const { client, contractor, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "100.00" }],
    });

    await pay(jobs[0].id, client.id).send({ amount: "0.01", priceCents: 1 }).expect(201);

    const balances = await readBalances(ctx.models, client.id, contractor.id);
    expect(balances.contractor).toBe(money.toCents("100.00"));
  });

  it("writes exactly one ledger row per settled job", async () => {
    const { client, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "10.00" }],
    });

    await pay(jobs[0].id, client.id).expect(201);

    const payments = await ctx.models.Payment.findAll({ where: { JobId: jobs[0].id } });
    expect(payments).toHaveLength(1);
    expect(money.fromDatabase(payments[0].amountCents)).toBe(money.toCents("10.00"));
  });

  it("marks the job paid and stamps a payment date", async () => {
    const { client, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "10.00" }],
    });

    await pay(jobs[0].id, client.id).expect(201);

    const job = await ctx.models.Job.findByPk(jobs[0].id);
    expect(job.paid).toBe(true);
    expect(job.paymentDate).toBeInstanceOf(Date);
  });
});

describe("paying the same job twice", () => {
  it("refuses the second sequential attempt", async () => {
    const { client, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "100.00" }],
    });

    await pay(jobs[0].id, client.id).expect(201);
    const second = await pay(jobs[0].id, client.id).expect(409);
    expect(second.body.error.code).toBe("job_already_paid");
  });

  /**
   * The guard that matters. Three concurrent settlements of one job must
   * produce one payment and one debit — not three. The conditional
   * `UPDATE Jobs SET paid = 1 WHERE id = ? AND paid = 0` is what makes the
   * winner exclusive, and the UNIQUE index on Payments.JobId is the backstop.
   */
  it("settles once under three concurrent attempts", async () => {
    const { client, contractor, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "100.00" }],
    });

    const results = await Promise.all([
      pay(jobs[0].id, client.id),
      pay(jobs[0].id, client.id),
      pay(jobs[0].id, client.id),
    ]);

    const created = results.filter((r) => r.status === 201);
    expect(created).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);

    const balances = await readBalances(ctx.models, client.id, contractor.id);
    expect(balances).toEqual({
      client: money.toCents("400.00"),
      contractor: money.toCents("100.00"),
    });
    expect(await ctx.models.Payment.count()).toBe(1);
  });
});

describe("concurrent payments against one balance", () => {
  /**
   * Two jobs of 60.00 against a balance of 100.00. Only one can be afforded.
   * A read-modify-write implementation lets both transactions read 100.00 and
   * both succeed, overdrawing the client. The conditional debit cannot.
   */
  it("never overdraws the client and never creates money", async () => {
    const { client, contractor, jobs } = await seedScenario(ctx.models, {
      clientBalance: "100.00",
      jobs: [{ price: "60.00" }, { price: "60.00" }],
    });

    const results = await Promise.all([pay(jobs[0].id, client.id), pay(jobs[1].id, client.id)]);

    const settled = results.filter((r) => r.status === 201);
    expect(settled).toHaveLength(1);
    expect(results.every((r) => [201, 422].includes(r.status))).toBe(true);

    const balances = await readBalances(ctx.models, client.id, contractor.id);
    expect(balances.client).toBeGreaterThanOrEqual(0);
    expect(balances.client + balances.contractor).toBe(money.toCents("100.00"));
  });

  it("keeps the two balances summing to the starting total across many payments", async () => {
    const prices = Array.from({ length: 10 }, () => ({ price: "0.10" }));
    const { client, contractor, jobs } = await seedScenario(ctx.models, {
      clientBalance: "1.00",
      jobs: prices,
    });

    await Promise.all(jobs.map((job) => pay(job.id, client.id)));

    const balances = await readBalances(ctx.models, client.id, contractor.id);
    expect(balances).toEqual({ client: 0, contractor: money.toCents("1.00") });
  });
});

describe("rejections roll the whole settlement back", () => {
  it("leaves the job unpaid when the balance does not cover it", async () => {
    const { client, contractor, jobs } = await seedScenario(ctx.models, {
      clientBalance: "10.00",
      jobs: [{ price: "200.00" }],
    });

    const response = await pay(jobs[0].id, client.id).expect(422);
    expect(response.body.error.code).toBe("insufficient_funds");

    const job = await ctx.models.Job.findByPk(jobs[0].id);
    expect(job.paid).toBe(false);
    expect(job.paymentDate).toBeNull();

    const balances = await readBalances(ctx.models, client.id, contractor.id);
    expect(balances).toEqual({ client: money.toCents("10.00"), contractor: 0 });
    expect(await ctx.models.Payment.count()).toBe(0);
  });

  it("refuses a job whose contract has been terminated", async () => {
    const { client, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      status: "terminated",
      jobs: [{ price: "10.00" }],
    });

    const response = await pay(jobs[0].id, client.id).expect(409);
    expect(response.body.error.code).toBe("contract_terminated");
    expect((await ctx.models.Job.findByPk(jobs[0].id)).paid).toBe(false);
  });
});

describe("who may settle a job", () => {
  it("refuses a client who is not the one named on the contract", async () => {
    const { jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "10.00" }],
    });
    const stranger = await ctx.models.Profile.create({
      firstName: "Sam",
      lastName: "Stranger",
      profession: "Buyer",
      type: "client",
      balanceCents: 100000,
    });

    const response = await pay(jobs[0].id, stranger.id).expect(404);
    expect(response.body.error.code).toBe("not_found");
    expect((await ctx.models.Job.findByPk(jobs[0].id)).paid).toBe(false);
  });

  it("refuses the contractor on the contract", async () => {
    const { contractor, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "10.00" }],
    });

    await pay(jobs[0].id, contractor.id).expect(404);
    expect((await ctx.models.Job.findByPk(jobs[0].id)).paid).toBe(false);
  });

  it("requires a profile_id header", async () => {
    const { jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "10.00" }],
    });

    const response = await request(ctx.app).post(`/jobs/${jobs[0].id}/pay`).expect(401);
    expect(response.body.error.code).toBe("unauthenticated");
  });
});

describe("Idempotency-Key", () => {
  it("replays the original payment instead of paying twice", async () => {
    const { client, contractor, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "100.00" }],
    });

    const first = await pay(jobs[0].id, client.id, { "Idempotency-Key": "retry-1" }).expect(201);
    const second = await pay(jobs[0].id, client.id, { "Idempotency-Key": "retry-1" }).expect(200);

    expect(second.body.replayed).toBe(true);
    expect(second.body.payment.id).toBe(first.body.payment.id);

    const balances = await readBalances(ctx.models, client.id, contractor.id);
    expect(balances).toEqual({
      client: money.toCents("400.00"),
      contractor: money.toCents("100.00"),
    });
    expect(await ctx.models.Payment.count()).toBe(1);
  });

  it("refuses a key that was already used for a different job", async () => {
    const { client, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "10.00" }, { price: "20.00" }],
    });

    await pay(jobs[0].id, client.id, { "Idempotency-Key": "shared" }).expect(201);
    const response = await pay(jobs[1].id, client.id, { "Idempotency-Key": "shared" }).expect(409);

    expect(response.body.error.code).toBe("idempotency_key_reused");
    expect((await ctx.models.Job.findByPk(jobs[1].id)).paid).toBe(false);
  });

  it("rejects an over-long key", async () => {
    const { client, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "10.00" }],
    });

    const response = await pay(jobs[0].id, client.id, {
      "Idempotency-Key": "k".repeat(256),
    }).expect(400);
    expect(response.body.error.code).toBe("invalid_request");
  });
});

describe("GET /payments", () => {
  it("lists the caller's payments as payer and as payee", async () => {
    const { client, contractor, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "10.00" }, { price: "20.00" }],
    });

    await pay(jobs[0].id, client.id).expect(201);
    await pay(jobs[1].id, client.id).expect(201);

    const asClient = await request(ctx.app)
      .get("/payments")
      .set("profile_id", String(client.id))
      .expect(200);
    const asContractor = await request(ctx.app)
      .get("/payments")
      .set("profile_id", String(contractor.id))
      .expect(200);

    expect(asClient.body.page.total).toBe(2);
    expect(asContractor.body.page.total).toBe(2);
    expect(asClient.body.data.map((p) => p.amount).sort()).toEqual(["10.00", "20.00"]);
  });

  it("does not leak somebody else's payments", async () => {
    const { client, jobs } = await seedScenario(ctx.models, {
      clientBalance: "500.00",
      jobs: [{ price: "10.00" }],
    });
    await pay(jobs[0].id, client.id).expect(201);

    const stranger = await ctx.models.Profile.create({
      firstName: "Sam",
      lastName: "Stranger",
      profession: "Buyer",
      type: "client",
      balanceCents: 0,
    });

    const response = await request(ctx.app)
      .get("/payments")
      .set("profile_id", String(stranger.id))
      .expect(200);
    expect(response.body.data).toEqual([]);
  });
});
