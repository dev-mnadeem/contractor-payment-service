"use strict";

const { Op } = require("sequelize");

function createPaymentsRepository({ Payment, Job }) {
  return {
    async create(attributes, transaction) {
      return Payment.create(attributes, { transaction });
    },

    async findByIdempotencyKey(key, transaction) {
      return Payment.findOne({ where: { idempotencyKey: key }, transaction });
    },

    async findByJobId(jobId, transaction) {
      return Payment.findOne({ where: { JobId: jobId }, transaction });
    },

    /** The caller's payment history, as payer or as payee. */
    async listForProfile(profileId, { limit, offset }) {
      return Payment.findAndCountAll({
        where: {
          [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
        },
        include: [{ model: Job, attributes: ["id", "description"] }],
        order: [
          ["createdAt", "DESC"],
          ["id", "DESC"],
        ],
        limit,
        offset,
      });
    },
  };
}

module.exports = { createPaymentsRepository };
