"use strict";

const { Op, fn, col } = require("sequelize");

const { ACTIVE_CONTRACT_STATUSES, PAYABLE_CONTRACT_STATUSES } = require("../enums/ContractStatus");

function createJobsRepository({ Job, Contract, Profile }) {
  const UNPAID = { paid: false };

  return {
    /**
     * Unpaid jobs the profile is a party to, restricted to contracts that are
     * actually under way. Paginated because a long-lived client can accumulate
     * an unbounded number of them.
     */
    async listUnpaidForParty(profileId, { limit, offset }) {
      return Job.findAndCountAll({
        where: UNPAID,
        include: [
          {
            model: Contract,
            required: true,
            attributes: ["id", "status", "ClientId", "ContractorId"],
            where: {
              status: ACTIVE_CONTRACT_STATUSES,
              [Op.or]: [{ ContractorId: profileId }, { ClientId: profileId }],
            },
          },
        ],
        order: [["id", "ASC"]],
        limit,
        offset,
      });
    },

    /**
     * Load a job with its contract, but only if the caller is the client on
     * that contract. Authorisation is the join condition — an authenticated
     * contractor cannot reach a client's payment path at all.
     *
     * Balances are deliberately not loaded: both movements are conditional
     * UPDATEs, so a balance read here would only ever be stale.
     */
    async findPayableByClient(jobId, clientId, transaction) {
      return Job.findOne({
        where: { id: jobId },
        include: [
          {
            model: Contract,
            required: true,
            attributes: ["id", "status", "ClientId", "ContractorId"],
            where: { ClientId: clientId },
          },
        ],
        transaction,
      });
    },

    /**
     * Claim the job for payment. The `paid: false` predicate is the double-pay
     * guard: whichever transaction gets there first flips the flag, and every
     * other one sees zero rows affected.
     *
     * @returns {Promise<boolean>} false when the job was already paid.
     */
    async claimForPayment(jobId, paidAt, transaction) {
      const [affected] = await Job.update(
        { paid: true, paymentDate: paidAt },
        { where: { id: jobId, paid: false }, transaction }
      );
      return affected === 1;
    },

    /**
     * Total still owed by a client, summed by the database. A client with a
     * long history can have any number of unpaid jobs, so this must not become
     * "fetch every row and add up one column in JavaScript".
     *
     * Only contracts that can still be billed count: a job on a terminated
     * contract is refused at payment time, so it is not a debt the client can
     * settle here.
     */
    async sumUnpaidCentsForClient(clientId, transaction) {
      const total = await Job.sum("priceCents", {
        where: UNPAID,
        include: [
          {
            model: Contract,
            required: true,
            attributes: [],
            where: { ClientId: clientId, status: PAYABLE_CONTRACT_STATUSES },
          },
        ],
        transaction,
      });
      return Number(total) || 0;
    },

    /** Sum of paid job prices grouped by the contractor's profession. */
    async sumPaidByProfession({ from, to }) {
      return Job.findAll({
        where: { paid: true, paymentDate: { [Op.between]: [from, to] } },
        include: [
          {
            model: Contract,
            required: true,
            attributes: [],
            include: [{ model: Profile, as: "Contractor", attributes: [], required: true }],
          },
        ],
        attributes: [
          [col("Contract.Contractor.profession"), "profession"],
          [fn("SUM", col("priceCents")), "totalCents"],
        ],
        group: [col("Contract.Contractor.profession")],
        order: [[fn("SUM", col("priceCents")), "DESC"]],
        raw: true,
        subQuery: false,
      });
    },

    /** Sum of paid job prices grouped by the paying client. */
    async sumPaidByClient({ from, to, limit }) {
      return Job.findAll({
        where: { paid: true, paymentDate: { [Op.between]: [from, to] } },
        include: [
          {
            model: Contract,
            required: true,
            attributes: [],
            include: [{ model: Profile, as: "Client", attributes: [], required: true }],
          },
        ],
        attributes: [
          [col("Contract.Client.id"), "clientId"],
          [col("Contract.Client.firstName"), "firstName"],
          [col("Contract.Client.lastName"), "lastName"],
          [fn("SUM", col("priceCents")), "totalCents"],
        ],
        group: [
          col("Contract.Client.id"),
          col("Contract.Client.firstName"),
          col("Contract.Client.lastName"),
        ],
        order: [[fn("SUM", col("priceCents")), "DESC"]],
        limit,
        raw: true,
        subQuery: false,
      });
    },
  };
}

module.exports = { createJobsRepository };
