"use strict";

const config = require("./config");
const { createApp } = require("./app");
const { Profile, sequelize } = require("./model");

const SHUTDOWN_GRACE_MS = 10000;

async function start() {
  try {
    await sequelize.authenticate();
  } catch (error) {
    console.error(
      `Cannot open the database at ${config.db.storage}: ${error.message}\n` +
        "Run `npm run seed` to create it."
    );
    process.exitCode = 1;
    return;
  }

  // An empty file is a valid SQLite database, so "can I connect" is not the
  // same question as "is there a schema". Say so once at boot rather than
  // letting every request fail with "no such table".
  try {
    await Profile.count();
  } catch {
    console.warn(`The database at ${config.db.storage} has no schema yet. Run \`npm run seed\`.`);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Contractor payment service listening on http://localhost:${config.port}`);
    console.log(`API reference at http://localhost:${config.port}/api-docs`);
  });

  server.on("error", (error) => {
    console.error(`Server failed to start: ${error.message}`);
    process.exitCode = 1;
  });

  /** Finish in-flight requests, then close the database handle. */
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS);
    forceExit.unref();
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start();
