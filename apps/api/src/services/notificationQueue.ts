/**
 * Notification Queue Service
 *
 * Handles async/background notification processing using Redis.
 * Notifications are queued and processed in the background to avoid
 * blocking the alert processing pipeline.
 */

import { redis } from '../lib/redis.js';
import type { NotificationPayload } from '@movewatch/shared';
import { sendNotifications } from './notifications.js';

// Queue names
const NOTIFICATION_QUEUE = 'movewatch:notifications:queue';
const NOTIFICATION_PROCESSING = 'movewatch:notifications:processing';
const NOTIFICATION_DEAD_LETTER = 'movewatch:notifications:dead_letter';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const PROCESSING_TIMEOUT_SECONDS = 60;

// Backpressure configuration
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_NOTIFICATION_QUEUE_SIZE || '10000', 10);
const BACKPRESSURE_THRESHOLD = Math.floor(MAX_QUEUE_SIZE * 0.8); // Start warning at 80%

/**
 * Backpressure error - thrown when queue is full
 */
export class BackpressureError extends Error {
  public readonly queueSize: number;
  public readonly maxSize: number;

  constructor(queueSize: number, maxSize: number) {
    super(`Queue backpressure: ${queueSize}/${maxSize} jobs queued. Try again later.`);
    this.name = 'BackpressureError';
    this.queueSize = queueSize;
    this.maxSize = maxSize;
  }
}

/**
 * Backpressure status
 */
export interface BackpressureStatus {
  accepting: boolean;
  queueSize: number;
  maxSize: number;
  threshold: number;
  utilizationPercent: number;
  status: 'ok' | 'warning' | 'critical';
}

/**
 * Notification job structure
 */
export interface NotificationJob {
  id: string;
  alertId: string;
  channels: Array<{ type: string; config: unknown; enabled: boolean }>;
  payload: NotificationPayload;
  retryCount: number;
  createdAt: string;
  lastError?: string;
}

/**
 * Check backpressure status
 */
export async function getBackpressureStatus(): Promise<BackpressureStatus> {
  const queueSize = await redis.llen(NOTIFICATION_QUEUE);
  const utilizationPercent = Math.round((queueSize / MAX_QUEUE_SIZE) * 100);

  let status: 'ok' | 'warning' | 'critical';
  if (queueSize >= MAX_QUEUE_SIZE) {
    status = 'critical';
  } else if (queueSize >= BACKPRESSURE_THRESHOLD) {
    status = 'warning';
  } else {
    status = 'ok';
  }

  return {
    accepting: queueSize < MAX_QUEUE_SIZE,
    queueSize,
    maxSize: MAX_QUEUE_SIZE,
    threshold: BACKPRESSURE_THRESHOLD,
    utilizationPercent,
    status,
  };
}

/**
 * Check if the queue can accept more work
 */
export async function canAcceptWork(): Promise<boolean> {
  const status = await getBackpressureStatus();
  return status.accepting;
}

/**
 * Queue a notification for async processing
 * Respects backpressure limits to prevent system overload
 *
 * @throws BackpressureError if queue is full
 */
export async function queueNotification(
  alertId: string,
  channels: Array<{ type: string; config: unknown; enabled: boolean }>,
  payload: NotificationPayload,
  options?: { enforceBackpressure?: boolean }
): Promise<string> {
  const enforceBackpressure = options?.enforceBackpressure ?? true;

  // Check backpressure before queuing
  if (enforceBackpressure) {
    const queueSize = await redis.llen(NOTIFICATION_QUEUE);

    if (queueSize >= MAX_QUEUE_SIZE) {
      console.warn(
        `[NotificationQueue] Backpressure: rejecting notification for alert ${alertId} ` +
          `(queue size ${queueSize}/${MAX_QUEUE_SIZE})`
      );
      throw new BackpressureError(queueSize, MAX_QUEUE_SIZE);
    }

    if (queueSize >= BACKPRESSURE_THRESHOLD) {
      console.warn(
        `[NotificationQueue] Warning: queue nearing capacity ${queueSize}/${MAX_QUEUE_SIZE}`
      );
    }
  }

  const job: NotificationJob = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    alertId,
    channels,
    payload,
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };

  await redis.rpush(NOTIFICATION_QUEUE, JSON.stringify(job));
  console.log(`[NotificationQueue] Queued notification ${job.id} for alert ${alertId}`);

  return job.id;
}

/**
 * Queue multiple notifications (batch operation)
 * Respects backpressure limits to prevent system overload
 *
 * @throws BackpressureError if queue doesn't have capacity for the batch
 */
export async function queueNotificationBatch(
  jobs: Array<{
    alertId: string;
    channels: Array<{ type: string; config: unknown; enabled: boolean }>;
    payload: NotificationPayload;
  }>,
  options?: { enforceBackpressure?: boolean }
): Promise<string[]> {
  const enforceBackpressure = options?.enforceBackpressure ?? true;

  // Check backpressure before queuing batch
  if (enforceBackpressure) {
    const queueSize = await redis.llen(NOTIFICATION_QUEUE);
    const projectedSize = queueSize + jobs.length;

    if (projectedSize >= MAX_QUEUE_SIZE) {
      console.warn(
        `[NotificationQueue] Backpressure: rejecting batch of ${jobs.length} notifications ` +
          `(would exceed capacity: ${projectedSize}/${MAX_QUEUE_SIZE})`
      );
      throw new BackpressureError(projectedSize, MAX_QUEUE_SIZE);
    }

    if (projectedSize >= BACKPRESSURE_THRESHOLD) {
      console.warn(
        `[NotificationQueue] Warning: batch would bring queue to ${projectedSize}/${MAX_QUEUE_SIZE}`
      );
    }
  }

  const pipeline = redis.pipeline();
  const jobIds: string[] = [];

  for (const { alertId, channels, payload } of jobs) {
    const job: NotificationJob = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      alertId,
      channels,
      payload,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    pipeline.rpush(NOTIFICATION_QUEUE, JSON.stringify(job));
    jobIds.push(job.id);
  }

  await pipeline.exec();
  console.log(`[NotificationQueue] Queued ${jobs.length} notifications`);

  return jobIds;
}

/**
 * Process the next notification from the queue
 * Uses BRPOPLPUSH for reliable processing
 */
export async function processNextNotification(
  timeoutSeconds = PROCESSING_TIMEOUT_SECONDS
): Promise<NotificationJob | null> {
  // Move job from queue to processing atomically
  const jobJson = await redis.brpoplpush(
    NOTIFICATION_QUEUE,
    NOTIFICATION_PROCESSING,
    timeoutSeconds
  );

  if (!jobJson) return null;

  let job: NotificationJob;
  try {
    job = JSON.parse(jobJson);
  } catch (error) {
    console.error('[NotificationQueue] Failed to parse job:', error);
    // Remove malformed job from processing queue
    await redis.lrem(NOTIFICATION_PROCESSING, 1, jobJson);
    return null;
  }

  try {
    // Process the notification
    const results = await sendNotifications(job.channels, job.payload);

    // Check for failures
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      console.warn(
        `[NotificationQueue] ${failures.length}/${results.length} channels failed for job ${job.id}:`,
        failures.map((f) => `${f.channel}: ${f.error}`)
      );
    }

    // Remove from processing queue (success)
    await redis.lrem(NOTIFICATION_PROCESSING, 1, jobJson);
    console.log(`[NotificationQueue] Processed notification ${job.id}`);

    return job;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[NotificationQueue] Error processing job ${job.id}:`, errorMessage);

    // Update retry count
    job.retryCount++;
    job.lastError = errorMessage;

    // Remove from processing queue
    await redis.lrem(NOTIFICATION_PROCESSING, 1, jobJson);

    if (job.retryCount < MAX_RETRIES) {
      // Re-queue for retry (at the front for faster retry)
      console.log(
        `[NotificationQueue] Re-queuing job ${job.id} (retry ${job.retryCount}/${MAX_RETRIES})`
      );
      await redis.lpush(NOTIFICATION_QUEUE, JSON.stringify(job));
    } else {
      // Move to dead letter queue
      console.error(
        `[NotificationQueue] Job ${job.id} exceeded max retries, moving to dead letter queue`
      );
      await redis.rpush(NOTIFICATION_DEAD_LETTER, JSON.stringify(job));
    }

    throw error;
  }
}

/**
 * Process notifications in a loop (for worker process)
 */
export async function startNotificationWorker(
  signal?: AbortSignal
): Promise<void> {
  console.log('[NotificationQueue] Worker started');

  while (!signal?.aborted) {
    try {
      await processNextNotification();
    } catch {
      // Error already logged in processNextNotification
      // Brief pause before next attempt
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  console.log('[NotificationQueue] Worker stopped');
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  deadLetter: number;
}> {
  const [pending, processing, deadLetter] = await Promise.all([
    redis.llen(NOTIFICATION_QUEUE),
    redis.llen(NOTIFICATION_PROCESSING),
    redis.llen(NOTIFICATION_DEAD_LETTER),
  ]);

  return { pending, processing, deadLetter };
}

/**
 * Get dead letter queue contents for debugging
 */
export async function getDeadLetterJobs(limit = 10): Promise<NotificationJob[]> {
  const jobs = await redis.lrange(NOTIFICATION_DEAD_LETTER, 0, limit - 1);
  return jobs.map((j) => JSON.parse(j));
}

/**
 * Retry a dead letter job
 */
export async function retryDeadLetterJob(jobId: string): Promise<boolean> {
  const jobs = await redis.lrange(NOTIFICATION_DEAD_LETTER, 0, -1);

  for (const jobJson of jobs) {
    const job = JSON.parse(jobJson) as NotificationJob;
    if (job.id === jobId) {
      // Reset retry count and re-queue
      job.retryCount = 0;
      job.lastError = undefined;

      await redis.lrem(NOTIFICATION_DEAD_LETTER, 1, jobJson);
      await redis.rpush(NOTIFICATION_QUEUE, JSON.stringify(job));

      console.log(`[NotificationQueue] Retried dead letter job ${jobId}`);
      return true;
    }
  }

  return false;
}

/**
 * Clear all dead letter jobs
 */
export async function clearDeadLetterQueue(): Promise<number> {
  const count = await redis.llen(NOTIFICATION_DEAD_LETTER);
  await redis.del(NOTIFICATION_DEAD_LETTER);
  return count;
}

/**
 * Recovery function for stuck jobs in processing queue
 * Call this on worker startup to recover from crashes
 */
export async function recoverProcessingJobs(): Promise<number> {
  const jobs = await redis.lrange(NOTIFICATION_PROCESSING, 0, -1);

  if (jobs.length === 0) return 0;

  console.log(
    `[NotificationQueue] Recovering ${jobs.length} stuck jobs from processing queue`
  );

  // Move all back to the main queue
  const pipeline = redis.pipeline();
  for (const job of jobs) {
    pipeline.rpush(NOTIFICATION_QUEUE, job);
    pipeline.lrem(NOTIFICATION_PROCESSING, 1, job);
  }
  await pipeline.exec();

  return jobs.length;
}
