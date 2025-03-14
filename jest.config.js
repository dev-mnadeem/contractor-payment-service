"use strict";

module.exports = {
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/src/__tests__/helpers/"],
  // Coverage is opt-in via `npm run test:coverage`; running it on every `npm test`
  // slows the watch loop down and writes a directory nobody asked for.
  collectCoverage: false,
  collectCoverageFrom: ["src/**/*.js", "!src/__tests__/**"],
  coverageDirectory: "coverage",
  // The concurrency tests queue real SQLite write transactions.
  testTimeout: 20000,
};
