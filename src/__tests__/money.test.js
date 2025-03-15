"use strict";

const money = require("../money");
const { ValidationError } = require("../errors");

describe("money", () => {
  describe("toCents", () => {
    it.each([
      ["0", 0],
      ["1", 100],
      ["1.5", 150],
      ["1.05", 105],
      ["0.01", 1],
      ["1150.00", 115000],
      ["-2.50", -250],
      [10.99, 1099],
      [0.1, 10],
    ])("converts %p to %p cents", (input, expected) => {
      expect(money.toCents(input)).toBe(expected);
    });

    it.each(["1.005", "abc", "", "1.2.3", "1,50", "1e3", null, undefined])(
      "rejects %p rather than rounding it away",
      (input) => {
        expect(() => money.toCents(input)).toThrow(ValidationError);
      }
    );
  });

  describe("format", () => {
    it.each([
      [0, "0.00"],
      [1, "0.01"],
      [100, "1.00"],
      [115000, "1150.00"],
      [-250, "-2.50"],
    ])("renders %p cents as %p", (cents, expected) => {
      expect(money.format(cents)).toBe(expected);
    });

    it("refuses a fractional cent count", () => {
      expect(() => money.format(10.5)).toThrow(TypeError);
    });
  });

  describe("applyRatioFloor", () => {
    it("rounds a cap down so it is never generous by a cent", () => {
      expect(money.applyRatioFloor(20201, 0.25)).toBe(5050);
      expect(money.format(money.applyRatioFloor(20201, 0.25))).toBe("50.50");
    });
  });

  /**
   * The reason the schema stores cents. Debiting 0.10 from 1.00 ten times in
   * binary floating point does not reach zero, and the residue is real money
   * that either vanishes or is conjured depending on the rounding direction.
   */
  describe("integer cents versus floats", () => {
    it("shows that repeated float subtraction does not land on zero", () => {
      let balance = 1.0;
      for (let i = 0; i < 10; i += 1) balance -= 0.1;
      expect(balance).not.toBe(0);
      expect(Math.abs(balance)).toBeGreaterThan(0);
    });

    it("lands exactly on zero in integer cents", () => {
      let balance = money.toCents("1.00");
      for (let i = 0; i < 10; i += 1) balance -= money.toCents("0.10");
      expect(balance).toBe(0);
      expect(money.format(balance)).toBe("0.00");
    });
  });

  describe("fromDatabase", () => {
    it("treats NULL as zero", () => {
      expect(money.fromDatabase(null)).toBe(0);
      expect(money.fromDatabase(undefined)).toBe(0);
    });

    it("accepts the string form SQLite can return for a BIGINT", () => {
      expect(money.fromDatabase("12345")).toBe(12345);
    });

    it("refuses a value that has lost integer precision", () => {
      expect(() => money.fromDatabase(Number.MAX_SAFE_INTEGER + 2)).toThrow(TypeError);
    });
  });
});
