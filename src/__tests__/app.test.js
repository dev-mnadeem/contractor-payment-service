"use strict";

const request = require("supertest");

const { createTestContext } = require("./helpers/testDb");

let ctx;

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.models.Profile.create({
    id: 1,
    firstName: "Ann",
    lastName: "A",
    profession: "Buyer",
    type: "client",
    balanceCents: 0,
  });
});

afterAll(async () => {
  await ctx.close();
});

describe("health probes", () => {
  it("reports liveness without a profile header", async () => {
    const response = await request(ctx.app).get("/healthz").expect(200);
    expect(response.body.status).toBe("ok");
    expect(typeof response.body.uptimeSeconds).toBe("number");
  });

  it("reports readiness once the database answers", async () => {
    const response = await request(ctx.app).get("/readyz").expect(200);
    expect(response.body).toEqual({ status: "ok", database: "reachable" });
  });
});

describe("authentication", () => {
  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["not a number", "abc"],
    ["zero", "0"],
    ["negative", "-1"],
    ["fractional", "1.5"],
  ])("rejects a %s profile_id", async (_label, value) => {
    const req = request(ctx.app).get("/contracts");
    if (value !== undefined) req.set("profile_id", value);
    const response = await req.expect(401);
    expect(response.body.error.code).toBe("unauthenticated");
  });

  it("rejects a well-formed id that matches no profile", async () => {
    const response = await request(ctx.app)
      .get("/contracts")
      .set("profile_id", "424242")
      .expect(401);
    expect(response.body.error.message).toBe("Unknown profile_id");
  });

  it("accepts a known profile", async () => {
    await request(ctx.app).get("/contracts").set("profile_id", "1").expect(200);
  });
});

describe("error envelope", () => {
  it("answers an unknown route with JSON rather than an HTML error page", async () => {
    const response = await request(ctx.app).get("/no-such-thing").expect(404);
    expect(response.type).toBe("application/json");
    expect(response.body.error).toEqual({
      code: "not_found",
      message: "No route matches GET /no-such-thing",
    });
  });

  it("uses the same shape for a validation failure", async () => {
    const response = await request(ctx.app)
      .get("/contracts?limit=abc")
      .set("profile_id", "1")
      .expect(400);
    expect(Object.keys(response.body.error).sort()).toEqual(["code", "message"]);
  });
});

describe("OpenAPI", () => {
  it("serves the interactive reference", async () => {
    const response = await request(ctx.app).get("/api-docs/").expect(200);
    expect(response.text).toContain("swagger-ui");
  });
});
