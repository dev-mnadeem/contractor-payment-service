"use strict";

const Sequelize = require("sequelize");

const { createSequelize } = require("./db");
const { ALL_CONTRACT_STATUSES, ContractStatus } = require("./enums/ContractStatus");
const { ALL_PROFILE_TYPES } = require("./enums/ProfileType");

/**
 * Schema notes that are load-bearing rather than cosmetic:
 *
 * - Every monetary column holds an integer number of cents (`BIGINT`). The
 *   original schema used DECIMAL(12,2), which SQLite stores as REAL and
 *   Sequelize hands back as a JS number — so balances drifted by fractions of a
 *   cent under repeated arithmetic.
 * - `Payment` is an append-only ledger. `JobId` is UNIQUE, which makes
 *   "a job is paid at most once" an invariant the database enforces rather than
 *   something the application remembers to check.
 * - `idempotencyKey` is UNIQUE so a retried POST cannot pay twice.
 */
function defineModels(sequelize) {
  class Profile extends Sequelize.Model {}
  Profile.init(
    {
      firstName: { type: Sequelize.STRING, allowNull: false },
      lastName: { type: Sequelize.STRING, allowNull: false },
      profession: { type: Sequelize.STRING, allowNull: false },
      /** Integer cents. Never negative: the debit query refuses to overdraw. */
      balanceCents: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      type: {
        type: Sequelize.ENUM(...ALL_PROFILE_TYPES),
        allowNull: false,
      },
      /** Gates the /admin reporting endpoints. */
      isAdmin: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Profile",
      indexes: [{ fields: ["type"] }],
    }
  );

  class Contract extends Sequelize.Model {}
  Contract.init(
    {
      terms: { type: Sequelize.TEXT, allowNull: false },
      status: {
        type: Sequelize.ENUM(...ALL_CONTRACT_STATUSES),
        allowNull: false,
        defaultValue: ContractStatus.NEW,
      },
    },
    {
      sequelize,
      modelName: "Contract",
      indexes: [{ fields: ["ClientId", "status"] }, { fields: ["ContractorId", "status"] }],
    }
  );

  class Job extends Sequelize.Model {}
  Job.init(
    {
      description: { type: Sequelize.TEXT, allowNull: false },
      /** Integer cents, fixed when the job is created. Never taken from a request body. */
      priceCents: {
        type: Sequelize.BIGINT,
        allowNull: false,
        validate: { min: 1 },
      },
      paid: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      paymentDate: { type: Sequelize.DATE },
    },
    {
      sequelize,
      modelName: "Job",
      indexes: [{ fields: ["ContractId", "paid"] }, { fields: ["paid", "paymentDate"] }],
    }
  );

  class Payment extends Sequelize.Model {}
  Payment.init(
    {
      /** Cents actually moved. Copied from Job.priceCents at settlement time. */
      amountCents: {
        type: Sequelize.BIGINT,
        allowNull: false,
        validate: { min: 1 },
      },
      /**
       * Caller-supplied `Idempotency-Key` header. NULL is allowed and, per the
       * SQL standard, NULLs do not collide in a unique index — so unkeyed
       * payments are still protected by the unique JobId.
       */
      idempotencyKey: { type: Sequelize.STRING, unique: true },
    },
    {
      sequelize,
      modelName: "Payment",
      updatedAt: false,
      indexes: [
        { fields: ["JobId"], unique: true },
        { fields: ["ClientId", "createdAt"] },
        { fields: ["ContractorId", "createdAt"] },
      ],
    }
  );

  Profile.hasMany(Contract, { as: "Contractor", foreignKey: "ContractorId" });
  Contract.belongsTo(Profile, { as: "Contractor" });
  Profile.hasMany(Contract, { as: "Client", foreignKey: "ClientId" });
  Contract.belongsTo(Profile, { as: "Client" });
  Contract.hasMany(Job);
  Job.belongsTo(Contract);

  Job.hasOne(Payment);
  Payment.belongsTo(Job);
  Payment.belongsTo(Profile, { as: "Client", foreignKey: "ClientId" });
  Payment.belongsTo(Profile, { as: "Contractor", foreignKey: "ContractorId" });

  return { Profile, Contract, Job, Payment };
}

const sequelize = createSequelize();
const models = defineModels(sequelize);

module.exports = { defineModels, sequelize, ...models };
