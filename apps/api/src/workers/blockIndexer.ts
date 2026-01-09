/**
 * Block Indexer Worker
 *
 * This worker runs as a separate process to poll Movement Network
 * for new blocks and trigger block-based actions.
 *
 * Usage:
 *   pnpm block-indexer        # Run with tsx
 *   node dist/workers/blockIndexer.js  # Run compiled
 *
 * Environment Variables:
 *   REDIS_URL - Redis connection URL
 *   DATABASE_URL - PostgreSQL connection URL
 *   MOVEMENT_NETWORK - Network to index (testnet, mainnet, devnet)
 */

import { getMovementClient } from '../lib/movement.js';
import { redis } from '../lib/redis.js';
import { processBlock } from '../services/actionProcessor.js';
import { startScheduler, stopScheduler, getSchedulerStats } from '../lib/scheduler.js';
import type { Network } from '@movewatch/shared';

// Configuration
const POLLING_INTERVAL_MS = parseInt(process.env.BLOCK_POLL_INTERVAL || '2000', 10);
const LAST_BLOCK_KEY_PREFIX = 'indexer:lastBlock:';

// Get network from environment
const network = (process.env.MOVEMENT_NETWORK || 'testnet') as Network;

// State
let isRunning = true;
let lastBlockHeight = 0;
let blocksProcessed = 0;
let actionsQueued = 0;

/**
 * Get the current block height from the network
 */
async function getCurrentBlockHeight(): Promise<number> {
  const client = getMovementClient(network);

  try {
    const ledgerInfo = await client.getLedgerInfo();
    return parseInt(ledgerInfo.block_height, 10);
  } catch (error) {
    console.error('[BlockIndexer] Failed to get ledger info:', error);
    throw error;
  }
}

/**
 * Get block info for a specific height
 */
async function getBlockInfo(height: number): Promise<{
  blockHeight: number;
  blockTime: string;
  blockHash: string;
} | null> {
  const client = getMovementClient(network);

  try {
    // Get block by height using the transactions API
    // Movement uses Aptos SDK which has getBlockByHeight
    const block = await client.getBlockByHeight({
      blockHeight: height,
      options: { withTransactions: false },
    });

    return {
      blockHeight: parseInt(block.block_height, 10),
      blockTime: block.block_timestamp,
      blockHash: block.block_hash,
    };
  } catch (error) {
    // Block may not exist yet
    console.debug(`[BlockIndexer] Block ${height} not found:`, error);
    return null;
  }
}

/**
 * Main polling loop
 */
async function pollLoop(): Promise<void> {
  const lastBlockKey = `${LAST_BLOCK_KEY_PREFIX}${network}`;

  // Get last processed block from Redis
  const lastBlockStr = await redis.get(lastBlockKey);
  if (lastBlockStr) {
    lastBlockHeight = parseInt(lastBlockStr, 10);
  } else {
    // Start from current block if no history
    lastBlockHeight = await getCurrentBlockHeight();
    await redis.set(lastBlockKey, lastBlockHeight.toString());
    console.log(`[BlockIndexer] Starting from block ${lastBlockHeight}`);
  }

  while (isRunning) {
    try {
      const currentHeight = await getCurrentBlockHeight();

      // Process any new blocks
      while (lastBlockHeight < currentHeight && isRunning) {
        const nextBlock = lastBlockHeight + 1;
        const blockInfo = await getBlockInfo(nextBlock);

        if (blockInfo) {
          // Process block triggers
          const executionIds = await processBlock(
            network,
            blockInfo.blockHeight,
            blockInfo.blockTime,
            blockInfo.blockHash
          );

          if (executionIds.length > 0) {
            console.log(
              `[BlockIndexer] Block ${blockInfo.blockHeight}: queued ${executionIds.length} actions`
            );
            actionsQueued += executionIds.length;
          }

          // Update last processed
          lastBlockHeight = nextBlock;
          await redis.set(lastBlockKey, lastBlockHeight.toString());
          blocksProcessed++;
        } else {
          // Block not available yet, wait and retry
          break;
        }
      }
    } catch (error) {
      console.error('[BlockIndexer] Poll error:', error);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));
  }
}

/**
 * Log statistics periodically
 */
async function statsLoop(): Promise<void> {
  while (isRunning) {
    await new Promise((resolve) => setTimeout(resolve, 60000)); // Every minute

    if (!isRunning) break;

    const schedulerStats = getSchedulerStats();
    console.log(
      `[BlockIndexer] Stats: blocks=${blocksProcessed} lastBlock=${lastBlockHeight} actionsQueued=${actionsQueued} schedules=${schedulerStats.activeJobs}`
    );
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('[BlockIndexer] Shutting down...');
  isRunning = false;
  stopScheduler();
  console.log('[BlockIndexer] Shutdown complete');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                 MoveWatch Block Indexer                     ║
╠════════════════════════════════════════════════════════════╣
║  Network: ${network.padEnd(48)} ║
║  Poll Interval: ${String(POLLING_INTERVAL_MS + 'ms').padEnd(42)} ║
║  Status: Starting...                                        ║
╚════════════════════════════════════════════════════════════╝
`);

  // Handle graceful shutdown signals
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT');
    await shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM');
    await shutdown();
    process.exit(0);
  });

  // Start the scheduler for cron-based actions
  await startScheduler(network);

  // Start loops concurrently
  await Promise.all([pollLoop(), statsLoop()]);
}

// Run the worker
main().catch((error) => {
  console.error('[BlockIndexer] Fatal error:', error);
  process.exit(1);
});
