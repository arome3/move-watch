# MoveWatch

A developer experience platform for Movement Network that provides transaction simulation, real-time monitoring, and automated alerting.

## Features

- **Transaction Simulator** - Preview transaction outcomes before execution, including gas costs, state changes, and events
- **Real-Time Monitoring** - Dashboard with transaction volume, success rates, and gas trends
- **Alerts & Notifications** - Get notified via Discord, Slack, Telegram, or webhooks when specific on-chain conditions occur

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, TailwindCSS, Zustand
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Supabase) with Prisma
- **Cache**: Redis (Upstash)
- **Blockchain**: Movement Network via @aptos-labs/ts-sdk
- **Build**: Turborepo, pnpm

## Project Structure

```
movewatch/
├── apps/
│   ├── api/          # Express.js backend
│   └── web/          # Next.js frontend
├── packages/
│   ├── database/     # Prisma schema & client
│   └── shared/       # Shared types & constants
└── docs/             # Feature documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL database (Supabase recommended)
- Redis instance (Upstash recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/movewatch.git
cd movewatch

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database and Redis credentials

# Generate Prisma client
pnpm db:generate

# Push database schema
pnpm db:push
```

### Development

```bash
# Start all services in development mode
pnpm dev
```

This will start:
- Web app at http://localhost:3000
- API server at http://localhost:4000