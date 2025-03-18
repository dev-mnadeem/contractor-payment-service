"use strict";

const path = require("path");

const swaggerJsdoc = require("swagger-jsdoc");

const config = require("./config");

function buildOpenApiSpec() {
  return swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Contractor Payment Service",
        version: "1.0.0",
        description:
          "Clients hire contractors under contracts, contractors bill jobs against " +
          "those contracts, and clients settle them from a balance. Every amount is " +
          "stored as integer cents and published as a fixed two-decimal string.",
      },
      servers: [{ url: `http://localhost:${config.port}` }],
    },
    apis: [path.join(__dirname, "routes", "*.js")],
  });
}

module.exports = { buildOpenApiSpec };
