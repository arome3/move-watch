# Build stage
# Using Node 18 for isolated-vm compatibility (Node 20.19+ has V8 API changes)
FROM node:18-slim AS builder

# Install build dependencies for native modules (isolated-vm)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@8.15.0

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./

# Copy package.json files for all packages
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api ./apps/api
COPY packages/database ./packages/database
COPY packages/shared ./packages/shared

# Generate Prisma client
RUN pnpm --filter @movewatch/database db:generate

# Build all packages
RUN pnpm --filter @movewatch/shared build
RUN pnpm --filter @movewatch/api build

# Production stage
FROM node:18-slim AS runner

# Install runtime dependencies for isolated-vm
RUN apt-get update && apt-get install -y \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@8.15.0

WORKDIR /app

# Copy built assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Set environment
ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app/apps/api

EXPOSE 4000

# Use --no-node-snapshot for isolated-vm compatibility
CMD ["node", "--no-node-snapshot", "dist/index.js"]
