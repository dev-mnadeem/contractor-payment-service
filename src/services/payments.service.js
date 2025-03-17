"use strict";

const { UniqueConstraintError } = require("sequelize");

const { runInWriteTransaction } = require("../db");
const { ContractStatus } = require("../enums/ContractStatus");
const {
  ConflictError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} = require("../errors");
const money = require("../money");

const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

/**
 * Settling a job moves money between two balances and flips a flag. Getting
 * that wrong is the expensive kind of bug, so the order of operations is
 * deliberate:
 *
 *   1. Replay an earlier result if the caller sent a key we have already settled.
 *   2. Load the job *scoped to the paying client* — authorisation is the join.
 *   3. Claim the job with a conditional UPDATE. Winning that claim is what
 *      makes the rest of the work exclusive.
 *   4. Debit the client with a conditional UPDATE that refuses to overdraw.
 *   5. Credit the contractor.
 *   6. Append a ledger row. `Payments.JobId` is UNIQUE, so even if every check
 *      above were wrong, the database still refuses the second payment.
 *
 * Steps 2-6 run in one IMMEDIATE transaction. Any throw rolls back the job
 * status and both balances together — there is no window where a job reads as
 * paid but the contractor was never credited.
 *
 * The amount is never read from the request body. It comes from
 * `Job.priceCents`, which is fixed when the job is created.
 */
function createPaymentsService({ sequelize, jobs, profiles, payments }) {
  async function payJob({ jobId, clientProfileId, idempotencyKey }) {
    const key = normaliseIdempotencyKey(idempotencyKey);

    return runInWriteTransaction(sequelize, async (transaction) => {
      if (key) {
        const replay = await payments.findByIdempotencyKey(key, transaction);
        if (replay) {
          if (replay.JobId !== Number(jobId) || replay.ClientId !== clientProfileId) {
            throw new ConflictError(
              "This Idempotency-Key was already used for a different payment",
              "idempotency_key_reused"
            );
          }
          return { payment: replay, replayed: true };
        }
      }

      const job = await jobs.findPayableByClient(jobId, clientProfileId, transaction);
      if (!job) {
        throw new NotFoundError("No payable job with that id belongs to this client");
      }

      if (job.Contract.status === ContractStatus.TERMINATED) {
        throw new ConflictError(
          "The contract for this job has been terminated",
          "contract_terminated"
        );
      }

      const amountCents = money.fromDatabase(job.priceCents);
      const contractorId = job.Contract.ContractorId;

      const claimed = await jobs.claimForPayment(jobId, new Date(), transaction);
      if (!claimed) {
        throw new ConflictError("This job has already been paid", "job_already_paid");
      }

      const debited = await profiles.debitIfSufficient(clientProfileId, amountCents, transaction);
      if (!debited) {
        throw new InsufficientFundsError(
          `Paying this job requires ${money.format(amountCents)} and the balance does not cover it`
        );
      }

      await profiles.credit(contractorId, amountCents, transaction);

      try {
        const payment = await payments.create(
          {
            JobId: job.id,
            ClientId: clientProfileId,
            ContractorId: contractorId,
            amountCents,
            idempotencyKey: key,
          },
          transaction
        );
        return { payment, replayed: false };
      } catch (error) {
        if (error instanceof UniqueConstraintError) {
          throw new ConflictError("This job has already been paid", "job_already_paid");
        }
        throw error;
      }
    });
  }

  async function listPayments(profileId, page) {
    return payments.listForProfile(profileId, page);
  }

  return { listPayments, payJob };
}

function normaliseIdempotencyKey(value) {
  if (value === undefined || value === null || value === "") return null;
  const key = String(value).trim();
  if (!key) return null;
  if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new ValidationError(
      `Idempotency-Key may be at most ${IDEMPOTENCY_KEY_MAX_LENGTH} characters`
    );
  }
  return key;
}

module.exports = { IDEMPOTENCY_KEY_MAX_LENGTH, createPaymentsService };
