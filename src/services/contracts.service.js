"use strict";

const { ALL_CONTRACT_STATUSES, PAYABLE_CONTRACT_STATUSES } = require("../enums/ContractStatus");
const { NotFoundError, ValidationError } = require("../errors");

function createContractsService({ contracts }) {
  async function getForParty(contractId, profileId) {
    const contract = await contracts.findForParty(contractId, profileId);
    if (!contract) {
      throw new NotFoundError("No contract with that id belongs to this profile");
    }
    return contract;
  }

  /**
   * Defaults to the statuses a client can still be billed under. `?status=` is
   * validated against the enum rather than passed through, so an unknown value
   * is a 400 and not an empty list the caller has to guess about.
   */
  async function listForParty(profileId, { status, limit, offset }) {
    const statuses = status ? parseStatuses(status) : PAYABLE_CONTRACT_STATUSES;
    return contracts.listForParty(profileId, { statuses, limit, offset });
  }

  return { getForParty, listForParty };
}

function parseStatuses(raw) {
  const requested = String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const unknown = requested.filter((value) => !ALL_CONTRACT_STATUSES.includes(value));
  if (unknown.length > 0) {
    throw new ValidationError(
      `Unknown contract status: ${unknown.join(", ")}. Valid values are ${ALL_CONTRACT_STATUSES.join(", ")}`
    );
  }
  return requested;
}

module.exports = { createContractsService };
