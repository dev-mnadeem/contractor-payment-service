"use strict";

const config = require("../config");
const { runInWriteTransaction } = require("../db");
const { ProfileType } = require("../enums/ProfileType");
const { ForbiddenError, ValidationError } = require("../errors");
const money = require("../money");

/**
 * A client may top up at most 25% of what they currently owe across unpaid
 * jobs. The cap is computed inside the same transaction as the credit, so a
 * concurrent payment cannot shrink the debt between the check and the write.
 *
 * The cap is rounded *down* to the cent — rounding a limit up would let a
 * depositor over-fund by a cent, which is the wrong direction for a limit.
 */
function createBalancesService({ sequelize, jobs, profiles }) {
  async function deposit({ actingProfile, targetProfileId, amount }) {
    if (actingProfile.type !== ProfileType.CLIENT) {
      throw new ForbiddenError("Only clients hold a spendable balance");
    }

    if (actingProfile.id !== targetProfileId) {
      throw new ForbiddenError("A profile may only deposit into its own balance");
    }

    const amountCents = money.toCents(amount);
    if (amountCents <= 0) {
      throw new ValidationError("amount must be greater than zero");
    }

    return runInWriteTransaction(sequelize, async (transaction) => {
      const owedCents = await jobs.sumUnpaidCentsForClient(actingProfile.id, transaction);
      const capCents = money.applyRatioFloor(owedCents, config.money.maxDepositRatioOfUnpaid);

      if (amountCents > capCents) {
        throw new ValidationError(
          `A deposit may not exceed ${Math.round(config.money.maxDepositRatioOfUnpaid * 100)}% of the ${money.format(owedCents)} currently owed`,
          { owed: money.format(owedCents), maxDeposit: money.format(capCents) }
        );
      }

      await profiles.credit(actingProfile.id, amountCents, transaction);
      return profiles.findById(actingProfile.id, transaction);
    });
  }

  return { deposit };
}

module.exports = { createBalancesService };
