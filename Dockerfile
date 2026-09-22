# ==============================================================================
# FinTrack Production Multi-Stage Dockerfile (Google Cloud Run Target)
# ==============================================================================
# 1. Builder Stage: Build Frontend static bundle & Backend TypeScript
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm install --prefix server
RUN npm install --prefix client

# Copy application source code
COPY server ./server
COPY client ./client

# Build Client static SPA and Server TypeScript output
RUN npm run build --prefix client
RUN npm run build --prefix server

# ==============================================================================
# 2. Production Runner Stage: Minimal footprint & hardened container
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Create an unprivileged user for security
RUN addgroup -g 1001 -S fintrack && \
    adduser -u 1001 -S fintrack -G fintrack

# Copy server package definitions and install production-only dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev && npm cache clean --force

# Copy built server and client artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/db/schema.sql ./server/dist/db/schema.sql
COPY --from=builder /app/client/dist ./client/dist

# Create local data directory with appropriate permissions for SQLite fallback
RUN mkdir -p /app/data && chown -R fintrack:fintrack /app

USER fintrack

# Expose container port (Default 8080 for Google Cloud Run)
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/api/health || exit 1

CMD ["node", "server/dist/index.js"]
