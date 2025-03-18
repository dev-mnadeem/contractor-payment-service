"use strict";

const config = require("../config");
const { ForbiddenError } = require("../errors");

/**
 * The /admin reports aggregate every client's spend and every contractor's
 * earnings across the whole platform — the kind of thing that must never be
 * reachable by an ordinary account, let alone by an unauthenticated caller.
 *
 * Admin rights come from `Profile.isAdmin`, or from the ADMIN_PROFILE_IDS
 * environment variable as a break-glass route for an operator who has not
 * flagged a profile yet.
 */
function requireAdmin(req, _res, next) {
  const isFlagged = Boolean(req.profile && req.profile.isAdmin);
  const isListed = Boolean(req.profile) && config.admin.profileIds.includes(req.profile.id);

  if (!isFlagged && !isListed) {
    return next(new ForbiddenError("This endpoint requires an administrator profile"));
  }
  return next();
}

module.exports = { requireAdmin };
