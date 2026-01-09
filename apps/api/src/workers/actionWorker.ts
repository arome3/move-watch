/**
 * Action Worker
 *
 * This worker runs as a separate process to process queued action executions
 * from Redis. It dequeues jobs and executes user code in isolated-vm sandboxes.
 *
 * Usage:
 *   pnpm action-worker        # Run with tsx
 *   node dist/workers/actionWorker.js  # Run compiled
 *
 * Environment Variables:
 *   REDIS_URL - Redis connection URL
 *   DATABASE_URL - PostgreSQL connection URL
 *   SECRETS_ENCRYPTION_KEY - 32-byte hex key for decrypting secrets
 *   WORKER_CONCURRENCY - Number of concurrent executions (default: 3)
 */

import {
  dequeueExecution,
  processExecution,
  completeJob,
  getQueueStats,
  type ExecutionJob,
} from '../services/actionProcessor.js';

// Configuration
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3', 10);
const DEQUEUE_TIMEOUT_SECONDS = 30;
const STATS_INTERVAL_MS = 60000; // Log stats every minute

// Worker state
let isRunning = true;
let activeJobs = 0;
let processedCount = 0;
let successCount = 0;
let failureCount = 0;

/**
 * Process a single job with error handling
 */
async function processJob(job: ExecutionJob): Promise<void> {
  activeJobs++;

  try {
    await processExecution(job);
    successCount++;
  } catch (error) {
    failureCount++;
    console.error(`[ActionWorker] Job ${job.jobId} failed:`, error);
  } finally {
    // Always complete the job to remove from processing queue
    await completeJob(job);
    activeJobs--;
    processedCount++;
  }
}

/**
 * Worker loop - continuously dequeue and process jobs
 */
async function workerLoop(workerId: number): Promise<void> {
  console.log(`[ActionWorker] Worker ${workerId} started`);

  while (isRunning) {
    try {
      // Dequeue next job (blocking)
      const job = await dequeueExecution(DEQUEUE_TIMEOUT_SECONDS);

      if (job) {
        console.log(`[ActionWorker] Worker ${workerId} processing job ${job.jobId}`);
        await processJob(job);
      }
      // If no job, loop continues and waits again
    } catch (error) {
      if (isRunning) {
        console.error(`[ActionWorker] Worker ${workerId} error:`, error);
        // Brief pause before retrying on error
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  console.log(`[ActionWorker] Worker ${workerId} stopped`);
}

/**
 * Log queue and worker statistics periodically
 */
async function statsLoop(): Promise<void> {
  while (isRunning) {
    await new Promise((resolve) => setTimeout(resolve, STATS_INTERVAL_MS));

    if (!isRunning) break;

    try {
      const queueStats = await getQueueStats();
      console.log(
        `[ActionWorker] Stats: processed=${processedCount} success=${successCount} failed=${failureCount} active=${activeJobs} pending=${queueStats.pending} processing=${queueStats.processing}`
      );
    } catch (error) {
      console.error('[ActionWorker] Failed to get stats:', error);
    }
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('[ActionWorker] Shutting down...');
  isRunning = false;

  // Wait for active jobs to complete (max 60 seconds)
  const maxWait = 60000;
  const startTime = Date.now();

  while (activeJobs > 0 && Date.now() - startTime < maxWait) {
    console.log(`[ActionWorker] Waiting for ${activeJobs} active jobs to complete...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (activeJobs > 0) {
    console.warn(`[ActionWorker] Force shutdown with ${activeJobs} jobs still active`);
  }

  console.log('[ActionWorker] Shutdown complete');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                 MoveWatch Action Worker                     ║
╠════════════════════════════════════════════════════════════╣
║  Concurrency: ${String(WORKER_CONCURRENCY).padEnd(44)} ║
║  Status: Starting...                                        ║
╚════════════════════════════════════════════════════════════╝
`);

  // Validate environment
  if (!process.env.SECRETS_ENCRYPTION_KEY) {
    console.error('[ActionWorker] SECRETS_ENCRYPTION_KEY environment variable is required');
    process.exit(1);
  }

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

  // Start worker loops
  const workers: Promise<void>[] = [];

  for (let i = 0; i < WORKER_CONCURRENCY; i++) {
    workers.push(workerLoop(i + 1));
  }

  // Start stats loop
  workers.push(statsLoop());

  // Log initial queue stats
  try {
    const stats = await getQueueStats();
    console.log(`[ActionWorker] Initial queue: pending=${stats.pending} processing=${stats.processing}`);
  } catch (error) {
    console.error('[ActionWorker] Failed to get initial stats:', error);
  }

  // Wait for all workers (will run until shutdown)
  await Promise.all(workers);
}

// Run the worker
main().catch((error) => {
  console.error('[ActionWorker] Fatal error:', error);
  process.exit(1);
});
