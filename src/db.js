"use strict";

const Sequelize = require("sequelize");

const config = require("./config");

/** Per-Sequelize-instance FIFO queue for money-moving transactions. */
const writeQueues = new WeakMap();

/**
 * Build a Sequelize instance.
 *
 * Three connection-level settings matter for correctness rather than taste:
 *
 * - `PRAGMA foreign_keys = ON` — SQLite ignores foreign keys unless asked, so
 *   without it a Job can reference a Contract that does not exist.
 * - `PRAGMA journal_mode = WAL` — readers do not block the single writer, so a
 *   report query cannot stall a payment.
 * - `PRAGMA busy_timeout` — a writer that finds the lock taken waits instead of
 *   failing immediately.
 */
function createSequelize(overrides = {}) {
  const settings = { ...config.db, ...overrides };

  return new Sequelize({
    dialect: "sqlite",
    storage: settings.storage,
    logging: settings.logging ? console.log : false,
    hooks: {
      async afterConnect(connection) {
        connection.configure("busyTimeout", settings.busyTimeoutMs);
        await runPragma(connection, "PRAGMA journal_mode = WAL");
        await runPragma(connection, "PRAGMA foreign_keys = ON");
      },
    },
  });
}

function runPragma(connection, statement) {
  return new Promise((resolve, reject) => {
    connection.run(statement, (error) => (error ? reject(error) : resolve()));
  });
}

/**
 * Run `work` inside a transaction that is allowed to move money.
 *
 * Two things are going on here.
 *
 * `IMMEDIATE` takes SQLite's write lock at BEGIN. A DEFERRED transaction that
 * reads first and writes later can lose the lock race half way through, which
 * for a payment means the debit is rolled back after the caller was told
 * nothing.
 *
 * The queue exists because SQLite permits exactly one writer per database.
 * Without it, concurrent settlements pile onto the file lock and the losers
 * fail with SQLITE_BUSY after the busy timeout expires — a legitimate payment
 * turning into a 500. Serialising them in-process turns contention into a short
 * wait instead.
 *
 * The queue is a throughput measure and holds only within one process. The
 * guarantees that actually keep the ledger correct are in the database: the
 * conditional UPDATEs in the repositories and the UNIQUE index on
 * `Payments.JobId`. Those hold no matter how many processes are writing.
 */
function runInWriteTransaction(sequelize, work) {
  if (!writeQueues.has(sequelize)) {
    writeQueues.set(sequelize, { tail: Promise.resolve() });
  }
  const queue = writeQueues.get(sequelize);

  const run = () =>
    sequelize.transaction({ type: Sequelize.Transaction.TYPES.IMMEDIATE }, (transaction) =>
      work(transaction)
    );

  const result = queue.tail.then(run, run);
  queue.tail = result.then(ignore, ignore);
  return result;
}

function ignore() {}

module.exports = { createSequelize, runInWriteTransaction };
