"use strict";

const config = require("./config");
const { ValidationError } = require("./errors");

/**
 * Turn `?limit=&offset=` into a bounded window.
 *
 * Paging input is validated here rather than handed to the driver. `LIMIT NaN`
 * is a SQLite syntax error, not an empty page, and a limit Sequelize discards
 * silently turns a paginated endpoint back into an unbounded one.
 */
function parsePagination(query, { maxPageSize = config.pagination.maxPageSize } = {}) {
  const limit = parsePositiveInteger(query.limit, "limit", config.pagination.defaultPageSize);
  const offset = parseNonNegativeInteger(query.offset, "offset", 0);

  if (limit > maxPageSize) {
    throw new ValidationError(`limit may not exceed ${maxPageSize}`);
  }

  return { limit, offset };
}

/** Digits only: "1e2" and " 10" are numerically fine but are not what a
 *  caller meant to type, and accepting them hides typos. */
const DIGITS_ONLY = /^\d+$/;

function parseBoundedInteger(raw, name, { fallback, minimum }) {
  if (raw === undefined || raw === "") return fallback;

  const text = String(raw);
  if (!DIGITS_ONLY.test(text)) {
    throw new ValidationError(`${name} must be a whole number`);
  }

  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new ValidationError(`${name} must be at least ${minimum}`);
  }
  return value;
}

function parsePositiveInteger(raw, name, fallback) {
  return parseBoundedInteger(raw, name, { fallback, minimum: 1 });
}

function parseNonNegativeInteger(raw, name, fallback) {
  return parseBoundedInteger(raw, name, { fallback, minimum: 0 });
}

/** Wrap a Sequelize findAndCountAll result in the envelope every list endpoint returns. */
function toPage({ rows, count }, { limit, offset }, serialize) {
  return {
    data: rows.map(serialize),
    page: { limit, offset, total: count, hasMore: offset + rows.length < count },
  };
}

module.exports = { parseNonNegativeInteger, parsePagination, parsePositiveInteger, toPage };
