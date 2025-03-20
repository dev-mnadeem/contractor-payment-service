# syntax=docker/dockerfile:1

# ---- build stage -------------------------------------------------------------
# sqlite3 ships a prebuilt native binary, but the fetch happens in an install
# script. Doing it in a builder stage keeps the toolchain out of the runtime
# image while still leaving a working binding behind.
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

# ---- runtime stage -----------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3001 \
    DB_STORAGE=/data/database.sqlite3

WORKDIR /app

# The `node` user ships with the base image. Running as root would also make
# the mounted /data volume root-owned on the host.
RUN mkdir -p /data && chown -R node:node /data

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/readyz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
