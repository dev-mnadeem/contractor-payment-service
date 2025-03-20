"use strict";

const {
  AppError,
  ConflictError,
  ForbiddenError,
  InsufficientFundsError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} = require("../errors");
const { asyncHandler, errorHandler, notFoundHandler } = require("../middleware/errorHandler");

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("error classes", () => {
  it.each([
    [new ValidationError("bad"), 400, "invalid_request"],
    [new UnauthenticatedError(), 401, "unauthenticated"],
    [new ForbiddenError(), 403, "forbidden"],
    [new NotFoundError(), 404, "not_found"],
    [new ConflictError("clash"), 409, "conflict"],
    [new ConflictError("paid", "job_already_paid"), 409, "job_already_paid"],
    [new InsufficientFundsError(), 422, "insufficient_funds"],
  ])("%s carries its own status and code", (error, status, code) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
  });
});

describe("errorHandler", () => {
  it("renders a domain error with its own status", () => {
    const res = mockResponse();
    errorHandler(new NotFoundError("gone"), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { code: "not_found", message: "gone" } });
  });

  it("passes structured details through", () => {
    const res = mockResponse();
    errorHandler(new ValidationError("too much", { maxDeposit: "10.00" }), {}, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      error: { code: "invalid_request", message: "too much", details: { maxDeposit: "10.00" } },
    });
  });

  /** An unexpected failure must not leak a stack trace or a SQL string. */
  it("hides the detail of an unrecognised error behind a 500", () => {
    const res = mockResponse();
    errorHandler(new Error("SQLITE_ERROR: no such column: secret_table.token"), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "internal_error", message: "An unexpected error occurred" },
    });
  });
});

describe("notFoundHandler", () => {
  it("turns an unmatched route into a NotFoundError", () => {
    const next = jest.fn();
    notFoundHandler({ method: "POST", path: "/nope" }, mockResponse(), next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe("No route matches POST /nope");
  });
});

describe("asyncHandler", () => {
  it("forwards a rejected promise to next instead of leaving it unhandled", async () => {
    const next = jest.fn();
    const boom = new Error("boom");

    await asyncHandler(async () => {
      throw boom;
    })({}, mockResponse(), next);

    expect(next).toHaveBeenCalledWith(boom);
  });

  it("does not call next when the handler resolves", async () => {
    const next = jest.fn();
    await asyncHandler(async () => "fine")({}, mockResponse(), next);
    expect(next).not.toHaveBeenCalled();
  });
});
