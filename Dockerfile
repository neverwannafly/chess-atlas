# syntax=docker/dockerfile:1

# ---- build: frontend + backend in one stage ----
# Only this stage reads the build context; some builders (kaniko) drop the
# context between stages, so later stages copy exclusively from here.
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY frontend/ /app/frontend/
RUN cd /app/frontend && npm run build

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx tsc && npm prune --omit=dev

# ---- shared runtime base ----
FROM node:22-bookworm-slim AS runtime-base
# unzip: the FIDE monthly list is streamed out of its zip by the worker
RUN apt-get update && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    DATA_DIR=/data
WORKDIR /app/backend
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/package.json ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]

# ---- worker: chess-results + FIDE ingest, one process, own 30-minute cron ----
# Build: docker build --target worker .
FROM runtime-base AS worker
CMD ["node", "dist/chessresults/main.js"]

# ---- api: serves /api/* and the SPA ----
# Build: docker build --target api .
FROM runtime-base AS api
ENV PORT=8080
COPY --from=build /app/frontend/dist /app/frontend/dist
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]

# ---- combined (default, last stage): API and worker in one container, sharing one SQLite volume ----
# Build: docker build .   This is the image to deploy to API Frenzy (one replica, one volume).
FROM api AS combined
COPY backend/docker/start.sh ./start.sh
CMD ["sh", "start.sh"]
