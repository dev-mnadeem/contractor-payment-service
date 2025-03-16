"use strict";

const { Op, literal } = require("sequelize");

/**
 * All balance movement goes through here, and none of it reads a balance into
 * JavaScript first. `UPDATE ... SET balanceCents = balanceCents - :cents WHERE
 * id = :id AND balanceCents >= :cents` is evaluated by the database against the
 * row it is about to write, so two concurrent debits cannot both see the same
 * starting balance. The affected-row count is the answer to "did it fit?".
 */
function createProfilesRepository({ Profile }) {
  return {
    async findById(id, transaction) {
      return Profile.findByPk(id, { transaction });
    },

    /**
     * @returns {Promise<boolean>} false when the balance would have gone
     * negative, in which case nothing was written.
     */
    async debitIfSufficient(profileId, cents, transaction) {
      const [affected] = await Profile.update(
        { balanceCents: literal(`balanceCents - ${Number(cents)}`) },
        {
          where: { id: profileId, balanceCents: { [Op.gte]: cents } },
          transaction,
        }
      );
      return affected === 1;
    },

    async credit(profileId, cents, transaction) {
      const [affected] = await Profile.update(
        { balanceCents: literal(`balanceCents + ${Number(cents)}`) },
        { where: { id: profileId }, transaction }
      );
      return affected === 1;
    },
  };
}

module.exports = { createProfilesRepository };
