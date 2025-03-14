"use strict";

const { ValidationError } = require("../errors");
const { parsePagination, toPage } = require("../pagination");

describe("parsePagination", () => {
  it("falls back to the default page size", () => {
    expect(parsePagination({})).toEqual({ limit: 25, offset: 0 });
  });

  it("accepts a well-formed window", () => {
    expect(parsePagination({ limit: "10", offset: "20" })).toEqual({ limit: 10, offset: 20 });
  });

  it.each(["abc", "-5", "0", "1.5", "1e2"])(
    "rejects limit=%p instead of passing it to the driver",
    (limit) => {
      expect(() => parsePagination({ limit })).toThrow(ValidationError);
    }
  );

  it.each(["abc", "-1", "2.5"])("rejects offset=%p", (offset) => {
    expect(() => parsePagination({ offset })).toThrow(ValidationError);
  });

  it("caps the page size", () => {
    expect(() => parsePagination({ limit: "101" }, { maxPageSize: 100 })).toThrow(
      /limit may not exceed 100/
    );
  });
});

describe("toPage", () => {
  it("reports hasMore when rows remain beyond the window", () => {
    const page = toPage(
      { rows: [{ id: 1 }, { id: 2 }], count: 5 },
      { limit: 2, offset: 0 },
      (r) => r
    );
    expect(page.page).toEqual({ limit: 2, offset: 0, total: 5, hasMore: true });
    expect(page.data).toHaveLength(2);
  });

  it("reports hasMore false on the last window", () => {
    const page = toPage({ rows: [{ id: 5 }], count: 5 }, { limit: 2, offset: 4 }, (r) => r);
    expect(page.page.hasMore).toBe(false);
  });
});
