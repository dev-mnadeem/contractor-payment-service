"use strict";

/**
 * Domain failures are thrown as typed errors carrying the HTTP status and the
 * machine-readable code the client sees. Nothing branches on `error.message`:
 * comparing rethrown message strings makes a typo in an error message silently
 * downgrade a 422 into a 500.
 */
class AppError extends Error {
  constructor(message, { status, code, details }) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace(this, new.target);
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { status: 400, code: "invalid_request", details });
  }
}

class UnauthenticatedError extends AppError {
  constructor(message = "A valid profile_id header is required") {
    super(message, { status: 401, code: "unauthenticated" });
  }
}

class ForbiddenError extends AppError {
  constructor(message = "This profile may not perform that action") {
    super(message, { status: 403, code: "forbidden" });
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, { status: 404, code: "not_found" });
  }
}

/** The request was understood but conflicts with the current state of the resource. */
class ConflictError extends AppError {
  constructor(message, code = "conflict") {
    super(message, { status: 409, code });
  }
}

/** The client cannot cover the amount. Distinct from a malformed request. */
class InsufficientFundsError extends AppError {
  constructor(message = "Balance does not cover the amount") {
    super(message, { status: 422, code: "insufficient_funds" });
  }
}

module.exports = {
  AppError,
  ConflictError,
  ForbiddenError,
  InsufficientFundsError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
};
