"use strict";

const request = require("supertest");

const money = require("../money");
const { createTestContext } = require("./helpers/testDb");

let ctx;
let admin;
let outsider;

const IN_RANGE = "2021-06-15T12:00:00.000Z";
const OUT_OF_RANGE = "2019-01-01T12:00:00.000Z";
const RANGE = "start=2021-01-01&end=2021-12-31";

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await ctx.reset();
  const { Profile, Contract, Job } = ctx.models;

  admin = await Profile.create({
    firstName: "Ada",
    lastName: "Lovelace",
    profession: "Operator",
    type: "client",
    balanceCents: 0,
    isAdmin: true,
  });
  outsider = await Profile.create({
    firstName: "Nosy",
    lastName: "Neighbour",
    profession: "Buyer",
    type: "client",
    balanceCents: 0,
  });

  const bigSpender = await Profile.create({
    firstName: "Big",
    lastName: "Spender",
    profession: "Buyer",
    type: "client",
    balanceCents: 0,
  });
  const smallSpender = await Profile.create({
    firstName: "Small",
    lastName: "Spender",
    profession: "Buyer",
    type: "client",
    balanceCents: 0,
  });
  const programmer = await Profile.create({
    firstName: "Pat",
    lastName: "Programmer",
    profession: "Programmer",
    type: "contractor",
    balanceCents: 0,
  });
  const musician = await Profile.create({
    firstName: "Mel",
    lastName: "Musician",
    profession: "Musician",
    type: "contractor",
    balanceCents: 0,
  });

  const c1 = await Contract.create({
    terms: "t",
    status: "in_progress",
    ClientId: bigSpender.id,
    ContractorId: programmer.id,
  });
  const c2 = await Contract.create({
    terms: "t",
    status: "in_progress",
    ClientId: smallSpender.id,
    ContractorId: musician.id,
  });

  await Job.create({
    description: "a",
    priceCents: money.toCents("300.00"),
    paid: true,
    paymentDate: new Date(IN_RANGE),
    ContractId: c1.id,
  });
  await Job.create({
    description: "b",
    priceCents: money.toCents("200.50"),
    paid: true,
    paymentDate: new Date(IN_RANGE),
    ContractId: c1.id,
  });
  await Job.create({
    description: "c",
    priceCents: money.toCents("100.00"),
    paid: true,
    paymentDate: new Date(IN_RANGE),
    ContractId: c2.id,
  });
  await Job.create({
    description: "out of range",
    priceCents: money.toCents("9999.00"),
    paid: true,
    paymentDate: new Date(OUT_OF_RANGE),
    ContractId: c2.id,
  });
  await Job.create({
    description: "unpaid",
    priceCents: money.toCents("5000.00"),
    paid: false,
    ContractId: c1.id,
  });
});

const asAdmin = (path) => request(ctx.app).get(path).set("profile_id", String(admin.id));

describe("who may read the platform reports", () => {
  /**
   * These endpoints aggregate every client's spend and every contractor's
   * earnings. They were reachable without any header at all.
   */
  it("requires authentication", async () => {
    const response = await request(ctx.app).get(`/admin/best-clients?${RANGE}`).expect(401);
    expect(response.body.error.code).toBe("unauthenticated");
  });

  it("refuses an authenticated but non-admin profile", async () => {
    const response = await request(ctx.app)
      .get(`/admin/best-clients?${RANGE}`)
      .set("profile_id", String(outsider.id))
      .expect(403);
    expect(response.body.error.code).toBe("forbidden");
  });

  it("allows a profile flagged isAdmin", async () => {
    await asAdmin(`/admin/best-clients?${RANGE}`).expect(200);
  });
});

describe("GET /admin/best-profession", () => {
  it("returns the profession with the highest paid total in the window", async () => {
    const response = await asAdmin(`/admin/best-profession?${RANGE}`).expect(200);
    expect(response.body).toEqual({ profession: "Programmer", totalEarned: "500.50" });
  });

  it("ignores jobs paid outside the window", async () => {
    const response = await asAdmin("/admin/best-profession?start=2019-01-01&end=2019-12-31").expect(
      200
    );
    expect(response.body.profession).toBe("Musician");
    expect(response.body.totalEarned).toBe("9999.00");
  });

  it("answers 404 when nothing was paid in the window", async () => {
    const response = await asAdmin("/admin/best-profession?start=2010-01-01&end=2010-12-31").expect(
      404
    );
    expect(response.body.error.code).toBe("not_found");
  });

  it.each([
    ["missing both", "/admin/best-profession"],
    ["missing end", "/admin/best-profession?start=2021-01-01"],
    ["unparseable start", "/admin/best-profession?start=nope&end=2021-12-31"],
    ["start after end", "/admin/best-profession?start=2021-12-31&end=2021-01-01"],
  ])("rejects %s with a 400", async (_label, path) => {
    const response = await asAdmin(path).expect(400);
    expect(response.body.error.code).toBe("invalid_request");
  });
});

describe("GET /admin/best-clients", () => {
  it("ranks clients by total paid, highest first", async () => {
    const response = await asAdmin(`/admin/best-clients?${RANGE}&limit=5`).expect(200);
    expect(response.body.data).toEqual([
      { id: expect.any(Number), fullName: "Big Spender", paid: "500.50" },
      { id: expect.any(Number), fullName: "Small Spender", paid: "100.00" },
    ]);
  });

  it("defaults to two clients", async () => {
    const response = await asAdmin(`/admin/best-clients?${RANGE}`).expect(200);
    expect(response.body.data).toHaveLength(2);
  });

  it("honours an explicit limit", async () => {
    const response = await asAdmin(`/admin/best-clients?${RANGE}&limit=1`).expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].fullName).toBe("Big Spender");
  });

  it("returns an empty list, not a 404, when nobody paid in the window", async () => {
    const response = await asAdmin("/admin/best-clients?start=2010-01-01&end=2010-12-31").expect(
      200
    );
    expect(response.body.data).toEqual([]);
  });

  /**
   * A limit that reaches SQLite unvalidated is either a syntax error — `LIMIT
   * NaN` — or, when Sequelize drops it, an unbounded result set.
   */
  it.each(["abc", "-5", "0", "1.5"])("rejects limit=%p with a 400", async (limit) => {
    const response = await asAdmin(`/admin/best-clients?${RANGE}&limit=${limit}`).expect(400);
    expect(response.body.error.code).toBe("invalid_request");
  });

  it("caps the limit", async () => {
    const response = await asAdmin(`/admin/best-clients?${RANGE}&limit=101`).expect(400);
    expect(response.body.error.message).toMatch(/limit may not exceed 100/);
  });
});
