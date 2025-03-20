"use strict";

const request = require("supertest");

const { createTestContext } = require("./helpers/testDb");

let ctx;
let alice;
let bob;
let carol;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await ctx.reset();
  const { Profile, Contract } = ctx.models;
  alice = await Profile.create({
    firstName: "Alice",
    lastName: "A",
    profession: "Buyer",
    type: "client",
    balanceCents: 0,
  });
  bob = await Profile.create({
    firstName: "Bob",
    lastName: "B",
    profession: "Programmer",
    type: "contractor",
    balanceCents: 0,
  });
  carol = await Profile.create({
    firstName: "Carol",
    lastName: "C",
    profession: "Buyer",
    type: "client",
    balanceCents: 0,
  });

  await Contract.create({
    terms: "active work",
    status: "in_progress",
    ClientId: alice.id,
    ContractorId: bob.id,
  });
  await Contract.create({
    terms: "not started",
    status: "new",
    ClientId: alice.id,
    ContractorId: bob.id,
  });
  await Contract.create({
    terms: "finished",
    status: "terminated",
    ClientId: alice.id,
    ContractorId: bob.id,
  });
  await Contract.create({
    terms: "someone else's",
    status: "in_progress",
    ClientId: carol.id,
    ContractorId: bob.id,
  });
});

const asProfile = (profile) => (path) =>
  request(ctx.app).get(path).set("profile_id", String(profile.id));

describe("GET /contracts", () => {
  it("returns the caller's new and in-progress contracts by default", async () => {
    const response = await asProfile(alice)("/contracts").expect(200);
    expect(response.body.data.map((c) => c.status).sort()).toEqual(["in_progress", "new"]);
  });

  it("shows the contractor the same contracts from the other side", async () => {
    const response = await asProfile(bob)("/contracts").expect(200);
    expect(response.body.page.total).toBe(3);
  });

  it("never includes a contract the caller is not a party to", async () => {
    const response = await asProfile(alice)("/contracts").expect(200);
    expect(response.body.data.every((c) => c.clientId === alice.id)).toBe(true);
  });

  it("widens the window when a status is requested explicitly", async () => {
    const response = await asProfile(alice)("/contracts?status=terminated").expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].status).toBe("terminated");
  });

  it("accepts a comma-separated status list", async () => {
    const response = await asProfile(alice)("/contracts?status=new,terminated").expect(200);
    expect(response.body.page.total).toBe(2);
  });

  it("rejects an unknown status instead of returning an empty list", async () => {
    const response = await asProfile(alice)("/contracts?status=pending").expect(400);
    expect(response.body.error.message).toMatch(/Unknown contract status: pending/);
  });

  it("paginates", async () => {
    const first = await asProfile(alice)("/contracts?limit=1&offset=0").expect(200);
    expect(first.body.data).toHaveLength(1);
    expect(first.body.page).toMatchObject({ limit: 1, offset: 0, total: 2, hasMore: true });

    const last = await asProfile(alice)("/contracts?limit=1&offset=1").expect(200);
    expect(last.body.page.hasMore).toBe(false);
    expect(last.body.data[0].id).not.toBe(first.body.data[0].id);
  });

  it("rejects a malformed limit", async () => {
    await asProfile(alice)("/contracts?limit=abc").expect(400);
  });
});

describe("GET /contracts/:id", () => {
  it("returns a contract the caller is the client on", async () => {
    const list = await asProfile(alice)("/contracts").expect(200);
    const id = list.body.data[0].id;
    const response = await asProfile(alice)(`/contracts/${id}`).expect(200);
    expect(response.body.id).toBe(id);
  });

  /**
   * Somebody else's contract and a contract that does not exist answer the
   * same 404. A 403 would confirm the id is real, which is an enumeration
   * oracle over other people's business relationships.
   */
  it("answers 404, not 403, for another party's contract", async () => {
    const carolsContracts = await asProfile(carol)("/contracts").expect(200);
    const id = carolsContracts.body.data[0].id;

    const response = await asProfile(alice)(`/contracts/${id}`).expect(404);
    expect(response.body.error.code).toBe("not_found");
  });

  it("answers the same 404 for an id that does not exist", async () => {
    const response = await asProfile(alice)("/contracts/999999").expect(404);
    expect(response.body.error.code).toBe("not_found");
  });
});
