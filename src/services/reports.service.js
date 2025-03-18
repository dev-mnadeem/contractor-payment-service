"use strict";

const { ValidationError } = require("../errors");
const money = require("../money");

const DEFAULT_BEST_CLIENT_LIMIT = 2;
const MAX_BEST_CLIENT_LIMIT = 100;

/**
 * The two /admin reports are pure aggregations. Both sum in SQL rather than
 * pulling rows into the process, and both take a validated date window — an
 * unparseable date must not sail through as `Invalid Date` and come back as an
 * empty result set indistinguishable from "nobody earned anything".
 */
function createReportsService({ jobs }) {
  async function bestProfession({ start, end }) {
    const range = parseRange(start, end);
    const rows = await jobs.sumPaidByProfession(range);
    if (rows.length === 0) return null;

    return {
      profession: rows[0].profession,
      totalEarned: money.format(money.fromDatabase(rows[0].totalCents)),
    };
  }

  async function bestClients({ start, end, limit }) {
    const range = parseRange(start, end);
    const rows = await jobs.sumPaidByClient({
      ...range,
      limit: parseLimit(limit),
    });

    return rows.map((row) => ({
      id: row.clientId,
      fullName: `${row.firstName} ${row.lastName}`,
      paid: money.format(money.fromDatabase(row.totalCents)),
    }));
  }

  return { bestClients, bestProfession };
}

function parseRange(start, end) {
  if (!start || !end) {
    throw new ValidationError("Both start and end dates are required");
  }

  const from = new Date(start);
  const to = new Date(end);

  if (Number.isNaN(from.getTime())) {
    throw new ValidationError(`start is not a valid date: ${start}`);
  }
  if (Number.isNaN(to.getTime())) {
    throw new ValidationError(`end is not a valid date: ${end}`);
  }
  if (from > to) {
    throw new ValidationError("start must not be after end");
  }

  return { from, to };
}

function parseLimit(raw) {
  if (raw === undefined || raw === "") return DEFAULT_BEST_CLIENT_LIMIT;
  if (!/^\d+$/.test(String(raw))) {
    throw new ValidationError("limit must be a positive integer");
  }
  const limit = Number(raw);
  if (limit < 1) {
    throw new ValidationError("limit must be a positive integer");
  }
  if (limit > MAX_BEST_CLIENT_LIMIT) {
    throw new ValidationError(`limit may not exceed ${MAX_BEST_CLIENT_LIMIT}`);
  }
  return limit;
}

module.exports = {
  DEFAULT_BEST_CLIENT_LIMIT,
  MAX_BEST_CLIENT_LIMIT,
  createReportsService,
};
