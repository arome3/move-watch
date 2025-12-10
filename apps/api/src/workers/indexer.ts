/**
 * Event Indexer Worker
 *
 * This worker runs as a separate process to poll Movement Network
 * for new transactions and trigger alerts.
 *
 * Usage:
 *   pnpm indexer        # Run with tsx
 *   node dist/workers/indexer.js  # Run compiled
 *
 * Environment Variables:
 *   REDIS_URL - Redis connection URL
 *   MOVEMENT_NETWORK - Network to index (testnet, mainnet, devnet)
 *   DATABASE_URL - PostgreSQL connection URL
 */

import { EventIndexer } from '../services/indexer.js';

// Get network from environment or default to testnet
const network = (process.env.MOVEMENT_NETWORK || 'testnet') as
  | 'mainnet'
  | 'testnet'
  | 'devnet';

// Create and start indexer
const indexer = new EventIndexer(network);

console.log(`
╔════════════════════════════════════════════════════════════╗
║                 MoveWatch Event Indexer                     ║
╠════════════════════════════════════════════════════════════╣
║  Network: ${network.padEnd(48)} ║
║  Status: Starting...                                        ║
╚════════════════════════════════════════════════════════════╝
`);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  indexer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  indexer.stop();
  process.exit(0);
});

// Start the indexer
indexer.start().catch((error) => {
  console.error('Failed to start indexer:', error);
  process.exit(1);
});
