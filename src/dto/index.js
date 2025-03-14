"use strict";

const money = require("../money");

/**
 * The wire format is decoupled from the column layout on purpose: amounts are
 * stored as integer cents but published as fixed two-decimal strings, so a
 * JSON consumer parsing them into a float cannot reintroduce the rounding
 * problem the cents columns exist to avoid.
 */

function profileToDto(profile) {
  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: `${profile.firstName} ${profile.lastName}`,
    profession: profile.profession,
    type: profile.type,
    balance: money.format(money.fromDatabase(profile.balanceCents)),
  };
}

function contractToDto(contract) {
  return {
    id: contract.id,
    terms: contract.terms,
    status: contract.status,
    clientId: contract.ClientId,
    contractorId: contract.ContractorId,
    createdAt: contract.createdAt,
  };
}

function jobToDto(job) {
  return {
    id: job.id,
    description: job.description,
    price: money.format(money.fromDatabase(job.priceCents)),
    paid: Boolean(job.paid),
    paymentDate: job.paymentDate ?? null,
    contractId: job.ContractId,
    contractStatus: job.Contract ? job.Contract.status : undefined,
  };
}

function paymentToDto(payment) {
  return {
    id: payment.id,
    jobId: payment.JobId,
    jobDescription: payment.Job ? payment.Job.description : undefined,
    clientId: payment.ClientId,
    contractorId: payment.ContractorId,
    amount: money.format(money.fromDatabase(payment.amountCents)),
    idempotencyKey: payment.idempotencyKey ?? null,
    createdAt: payment.createdAt,
  };
}

module.exports = { contractToDto, jobToDto, paymentToDto, profileToDto };
