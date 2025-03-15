"use strict";

// Load .env if one is present. Absent in production, where the process
// environment is set by the orchestrator, and absent in CI.
require("dotenv").config();

/**
 * Every environment-dependent value the service reads lives here, so that no
 * other module needs to touch `process.env` directly.
 */

const DEFAULT_PORT = 3001;
const DEFAULT_DB_STORAGE = "./database.sqlite3";

/** A client may top up at most this fraction of what they currently owe. */
const MAX_DEPOSIT_RATIO_OF_UNPAID = 0.25;

/** Page size used when a request does not ask for one. */
const DEFAULT_PAGE_SIZE = 25;

/** Hard ceiling on `?limit=`, so one caller cannot ask for the whole table. */
const DEFAULT_MAX_PAGE_SIZE = 100;

/** How long SQLite waits for a competing writer before returning SQLITE_BUSY. */
const SQLITE_BUSY_TIMEOUT_MS = 5000;

function toBoolean(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIdList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter(Number.isFinite);
}

const config = {
  env: process.env.NODE_ENV || "development",
  port: toInteger(process.env.PORT, DEFAULT_PORT),
  db: {
    storage: process.env.DB_STORAGE || DEFAULT_DB_STORAGE,
    logging: toBoolean(process.env.DB_LOGGING, false),
    busyTimeoutMs: SQLITE_BUSY_TIMEOUT_MS,
  },
  money: {
    maxDepositRatioOfUnpaid: MAX_DEPOSIT_RATIO_OF_UNPAID,
  },
  pagination: {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    maxPageSize: toInteger(process.env.MAX_PAGE_SIZE, DEFAULT_MAX_PAGE_SIZE),
  },
  admin: {
    profileIds: toIdList(process.env.ADMIN_PROFILE_IDS),
  },
};

module.exports = config;
