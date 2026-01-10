<p align="center">
  <img src="move_watch.png" alt="MoveWatch Logo" width="200">
</p>

<h1 align="center">MoveWatch</h1>

<p align="center">
  <strong>Developer Experience Platform for Movement Network</strong><br>
  Transaction simulation, real-time monitoring, AI-powered security analysis, and automated Web3 actions.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#deployment">Deployment</a>
</p>

---

## Features

### Transaction Simulator

Preview transaction outcomes before execution with detailed insights:

- **Gas Estimation** - Computational and storage costs breakdown
- **State Changes** - Resource modifications preview
- **Event Logs** - Emitted events with decoded data
- **Error Detection** - Detailed error messages with suggestions
- **Fork Simulation** - Test against historical blockchain state with state overrides
- **Execution Trace** - Call stack visualization and flamegraphs
- **AI Explanation** - Human-readable transaction summaries

### Guardian Risk Analyzer

AI-powered transaction security analysis with 23 detection patterns:

| Category | Patterns |
|----------|----------|
| **Exploit Detection** | Integer overflow, oracle manipulation, flash loans, reentrancy, MEV/sandwich attacks |
| **Rug Pull Indicators** | Liquidity removal, ownership transfer, unlimited minting, blacklist functions |
| **Permission Issues** | Missing access control, unprotected admin functions, unsafe upgrades |
| **Move-Specific** | MWC-101 resource leaks, MWC-105 generic type vulnerabilities |

**Analysis Pipeline:**
1. Transaction simulation
2. On-chain bytecode verification
3. Pattern matching against known vulnerabilities
4. Static analysis (CFG, overflow, privilege checks)
5. Threat intelligence cross-referencing
6. Optional Claude AI deep analysis
7. Risk scoring and recommendations

### Real-Time Monitoring Dashboard

- **Transaction Volume** - 24h, 7d, 30d metrics
- **Success/Failure Rates** - With trend analysis
- **Gas Analytics** - Usage trends and anomaly detection
- **Event Stream** - Live event feed with filtering
- **Watched Contracts** - Monitor specific modules

### Alerts & Notifications

**7 Alert Condition Types:**

| Condition | Description |
|-----------|-------------|
| `tx_failed` | Transaction failure detection |
| `balance_threshold` | Account balance monitoring (gt, lt, eq, gte, lte) |
| `event_emitted` | On-chain event filtering |
| `gas_spike` | Gas usage anomalies |
| `function_call` | Specific function invocations |
| `token_transfer` | Token movement tracking |
| `large_transaction` | Threshold-based detection |

**5 Notification Channels:**
- Discord (rich embeds)
- Slack (incoming webhooks)
- Telegram (bot API)
- Webhooks (generic HTTP POST)
- Email (SMTP with templates)

### Web3 Actions

Autonomous TypeScript scripts triggered by blockchain events:

```typescript
// Example: Liquidation monitor
export async function execute(ctx: ActionContext) {
  const position = await ctx.getAccountResource(
    ctx.secrets.VAULT_ADDRESS,
    '0x1::vault::Position'
  );

  if (position.health_factor < 1.1) {
    await ctx.fetch('https://api.discord.com/webhooks/...', {
      method: 'POST',
      body: JSON.stringify({ content: `Low health: ${position.health_factor}` })
    });
  }
}
```

**Trigger Types:**
- `event` - On-chain event emission
- `block` - Every N blocks
- `schedule` - Cron expressions with timezone support
- `webhook` - External HTTP requests

**Sandbox Features:**
- Isolated-VM execution (128MB memory, 30s timeout)
- On-chain data access via Aptos SDK
- HTTP requests with SSRF protection
- Encrypted secrets (AES-256-GCM)
- State persistence

### x402 Micropayments

Pay-per-use API access for AI agents and trading bots:

```
Client Request → 402 Payment Required → Sign MOVE Transaction → Retry with X-Payment Header → Success
```

- No authentication required
- Per-endpoint pricing in MOVE
- Free tier with daily/monthly limits
- Instant verification and settlement

---

## Architecture

```
movewatch/
├── apps/
│   ├── api/                    # Express.js backend (port 4000)
│   │   ├── src/
│   │   │   ├── routes/         # 65+ API endpoints
│   │   │   ├── services/       # Business logic
│   │   │   │   └── guardian/   # 28 files, 14+ analyzers
│   │   │   ├── lib/            # Utilities, workers, SDK wrappers
│   │   │   └── middleware/     # Auth, rate limiting, payments
│   │   └── scripts/            # CLI utilities
│   └── web/                    # Next.js 14 frontend (port 3000)
│       └── src/
│           ├── app/            # 14 pages (App Router)
│           ├── components/     # 100+ React components
│           ├── stores/         # Zustand state management
│           └── providers/      # Context providers
├── packages/
│   ├── database/               # Prisma schema (23 models)
│   └── shared/                 # TypeScript types & constants
└── contracts/                  # Move contracts for testing
```

### Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Next.js 14, TypeScript, TailwindCSS, Zustand, React Query, Framer Motion |
| **Backend** | Express.js, TypeScript, Prisma ORM |
| **Database** | PostgreSQL (Supabase compatible) |
| **Cache** | Redis (Upstash compatible) |
| **Blockchain** | `@aptos-labs/ts-sdk` with Movement Network |
| **Auth** | NextAuth.js (OAuth + email magic links) |
| **Sandbox** | `isolated-vm` for action execution |
| **Build** | Turborepo, pnpm workspaces |

### Background Workers

| Worker | Purpose |
|--------|---------|
| **Event Indexer** | Polls Movement Network for new transactions (5s interval) |
| **Scheduler** | Manages cron-based action triggers |
| **Balance Checker** | Monitors account balances for alerts |
| **Notification Queue** | Processes notifications with retry logic |
| **Action Processor** | Executes sandboxed user code |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 15+
- Redis 7+
- Docker (optional, for local databases)

### Quick Start with Docker

```bash
# Start PostgreSQL and Redis
docker run -d --name movewatch-postgres -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=movewatch postgres:15

docker run -d --name movewatch-redis -p 6379:6379 redis:7-alpine

# Clone and install
git clone https://github.com/your-org/movewatch.git
cd movewatch
pnpm install

# Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Edit .env files with your configuration

# Initialize database
pnpm db:push

# Start development servers
pnpm dev
```

### Generate Simulation Account

Movement Network requires a funded account for transaction simulation:

```bash
# Generate new account
bun x tsx apps/api/scripts/generate-simulation-account.ts

# Fund via faucet (testnet)
curl -X POST "https://faucet.testnet.movementnetwork.xyz/mint?address=YOUR_ADDRESS&amount=100000000"

# Add to apps/api/.env
SIMULATION_ACCOUNT_PRIVATE_KEY=0x...
```

### Development Commands

```bash
pnpm dev              # Start all services (web :3000, api :4000)
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to database
pnpm clean            # Clean build artifacts

# Production workers (run separately)
pnpm --filter @movewatch/api action-worker
```

---

## API Reference

### Simulation

| Endpoint | Description |
|----------|-------------|
| `POST /v1/simulate` | Simulate transaction |
| `GET /v1/sim/:shareId` | Get shared simulation |
| `GET /v1/simulate/cli-status` | Check Aptos CLI availability |
| `GET /v1/simulate/state-override-support` | Check fork simulation support |

### Guardian

| Endpoint | Description |
|----------|-------------|
| `POST /v1/guardian/check` | Analyze transaction security |
| `POST /v1/guardian/check/agent` | Analyze with x402 payment |
| `GET /v1/guardian/check/:shareId` | Get shared analysis |
| `GET /v1/guardian/patterns` | List detection patterns |
| `GET /v1/guardian/demo` | Demo transactions |

### Alerts

| Endpoint | Description |
|----------|-------------|
| `GET /v1/alerts` | List user alerts |
| `POST /v1/alerts` | Create alert |
| `GET/PATCH/DELETE /v1/alerts/:id` | Manage alert |
| `POST /v1/alerts/:id/test` | Test notifications |
| `GET /v1/alerts/:id/triggers` | Trigger history |

### Notification Channels

| Endpoint | Description |
|----------|-------------|
| `GET/POST /v1/channels` | List/create channels |
| `GET/PATCH/DELETE /v1/channels/:id` | Manage channel |
| `POST /v1/channels/:id/test` | Test delivery |

### Web3 Actions

| Endpoint | Description |
|----------|-------------|
| `GET /v1/actions/templates` | Template gallery |
| `GET/POST /v1/actions` | List/create actions |
| `GET/PATCH/DELETE /v1/actions/:id` | Manage action |
| `POST /v1/actions/:id/test` | Test execution |
| `GET /v1/actions/:id/executions` | Execution history |
| `GET/POST/DELETE /v1/actions/:id/secrets` | Manage secrets |

### Monitoring

| Endpoint | Description |
|----------|-------------|
| `GET /v1/monitoring/stats` | Dashboard statistics |
| `GET /v1/monitoring/transactions` | Transaction history |
| `GET /v1/monitoring/events` | Event stream |
| `GET /v1/monitoring/gas` | Gas analytics |
| `GET/POST/DELETE /v1/monitoring/contracts` | Watched contracts |

### Payments

| Endpoint | Description |
|----------|-------------|
| `GET /v1/payments` | Payment history |
| `GET /v1/payments/stats` | Payment statistics |
| `GET /v1/payments/usage` | Quota usage |
| `GET /v1/payments/pricing` | Pricing config |

### Health

| Endpoint | Description |
|----------|-------------|
| `GET /livez` | Liveness probe (k8s) |
| `GET /readyz` | Readiness probe (k8s) |
| `GET /health` | Full health check |

---

## Environment Variables

### Required

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/movewatch

# Redis (choose one)
REDIS_URL=redis://localhost:6379
# OR
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# URLs
FRONTEND_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-32-char-secret
```

### Simulation

```bash
SIMULATION_ACCOUNT_PRIVATE_KEY=0x...  # Funded Movement account
MOVEMENT_NETWORK=testnet              # mainnet/testnet/devnet
```

### Web3 Actions

```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SECRETS_ENCRYPTION_KEY=64-char-hex-string
WORKER_CONCURRENCY=3
```

### Optional

```bash
ANTHROPIC_API_KEY=...     # For AI-powered Guardian analysis
DISABLE_PAYMENTS=true     # Disable x402 in development
PORT=4000                 # API server port
```

---

## Movement Network

### Supported Networks

| Network | Fullnode URL | Indexer URL |
|---------|--------------|-------------|
| **Mainnet** | `https://mainnet.movementnetwork.xyz/v1` | `https://indexer.mainnet.movementnetwork.xyz/v1/graphql` |
| **Testnet** | `https://testnet.movementnetwork.xyz/v1` | `https://hasura.testnet.movementnetwork.xyz/v1/graphql` |

### Function Path Format

```
0x1::module_name::function_name
```

Example: `0x1::coin::transfer`

---

## Database Schema

### Core Models

| Model | Purpose |
|-------|---------|
| `User` | Authentication with tier system (FREE/PRO/TEAM/ENTERPRISE) |
| `Simulation` | Cached simulation results (30-day TTL, shareable) |
| `Alert` | Monitoring rules with JSON conditions |
| `NotificationChannel` | Reusable notification destinations |
| `AlertTrigger` | Historical trigger records |
| `Action` | User-defined automation scripts |
| `ActionSecret` | AES-256-GCM encrypted secrets |
| `ActionExecution` | Execution logs and metrics |
| `GuardianCheck` | Security analysis results (shareable) |
| `GuardianIssue` | Individual risk findings |
| `Payment` | x402 transaction records |
| `UsageQuota` | Daily/monthly limits |
| `ApiKey` | Programmatic API access |

---

## Deployment

### Vercel

The frontend is optimized for Vercel deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Required environment variables in Vercel dashboard:
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

### Docker

```dockerfile
# Multi-stage build included
docker build -t movewatch-api ./apps/api
docker build -t movewatch-web ./apps/web
```

### Health Checks

- `/livez` - Immediate response for k8s liveness
- `/readyz` - Database connectivity for k8s readiness
- `/health` - Full dependency status

---

## User Tiers

| Tier | Features |
|------|----------|
| **FREE** | Rate-limited access, basic alerts |
| **PRO** | Unlimited simulations, Guardian scans, alerts, actions |
| **TEAM** | Collaboration features, shared dashboards |
| **ENTERPRISE** | API access, SLA, dedicated support |

---

## Security

- **Sandbox Isolation** - User code runs in isolated-vm with memory/time limits
- **Secret Encryption** - AES-256-GCM for action secrets
- **SSRF Protection** - HTTP requests filtered for internal networks
- **Rate Limiting** - Per-user and per-endpoint limits
- **Circuit Breakers** - Prevent cascading failures in external services

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built for <a href="https://movementlabs.xyz">Movement Network</a>
</p>
