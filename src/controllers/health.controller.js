"use strict";

const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * Liveness answers "is the process up", readiness answers "can it serve
 * traffic" — which for this service means the SQLite file is reachable.
 * A container orchestrator needs both and they are not the same question.
 */
function createHealthController({ sequelize }) {
  return {
    live(_req, res) {
      res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
    },

    async ready(_req, res) {
      try {
        await sequelize.authenticate();
        res.json({ status: "ok", database: "reachable" });
      } catch (error) {
        res
          .status(HTTP_SERVICE_UNAVAILABLE)
          .json({ status: "degraded", database: "unreachable", detail: error.message });
      }
    },
  };
}

module.exports = { createHealthController };
