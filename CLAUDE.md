# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Start all services (web at :3000, API at :4000)
pnpm dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Database commands (run from root)
pnpm db:generate    # Generate Prisma client
pnpm db:push        # Push schema to database

# Run indexer worker (processes on-chain events for alerts)
pnpm --filter @movewatch/api indexer

# Clean all build artifacts
pnpm clean
```

## Architecture Overview

MoveWatch is a developer experience platform for Movement Network providing transaction simulation, alerts, and monitoring.

### Monorepo Structure (Turborepo + pnpm workspaces)

- **apps/api** - Express.js backend with simulation and alerts APIs
- **apps/web** - Next.js 14 frontend with Zustand state management
- **packages/database** - Prisma schema and generated client
- **packages/shared** - Shared TypeScript types and constants

### Key Data Flows

**Transaction Simulation:**
1. Frontend (`stores/simulator.ts`) builds `SimulationRequest` via `buildRequest()`
2. API (`services/simulation.ts`) uses `@aptos-labs/ts-sdk` to simulate against Movement Network
3. Results stored in PostgreSQL, cached in Redis with 30-day TTL
4. Shareable via `shareId` (nanoid-generated)

**Alerts System:**
1. Alerts configured with conditions: `tx_failed`, `balance_threshold`, `event_emitted`, `gas_spike`
2. Indexer worker (`workers/indexer.ts`) polls on-chain events
3. `alertProcessor.ts` matches events against alert conditions
4. `notifications.ts` sends to Discord/Slack/Telegram/webhooks

### Movement Network Integration

Uses `@aptos-labs/ts-sdk` with custom RPC endpoints configured in `packages/shared/src/constants.ts`:
- Mainnet: `https://mainnet.movementnetwork.xyz/v1`
- Testnet (Bardock): `https://aptos.testnet.bardock.movementlabs.xyz/v1`

`apps/api/src/lib/movement.ts` wraps SDK configuration. Function paths use format `0x1::module::function`.

### State Management (Frontend)

Zustand stores with persistence:
- `stores/simulator.ts` - Transaction builder form state with validation
- `stores/alerts.ts` - Alert management state

### Database Schema

Key models in `packages/database/prisma/schema.prisma`:
- `Simulation` - Stored simulation results with shareId for URL sharing
- `Alert` - User-configured monitoring rules with conditions stored as JSON
- `NotificationChannel` - Per-alert notification config (webhook URLs, bot tokens)
- `AlertTrigger` - Historical trigger records

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- `FRONTEND_URL` - For CORS and share URLs (default: http://localhost:3000)
