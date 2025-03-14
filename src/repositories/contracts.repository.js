"use strict";

const { Op } = require("sequelize");

function createContractsRepository({ Contract }) {
  /** A contract is only ever visible to the two profiles named on it. */
  const partyTo = (profileId) => ({
    [Op.or]: [{ ContractorId: profileId }, { ClientId: profileId }],
  });

  return {
    /**
     * Ownership is part of the WHERE clause, not a check performed after the
     * row is loaded. A contract belonging to somebody else is indistinguishable
     * from one that does not exist, so the endpoint is not an id oracle.
     */
    async findForParty(contractId, profileId, transaction) {
      return Contract.findOne({
        where: { id: contractId, ...partyTo(profileId) },
        transaction,
      });
    },

    async listForParty(profileId, { statuses, limit, offset }) {
      return Contract.findAndCountAll({
        where: { ...partyTo(profileId), status: statuses },
        order: [["id", "ASC"]],
        limit,
        offset,
      });
    },
  };
}

module.exports = { createContractsRepository };
