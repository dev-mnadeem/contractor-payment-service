"use strict";

const config = require("../config");
const { AppError, NotFoundError } = require("../errors");

const HTTP_INTERNAL_SERVER_ERROR = 500;

/** Anything that fell through the router is a 404 in the same JSON shape as every other error. */
function notFoundHandler(req, _res, next) {
  next(new NotFoundError(`No route matches ${req.method} ${req.path}`));
}

/**
 * One error shape for the whole API: `{ error: { code, message } }`. A client
 * branches on `code`, so the codes are part of the contract and the prose is
 * free to change.
 */
function errorHandler(error, _req, res, _next) {
  if (error instanceof AppError) {
    const body = { error: { code: error.code, message: error.message } };
    if (error.details !== undefined) body.error.details = error.details;
    return res.status(error.status).json(body);
  }

  if (config.env !== "test") {
    console.error("Unhandled error while serving request:", error);
  }

  return res.status(HTTP_INTERNAL_SERVER_ERROR).json({
    error: { code: "internal_error", message: "An unexpected error occurred" },
  });
}

module.exports = { errorHandler, notFoundHandler };
