# syntax=docker/dockerfile:1

# Stage 1: Build & Dependencies
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install backend dependencies
COPY package*.json ./
RUN npm ci

# Copy full source
COPY . .

# Build web frontend
WORKDIR /usr/src/app/web
RUN npm ci
RUN npm run build

# Return to root and prune backend dev dependencies
WORKDIR /usr/src/app
RUN npm prune --production

# Stage 2: Production Runtime
FROM node:22-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=5000

# Copy application code, pruned production dependencies, and built web client
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/scripts ./scripts
COPY --from=builder /usr/src/app/.sequelizerc ./.sequelizerc
COPY --from=builder /usr/src/app/web/dist ./web/dist

# Security: Run as non-root node user
USER node

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5000) + '/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "scripts/migrate-and-start.js"]

