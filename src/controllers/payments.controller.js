"use strict";

const { paymentToDto } = require("../dto");
const { parsePagination, toPage } = require("../pagination");

function createPaymentsController({ payments }) {
  return {
    async list(req, res) {
      const page = parsePagination(req.query);
      const result = await payments.listPayments(req.profile.id, page);
      res.json(toPage(result, page, paymentToDto));
    },
  };
}

module.exports = { createPaymentsController };
