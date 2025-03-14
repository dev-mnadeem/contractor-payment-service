"use strict";

const { profileToDto } = require("../dto");

function createBalancesController({ balances }) {
  return {
    async deposit(req, res) {
      const profile = await balances.deposit({
        actingProfile: req.profile,
        targetProfileId: Number(req.params.userId),
        amount: req.body.amount,
      });
      res.json({ message: "Deposit accepted", profile: profileToDto(profile) });
    },
  };
}

module.exports = { createBalancesController };
