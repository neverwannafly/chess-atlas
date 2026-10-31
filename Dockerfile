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
COPY backend/docker/start.sh ./start.sh
RUN npx tsc && npm prune --omit=dev

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
# unzip: the FIDE monthly list is streamed out of its zip by the worker
RUN apt-get update && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data
WORKDIR /app/backend
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/package.json ./
COPY --from=build /app/frontend/dist /app/frontend/dist
COPY --from=build /app/backend/start.sh ./start.sh
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# API + chess-results worker (30-minute cron inside the worker process)
CMD ["sh", "start.sh"]
