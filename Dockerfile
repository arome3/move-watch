# Build stage
# Using full Node image for better native module compilation support
# isolated-vm requires specific V8 API compatibility
FROM node:18.17.0 AS builder

# Install pnpm
RUN npm install -g pnpm@8.15.0

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY pnpm-lock.yaml* ./

# Copy package.json files for all packages
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (not using frozen-lockfile since isolated-vm version changed)
RUN pnpm install

# Copy source code
COPY apps/api ./apps/api
COPY packages/database ./packages/database
COPY packages/shared ./packages/shared

# Generate Prisma client
RUN pnpm --filter @movewatch/database db:generate

# Build all packages
RUN pnpm --filter @movewatch/database build
RUN pnpm --filter @movewatch/shared build
RUN pnpm --filter @movewatch/api build

# Production stage
FROM node:18.17.0-slim AS runner

# Install runtime dependencies for isolated-vm, Prisma, and Aptos CLI
RUN apt-get update && apt-get install -y \
    libstdc++6 \
    openssl \
    curl \
    python3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Aptos CLI for detailed gas profiling
RUN curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3 && \
    mv /root/.local/bin/aptos /usr/local/bin/aptos && \
    chmod +x /usr/local/bin/aptos && \
    aptos --version

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
