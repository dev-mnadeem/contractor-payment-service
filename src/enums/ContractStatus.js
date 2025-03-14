"use strict";

const ContractStatus = {
  NEW: "new",
  IN_PROGRESS: "in_progress",
  TERMINATED: "terminated",
};

/** Contracts a client may still be billed under. */
const PAYABLE_CONTRACT_STATUSES = [ContractStatus.NEW, ContractStatus.IN_PROGRESS];

/** "Active" in the product sense: work is under way and jobs are billable now. */
const ACTIVE_CONTRACT_STATUSES = [ContractStatus.IN_PROGRESS];

const ALL_CONTRACT_STATUSES = Object.values(ContractStatus);

module.exports = {
  ACTIVE_CONTRACT_STATUSES,
  ALL_CONTRACT_STATUSES,
  ContractStatus,
  PAYABLE_CONTRACT_STATUSES,
};
