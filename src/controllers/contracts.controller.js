"use strict";

const { contractToDto } = require("../dto");
const { parsePagination, toPage } = require("../pagination");

function createContractsController({ contracts }) {
  return {
    async getById(req, res) {
      const contract = await contracts.getForParty(req.params.id, req.profile.id);
      res.json(contractToDto(contract));
    },

    async list(req, res) {
      const page = parsePagination(req.query);
      const result = await contracts.listForParty(req.profile.id, {
        status: req.query.status,
        ...page,
      });
      res.json(toPage(result, page, contractToDto));
    },
  };
}

module.exports = { createContractsController };
