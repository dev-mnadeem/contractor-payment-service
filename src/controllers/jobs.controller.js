"use strict";

const { jobToDto, paymentToDto } = require("../dto");
const { parsePagination, toPage } = require("../pagination");

const HTTP_CREATED = 201;
const HTTP_OK = 200;

function createJobsController({ jobs, payments }) {
  return {
    async listUnpaid(req, res) {
      const page = parsePagination(req.query);
      const result = await jobs.listUnpaidForParty(req.profile.id, page);
      res.json(toPage(result, page, jobToDto));
    },

    /**
     * Owing nobody anything is a successful, empty answer rather than a 404.
     *
     * A replayed idempotent payment answers 200 rather than 201: the resource
     * already existed, this call did not create it.
     */
    async pay(req, res) {
      const { payment, replayed } = await payments.payJob({
        jobId: req.params.job_id,
        clientProfileId: req.profile.id,
        idempotencyKey: req.get("Idempotency-Key"),
      });

      res.status(replayed ? HTTP_OK : HTTP_CREATED).json({
        replayed,
        payment: paymentToDto(payment),
      });
    },
  };
}

module.exports = { createJobsController };
