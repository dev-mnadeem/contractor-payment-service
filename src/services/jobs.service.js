"use strict";

function createJobsService({ jobs }) {
  async function listUnpaidForParty(profileId, page) {
    return jobs.listUnpaidForParty(profileId, page);
  }

  return { listUnpaidForParty };
}

module.exports = { createJobsService };
