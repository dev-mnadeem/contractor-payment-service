"use strict";

const { NotFoundError } = require("../errors");

function createAdminController({ reports }) {
  return {
    async bestProfession(req, res) {
      const result = await reports.bestProfession(req.query);
      if (!result) {
        throw new NotFoundError("No jobs were paid in that date range");
      }
      res.json(result);
    },

    async bestClients(req, res) {
      res.json({ data: await reports.bestClients(req.query) });
    },
  };
}

module.exports = { createAdminController };
