"use strict";

const request = require("supertest");

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

describe("GET /jobs/unpaid", () => {
  it("lists unpaid jobs on an in-progress contract for the client", async () => {
    const { client, jobs } = await seedScenario(ctx.models, {
      jobs: [
        { price: "10.00", description: "outstanding" },
        { price: "20.00", paid: true },
      ],
    });

    const response = await request(ctx.app)
      .get("/jobs/unpaid")
      .set("profile_id", String(client.id))
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: jobs[0].id,
      description: "outstanding",
      price: "10.00",
      paid: false,
    });
  });

  it("shows the same jobs to the contractor on the contract", async () => {
    const { contractor } = await seedScenario(ctx.models, { jobs: [{ price: "10.00" }] });

    const response = await request(ctx.app)
      .get("/jobs/unpaid")
      .set("profile_id", String(contractor.id))
      .expect(200);

    expect(response.body.page.total).toBe(1);
  });

  it.each(["new", "terminated"])("excludes jobs on a contract in status %p", async (status) => {
    const { client } = await seedScenario(ctx.models, { status, jobs: [{ price: "10.00" }] });

    const response = await request(ctx.app)
      .get("/jobs/unpaid")
      .set("profile_id", String(client.id))
      .expect(200);

    expect(response.body.data).toEqual([]);
  });

  /** Owing nothing is a successful, empty answer — not a 404. */
  it("answers 200 with an empty page when nothing is outstanding", async () => {
    const { client } = await seedScenario(ctx.models, { jobs: [{ price: "10.00", paid: true }] });

    const response = await request(ctx.app)
      .get("/jobs/unpaid")
      .set("profile_id", String(client.id))
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      page: { limit: 25, offset: 0, total: 0, hasMore: false },
    });
  });

  it("paginates a long list rather than returning all of it", async () => {
    const { client } = await seedScenario(ctx.models, {
      jobs: Array.from({ length: 30 }, (_, i) => ({ price: "1.00", description: `job ${i}` })),
    });

    const firstPage = await request(ctx.app)
      .get("/jobs/unpaid")
      .set("profile_id", String(client.id))
      .expect(200);

    expect(firstPage.body.data).toHaveLength(25);
    expect(firstPage.body.page).toMatchObject({ total: 30, hasMore: true });

    const secondPage = await request(ctx.app)
      .get("/jobs/unpaid?offset=25")
      .set("profile_id", String(client.id))
      .expect(200);

    expect(secondPage.body.data).toHaveLength(5);
    expect(secondPage.body.page.hasMore).toBe(false);
  });

  it("refuses a page size above the cap", async () => {
    const { client } = await seedScenario(ctx.models, { jobs: [{ price: "1.00" }] });

    const response = await request(ctx.app)
      .get("/jobs/unpaid?limit=1000")
      .set("profile_id", String(client.id))
      .expect(400);

    expect(response.body.error.message).toMatch(/limit may not exceed/);
  });

  it("does not leak another profile's jobs", async () => {
    await seedScenario(ctx.models, { jobs: [{ price: "10.00" }] });
    const stranger = await ctx.models.Profile.create({
      firstName: "Sam",
      lastName: "Stranger",
      profession: "Buyer",
      type: "client",
      balanceCents: 0,
    });

    const response = await request(ctx.app)
      .get("/jobs/unpaid")
      .set("profile_id", String(stranger.id))
      .expect(200);

    expect(response.body.data).toEqual([]);
  });
});
