"use strict";

const { UnauthenticatedError } = require("../errors");

/**
 * Identity comes from the `profile_id` request header. That is the scheme the
 * exercise specifies and it is deliberately kept — see the security note in the
 * README: the header is an assertion, not a proof, so this service must not be
 * exposed outside a trusted network without a real token in front of it.
 *
 * The header is checked for well-formedness before it reaches the database, so
 * an unauthenticated request is rejected without a query.
 */
function createGetProfile({ models }) {
  return async function getProfile(req, _res, next) {
    const raw = req.get("profile_id");
    const profileId = Number(raw);

    if (!raw || !Number.isInteger(profileId) || profileId < 1) {
      return next(new UnauthenticatedError());
    }

    const profile = await models.Profile.findByPk(profileId);
    if (!profile) {
      return next(new UnauthenticatedError("Unknown profile_id"));
    }

    req.profile = profile;
    return next();
  };
}

module.exports = { createGetProfile };
