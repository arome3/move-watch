import { getMovementClient } from '../lib/movement.js';
import { redis } from '../lib/redis.js';
import { getActiveAlerts } from './alerts.js';
import { evaluateAlertConditions, type IndexedEvent } from './alertProcessor.js';
import { processEvent as processActionEvent, processBlock as processActionBlock } from './actionProcessor.js';
import { recordTransaction } from './metricsService.js';

// Configuration
const POLLING_INTERVAL_MS = 5000; // 5 seconds
const LAST_PROCESSED_KEY_PREFIX = 'indexer:lastProcessedVersion:';
const LAST_PROCESSED_BLOCK_KEY_PREFIX = 'indexer:lastProcessedBlock:';
const MAX_TRANSACTIONS_PER_POLL = 100;

/**
 * Event Indexer Service
 * Polls Movement Network for new transactions and triggers alerts
 */
export class EventIndexer {
  private isRunning = false;
  private network: 'mainnet' | 'testnet' | 'devnet';
  private pollIntervalMs: number;

  constructor(
    network: 'mainnet' | 'testnet' | 'devnet' = 'testnet',
    pollIntervalMs: number = POLLING_INTERVAL_MS
  ) {
    this.network = network;
    this.pollIntervalMs = pollIntervalMs;
  }

  /**
   * Start the indexer polling loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log(`Indexer for ${this.network} already running`);
      return;
    }

    this.isRunning = true;
    console.log(`Starting event indexer for ${this.network} (polling every ${this.pollIntervalMs}ms)`);

    while (this.isRunning) {
      try {
        await this.poll();
      } catch (error) {
        console.error(`Indexer poll error (${this.network}):`, error);
      }
      await this.sleep(this.pollIntervalMs);
    }

    console.log(`Indexer for ${this.network} stopped`);
  }

  /**
   * Stop the indexer
   */
  stop(): void {
    console.log(`Stopping indexer for ${this.network}...`);
    this.isRunning = false;
  }

  /**
   * Check if indexer is running
   */
  getStatus(): { running: boolean; network: string } {
    return {
      running: this.isRunning,
      network: this.network,
    };
  }

  /**
   * Poll for new transactions and process them
   */
  private async poll(): Promise<void> {
    const client = getMovementClient(this.network);
    const lastProcessedKey = `${LAST_PROCESSED_KEY_PREFIX}${this.network}`;

    // Get last processed version
    const lastVersionStr = await redis.get(lastProcessedKey);
    const lastVersion = lastVersionStr ? BigInt(lastVersionStr) : BigInt(0);

    // Fetch transactions starting from last processed version
    try {
      const transactions = await client.getTransactions({
        options: {
          offset: Number(lastVersion),
          limit: MAX_TRANSACTIONS_PER_POLL,
        },
      });

      if (transactions.length === 0) {
        // No new transactions, but still process block triggers
        await this.processBlockTriggers(client);
        return;
      }

      // Get all active alerts for this network
      const alerts = await getActiveAlerts(this.network);

      if (alerts.length === 0) {
        // No active alerts, but still update last processed version
        const maxVersion = this.getMaxVersion(transactions);
        await redis.set(lastProcessedKey, maxVersion.toString());
        return;
      }

      // Process each transaction
      for (const tx of transactions) {
        const events = this.extractEvents(tx);

        // Record transaction metrics
        const txEvent = events.find((e) => e.type === '_transaction');
        if (txEvent && txEvent.moduleAddress) {
          try {
            await recordTransaction(
              txEvent.moduleAddress,
              txEvent.success,
              txEvent.gasUsed,
              this.network
            );
          } catch (metricsError) {
            // Don't fail indexer for metrics errors
            console.error('Error recording metrics:', metricsError);
          }
        }

        for (const event of events) {
          // Process alerts
          await evaluateAlertConditions(event, alerts);

          // Process Web3 Actions (event triggers)
          // Skip synthetic _transaction events for actions
          if (event.type !== '_transaction') {
            try {
              await processActionEvent(
                this.network,
                event.type,
                event.data,
                event.transactionHash
              );
            } catch (actionError) {
              console.error('Error processing action event:', actionError);
              // Don't fail the entire indexer if action processing fails
            }
          }
        }
      }

      // Update last processed version
      const maxVersion = this.getMaxVersion(transactions);
      await redis.set(lastProcessedKey, maxVersion.toString());

      console.log(
        `Processed ${transactions.length} transactions, version ${lastVersion} -> ${maxVersion}`
      );

      // Process block triggers
      await this.processBlockTriggers(client);
    } catch (error) {
      // Log error but don't crash - we'll retry on next poll
      console.error('Error fetching transactions:', error);
    }
  }

  /**
   * Process block-triggered actions
   * Checks for new blocks and fires block triggers
   */
  private async processBlockTriggers(client: ReturnType<typeof getMovementClient>): Promise<void> {
    const lastBlockKey = `${LAST_PROCESSED_BLOCK_KEY_PREFIX}${this.network}`;

    try {
      // Get current ledger info to find latest block height
      const ledgerInfo = await client.getLedgerInfo();
      const currentBlockHeight = parseInt(ledgerInfo.block_height, 10);

      // Get last processed block height
      const lastBlockStr = await redis.get(lastBlockKey);
      const lastProcessedBlock = lastBlockStr ? parseInt(lastBlockStr, 10) : currentBlockHeight - 1;

      // Process any new blocks
      if (currentBlockHeight > lastProcessedBlock) {
        const blocksToProcess = Math.min(
          currentBlockHeight - lastProcessedBlock,
          10 // Cap at 10 blocks per poll to avoid overwhelming
        );

        for (let i = 0; i < blocksToProcess; i++) {
          const blockHeight = lastProcessedBlock + 1 + i;

          try {
            // Get block info for timestamp
            const block = await client.getBlockByHeight({
              blockHeight,
              options: { withTransactions: false },
            });

            const blockTime = new Date(parseInt(block.block_timestamp, 10) / 1000).toISOString();
            const blockHash = block.block_hash;

            // Process block triggers for actions
            const executionIds = await processActionBlock(
              this.network,
              blockHeight,
              blockTime,
              blockHash
            );

            if (executionIds.length > 0) {
              console.log(
                `[Indexer] Block ${blockHeight}: triggered ${executionIds.length} action(s)`
              );
            }
          } catch (blockError) {
            console.error(`[Indexer] Error processing block ${blockHeight}:`, blockError);
            // Continue with next block
          }
        }

        // Update last processed block
        await redis.set(lastBlockKey, (lastProcessedBlock + blocksToProcess).toString());
      }
    } catch (error) {
      // Don't fail the entire poll for block processing errors
      console.error('[Indexer] Error processing block triggers:', error);
    }
  }

  /**
   * Extract events from a transaction
   */
  private extractEvents(tx: Record<string, unknown>): IndexedEvent[] {
    const events: IndexedEvent[] = [];

    // Base event info from transaction
    const baseEvent: Partial<IndexedEvent> = {
      transactionHash: tx.hash as string,
      version: tx.version as string,
      success: tx.success as boolean,
      gasUsed: parseInt((tx.gas_used as string) || '0'),
    };

    // Parse function call info if available
    const payload = tx.payload as Record<string, unknown> | undefined;
    if (payload?.function) {
      const functionPath = payload.function as string;
      const parts = functionPath.split('::');

      if (parts.length >= 3) {
        baseEvent.moduleAddress = `${parts[0]}::${parts[1]}`;
        baseEvent.functionName = parts[2];
      }
    }

    // Extract actual events from transaction
    const txEvents = tx.events as Array<Record<string, unknown>> | undefined;
    if (txEvents) {
      for (const event of txEvents) {
        events.push({
          ...baseEvent,
          type: event.type as string,
          data: event.data,
        } as IndexedEvent);
      }
    }

    // Create a synthetic "_transaction" event for tx_failed alerts
    // This allows us to trigger on any failed transaction
    events.push({
      ...baseEvent,
      type: '_transaction',
      data: {
        success: tx.success,
        vmStatus: tx.vm_status,
        gasUsed: tx.gas_used,
      },
    } as IndexedEvent);

    return events;
  }

  /**
   * Get the maximum version from a list of transactions
   */
  private getMaxVersion(transactions: Array<Record<string, unknown>>): bigint {
    let maxVersion = BigInt(0);

    for (const tx of transactions) {
      const version = BigInt(tx.version as string);
      if (version > maxVersion) {
        maxVersion = version;
      }
    }

    return maxVersion;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON MANAGEMENT
// ============================================================================

// Store active indexer instances by network
const indexerInstances: Map<string, EventIndexer> = new Map();

/**
 * Get or create an indexer for a network
 */
export function getIndexer(
  network: 'mainnet' | 'testnet' | 'devnet' = 'testnet'
): EventIndexer {
  let indexer = indexerInstances.get(network);

  if (!indexer) {
    indexer = new EventIndexer(network);
    indexerInstances.set(network, indexer);
  }

  return indexer;
}

/**
 * Start all indexers
 */
export async function startAllIndexers(): Promise<void> {
  const networks: Array<'mainnet' | 'testnet' | 'devnet'> = ['mainnet', 'testnet'];
  // Both mainnet and testnet enabled for hackathon demo

  for (const network of networks) {
    const indexer = getIndexer(network);
    // Start in background (don't await)
    indexer.start().catch((err) => {
      console.error(`Failed to start indexer for ${network}:`, err);
    });
  }
}

/**
 * Stop all indexers
 */
export function stopAllIndexers(): void {
  for (const [network, indexer] of indexerInstances.entries()) {
    console.log(`Stopping indexer for ${network}`);
    indexer.stop();
  }
  indexerInstances.clear();
}

/**
 * Get status of all indexers
 */
export function getAllIndexerStatus(): Array<{ network: string; running: boolean }> {
  const status: Array<{ network: string; running: boolean }> = [];

  for (const [network, indexer] of indexerInstances.entries()) {
    status.push({
      network,
      running: indexer.getStatus().running,
    });
  }

  return status;
}
