"use strict";

const { ContractStatus } = require("../src/enums/ContractStatus");
const { ProfileType } = require("../src/enums/ProfileType");

const { CLIENT, CONTRACTOR } = ProfileType;
const { NEW, IN_PROGRESS, TERMINATED } = ContractStatus;

/**
 * The demo dataset. It is chosen to make every rule in the service visible from
 * a cold start, so the first request a reader makes shows something:
 *
 *  - job 2 is unpaid on an active contract  -> POST /jobs/2/pay succeeds
 *  - job 1 sits on a terminated contract    -> paying it answers 409
 *  - job 6 is already settled with a ledger -> paying it answers 409
 *  - Ash Ketchum (4) has 1.30 against a 200.00 job -> paying it answers 422
 *  - profile 9 is the administrator         -> /admin/* works for it alone
 *
 * Amounts are written as decimal strings and converted to cents on load, so the
 * fixture stays readable without reintroducing floats.
 */

const profiles = [
  {
    id: 1,
    firstName: "Harry",
    lastName: "Potter",
    profession: "Wizard",
    balance: "1150.00",
    type: CLIENT,
  },
  {
    id: 2,
    firstName: "Mr",
    lastName: "Robot",
    profession: "Hacker",
    balance: "231.11",
    type: CLIENT,
  },
  {
    id: 3,
    firstName: "John",
    lastName: "Snow",
    profession: "Night's Watch",
    balance: "451.30",
    type: CLIENT,
  },
  {
    id: 4,
    firstName: "Ash",
    lastName: "Ketchum",
    profession: "Pokemon Master",
    balance: "1.30",
    type: CLIENT,
  },
  {
    id: 5,
    firstName: "John",
    lastName: "Lennon",
    profession: "Musician",
    balance: "64.00",
    type: CONTRACTOR,
  },
  {
    id: 6,
    firstName: "Linus",
    lastName: "Torvalds",
    profession: "Programmer",
    balance: "1214.00",
    type: CONTRACTOR,
  },
  {
    id: 7,
    firstName: "Alan",
    lastName: "Turing",
    profession: "Programmer",
    balance: "22.00",
    type: CONTRACTOR,
  },
  {
    id: 8,
    firstName: "Aragorn",
    lastName: "Elessar",
    profession: "Fighter",
    balance: "314.00",
    type: CONTRACTOR,
  },
  {
    id: 9,
    firstName: "Ada",
    lastName: "Lovelace",
    profession: "Platform Operator",
    balance: "0.00",
    type: CLIENT,
    isAdmin: true,
  },
];

const contracts = [
  {
    id: 1,
    terms: "Session guitar work, cancelled after the first take",
    status: TERMINATED,
    ClientId: 1,
    ContractorId: 5,
  },
  {
    id: 2,
    terms: "Kernel scheduler audit, invoiced per module",
    status: IN_PROGRESS,
    ClientId: 1,
    ContractorId: 6,
  },
  {
    id: 3,
    terms: "Build-system migration, invoiced per milestone",
    status: IN_PROGRESS,
    ClientId: 2,
    ContractorId: 6,
  },
  {
    id: 4,
    terms: "Cryptanalysis retainer, monthly",
    status: IN_PROGRESS,
    ClientId: 2,
    ContractorId: 7,
  },
  { id: 5, terms: "Close protection, not yet started", status: NEW, ClientId: 3, ContractorId: 8 },
  { id: 6, terms: "Protocol design review", status: IN_PROGRESS, ClientId: 3, ContractorId: 7 },
  { id: 7, terms: "Type-system consulting", status: IN_PROGRESS, ClientId: 4, ContractorId: 7 },
  {
    id: 8,
    terms: "Driver port to a new architecture",
    status: IN_PROGRESS,
    ClientId: 4,
    ContractorId: 6,
  },
  {
    id: 9,
    terms: "Security escort for on-site work",
    status: IN_PROGRESS,
    ClientId: 4,
    ContractorId: 8,
  },
];

const jobs = [
  { id: 1, description: "Rehearsal day one", price: "200.00", paid: false, ContractId: 1 },
  {
    id: 2,
    description: "Scheduler audit: fair-share module",
    price: "201.00",
    paid: false,
    ContractId: 2,
  },
  {
    id: 3,
    description: "Build migration: first milestone",
    price: "202.00",
    paid: false,
    ContractId: 3,
  },
  {
    id: 4,
    description: "Cryptanalysis retainer, month one",
    price: "200.00",
    paid: false,
    ContractId: 4,
  },
  {
    id: 5,
    description: "Type-system review, week one",
    price: "200.00",
    paid: false,
    ContractId: 7,
  },
  {
    id: 6,
    description: "Type-system review, discovery phase",
    price: "2020.00",
    paid: true,
    paymentDate: "2020-08-15T19:11:26.737Z",
    ContractId: 7,
  },
  {
    id: 7,
    description: "Scheduler audit: preemption module",
    price: "200.00",
    paid: true,
    paymentDate: "2020-08-15T19:11:26.737Z",
    ContractId: 2,
  },
  {
    id: 8,
    description: "Build migration: toolchain survey",
    price: "200.00",
    paid: true,
    paymentDate: "2020-08-16T19:11:26.737Z",
    ContractId: 3,
  },
  {
    id: 9,
    description: "Rehearsal day two",
    price: "200.00",
    paid: true,
    paymentDate: "2020-08-17T19:11:26.737Z",
    ContractId: 1,
  },
  {
    id: 10,
    description: "Advance for close protection",
    price: "200.00",
    paid: true,
    paymentDate: "2020-08-17T19:11:26.737Z",
    ContractId: 5,
  },
  {
    id: 11,
    description: "Rehearsal room hire",
    price: "21.00",
    paid: true,
    paymentDate: "2020-08-10T19:11:26.737Z",
    ContractId: 1,
  },
  {
    id: 12,
    description: "Scheduler audit: tracing hooks",
    price: "21.00",
    paid: true,
    paymentDate: "2020-08-15T19:11:26.737Z",
    ContractId: 2,
  },
  {
    id: 13,
    description: "Build migration: cache layer",
    price: "121.00",
    paid: true,
    paymentDate: "2020-08-15T19:11:26.737Z",
    ContractId: 3,
  },
  {
    id: 14,
    description: "Build migration: reproducibility fixes",
    price: "121.00",
    paid: true,
    paymentDate: "2020-08-14T23:11:26.737Z",
    ContractId: 3,
  },
];

module.exports = { contracts, jobs, profiles };
