"use strict";

const { ValidationError } = require("./errors");

/**
 * Money is held as an integer number of minor units (cents) everywhere inside
 * the service. Binary floating point cannot represent 0.10, so a balance that
 * is debited by 0.10 ten times does not land on zero — it lands on
 * 1.3877787807814457e-16. `src/__tests__/money.test.js` pins that down.
 *
 * The only places a decimal string exists are the HTTP boundary (parse on the
 * way in, format on the way out) and the human-readable seed data.
 */

const MINOR_UNITS_PER_UNIT = 100;
const DECIMAL_PLACES = 2;

/** 2^53 - 1 cents. Above this, integer arithmetic in JS stops being exact. */
const MAX_SAFE_CENTS = Number.MAX_SAFE_INTEGER;

const DECIMAL_PATTERN = /^-?\d+(\.\d{1,2})?$/;

/**
 * Convert a decimal amount — "10.99", 10.99 or 1099 cents already — into an
 * exact integer number of cents. Rejects anything with sub-cent precision
 * rather than silently rounding someone's money away.
 */
function toCents(amount) {
  const text = typeof amount === "number" ? amount.toFixed(DECIMAL_PLACES) : String(amount).trim();

  if (!DECIMAL_PATTERN.test(text)) {
    throw new ValidationError(`"${amount}" is not a valid monetary amount`);
  }

  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const cents = Number(whole) * MINOR_UNITS_PER_UNIT + Number(fraction.padEnd(DECIMAL_PLACES, "0"));

  if (!Number.isSafeInteger(cents)) {
    throw new ValidationError(`"${amount}" is too large to represent exactly`);
  }

  return negative ? -cents : cents;
}

/** Render an integer cent amount as a fixed two-decimal string, e.g. "1099" -> "10.99". */
function format(cents) {
  const value = Number(cents);
  if (!Number.isInteger(value)) {
    throw new TypeError(`expected an integer cent amount, got ${cents}`);
  }
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.trunc(absolute / MINOR_UNITS_PER_UNIT);
  const fraction = String(absolute % MINOR_UNITS_PER_UNIT).padStart(DECIMAL_PLACES, "0");
  return `${sign}${whole}.${fraction}`;
}

/**
 * Apply a ratio (such as the 25% deposit cap) to a cent amount and round *down*,
 * so a cap is never rounded upwards in the depositor's favour.
 */
function applyRatioFloor(cents, ratio) {
  return Math.floor(Number(cents) * ratio);
}

/** Coerce a value read back from the database into a plain integer cent count. */
function fromDatabase(value) {
  if (value === null || value === undefined) return 0;
  const cents = Number(value);
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError(`stored amount ${value} is not a safe integer cent count`);
  }
  return cents;
}

module.exports = {
  MAX_SAFE_CENTS,
  MINOR_UNITS_PER_UNIT,
  applyRatioFloor,
  format,
  fromDatabase,
  toCents,
};
