import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { decrypt } from '../lib/crypto.js';
import { executeAction } from './actionExecutor.js';
import { broadcastActionExecution, type ActionExecutionBroadcast } from './websocketService.js';
import {
  checkCooldown,
  setCooldown,
  recordExecution,
  updateExecution,
  updateActionStats,
  getActiveActions,
  getActiveActionsByNetwork,
} from './actions.js';
import type {
  Network,
  ActionTriggerType,
  TriggerConfig,
  EventTriggerConfig,
  BlockTriggerConfig,
  ActionExecutionContext,
  FilterCondition,
} from '@movewatch/shared';

// Redis queue keys
const EXECUTION_QUEUE_KEY = 'queue:actions:pending';
const PROCESSING_QUEUE_KEY = 'queue:actions:processing';

// Job structure for the queue
export interface ExecutionJob {
  jobId: string;
  actionId: string;
  executionId: string;
  triggerData: unknown;
  queuedAt: string;
}

// Trigger evaluation result
export interface TriggerMatch {
  actionId: string;
  triggerData: unknown;
}

/**
 * ============================================================================
 * QUEUE MANAGEMENT
 * ============================================================================
 */

/**
 * Queue an action execution job
 */
export async function queueExecution(
  actionId: string,
  triggerData: unknown
): Promise<string> {
  // Create execution record in PENDING state
  const executionId = await recordExecution(actionId, {
    status: 'PENDING',
    triggerData,
  });

  // Create job payload
  const job: ExecutionJob = {
    jobId: `job:${executionId}`,
    actionId,
    executionId,
    triggerData,
    queuedAt: new Date().toISOString(),
  };

  // Push to queue (FIFO - add to left, pop from right)
  await redis.lpush(EXECUTION_QUEUE_KEY, JSON.stringify(job));

  console.log(`[ActionProcessor] Queued execution ${executionId} for action ${actionId}`);
  return executionId;
}

/**
 * Dequeue next job for processing (blocking)
 * Moves job to processing queue for reliability
 */
export async function dequeueExecution(
  timeoutSeconds: number = 30
): Promise<ExecutionJob | null> {
  // BRPOPLPUSH: atomically pop from pending and push to processing
  // This provides at-least-once delivery semantics
  const result = await redis.brpoplpush(
    EXECUTION_QUEUE_KEY,
    PROCESSING_QUEUE_KEY,
    timeoutSeconds
  );

  if (!result) {
    return null; // Timeout, no jobs available
  }

  try {
    return JSON.parse(result) as ExecutionJob;
  } catch (error) {
    console.error('[ActionProcessor] Failed to parse job:', result);
    // Remove invalid job from processing queue
    await redis.lrem(PROCESSING_QUEUE_KEY, 1, result);
    return null;
  }
}

/**
 * Mark a job as completed and remove from processing queue
 */
export async function completeJob(job: ExecutionJob): Promise<void> {
  await redis.lrem(PROCESSING_QUEUE_KEY, 1, JSON.stringify(job));
}

/**
 * Move failed job back to pending queue for retry
 */
export async function retryJob(job: ExecutionJob): Promise<void> {
  const jobString = JSON.stringify(job);
  await redis.lrem(PROCESSING_QUEUE_KEY, 1, jobString);

  // Update job with retry info
  const retryJob = {
    ...job,
    queuedAt: new Date().toISOString(),
  };
  await redis.lpush(EXECUTION_QUEUE_KEY, JSON.stringify(retryJob));
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
}> {
  const [pending, processing] = await Promise.all([
    redis.llen(EXECUTION_QUEUE_KEY),
    redis.llen(PROCESSING_QUEUE_KEY),
  ]);

  return { pending, processing };
}

/**
 * ============================================================================
 * TRIGGER EVALUATION
 * ============================================================================
 */

/**
 * Evaluate event triggers against an on-chain event
 */
export async function evaluateEventTriggers(
  network: Network,
  eventType: string,
  eventData: unknown,
  transactionHash?: string
): Promise<TriggerMatch[]> {
  const actions = await getActiveActions(network, 'event');
  const matches: TriggerMatch[] = [];

  for (const action of actions) {
    const config = action.triggerConfig as unknown as EventTriggerConfig;

    // Check if event type matches
    if (!matchesEventType(config.eventType, eventType)) {
      continue;
    }

    // Check module address filter if specified
    if (config.moduleAddress && !eventType.includes(config.moduleAddress)) {
      continue;
    }

    // Check field filters if specified
    if (config.filters && !matchesFilters(config.filters, eventData)) {
      continue;
    }

    // Check cooldown
    const canExecute = await checkCooldown(action.id);
    if (!canExecute) {
      console.log(`[ActionProcessor] Action ${action.id} is in cooldown, skipping`);
      continue;
    }

    matches.push({
      actionId: action.id,
      triggerData: {
        type: 'event',
        eventType,
        eventData,
        transactionHash,
        matchedAt: new Date().toISOString(),
      },
    });
  }

  return matches;
}

/**
 * Evaluate block triggers against a new block
 */
export async function evaluateBlockTriggers(
  network: Network,
  blockHeight: number,
  blockTime: string,
  blockHash: string
): Promise<TriggerMatch[]> {
  const actions = await getActiveActions(network, 'block');
  const matches: TriggerMatch[] = [];

  for (const action of actions) {
    const config = action.triggerConfig as unknown as BlockTriggerConfig;

    // Check if block height matches interval
    if (blockHeight % config.interval !== 0) {
      continue;
    }

    // Check cooldown
    const canExecute = await checkCooldown(action.id);
    if (!canExecute) {
      console.log(`[ActionProcessor] Action ${action.id} is in cooldown, skipping`);
      continue;
    }

    matches.push({
      actionId: action.id,
      triggerData: {
        type: 'block',
        blockHeight,
        blockTime,
        blockHash,
        matchedAt: new Date().toISOString(),
      },
    });
  }

  return matches;
}

/**
 * Get all schedule-triggered actions for a network
 * (used by scheduler to set up cron jobs)
 */
export async function getScheduleActions(network: Network) {
  return getActiveActions(network, 'schedule');
}

/**
 * ============================================================================
 * EXECUTION PROCESSING
 * ============================================================================
 */

/**
 * Process a single execution job
 * This is the main execution pipeline
 */
export async function processExecution(job: ExecutionJob): Promise<void> {
  const { actionId, executionId, triggerData } = job;

  console.log(`[ActionProcessor] Processing execution ${executionId} for action ${actionId}`);

  try {
    // Fetch action from database
    const action = await prisma.action.findUnique({
      where: { id: actionId },
      include: {
        secrets: {
          select: { name: true, encryptedValue: true, iv: true },
        },
      },
    });

    if (!action) {
      console.error(`[ActionProcessor] Action ${actionId} not found`);
      await updateExecution(executionId, {
        status: 'FAILED',
        error: { message: 'Action not found' },
        completedAt: new Date(),
      });
      return;
    }

    if (!action.enabled) {
      console.log(`[ActionProcessor] Action ${actionId} is disabled, skipping`);
      await updateExecution(executionId, {
        status: 'FAILED',
        error: { message: 'Action is disabled' },
        completedAt: new Date(),
      });
      return;
    }

    // Mark execution as running and broadcast
    await updateExecution(executionId, {
      status: 'RUNNING',
    });

    // Broadcast running status
    broadcastActionExecution({
      actionId,
      executionId,
      status: 'RUNNING',
      network: action.network.toLowerCase(),
      triggerType: action.triggerType.toLowerCase(),
    });

    // Decrypt secrets
    const secrets: Record<string, string> = {};
    for (const secret of action.secrets) {
      try {
        // Reconstruct the encrypted data format
        const [encrypted, authTag] = secret.encryptedValue.split(':');
        secrets[secret.name] = decrypt({
          encrypted,
          iv: secret.iv,
          authTag,
        });
      } catch (error) {
        console.error(`[ActionProcessor] Failed to decrypt secret ${secret.name}:`, error);
        // Continue without this secret
      }
    }

    // Build execution context
    const context: ActionExecutionContext = {
      actionId,
      executionId,
      network: action.network.toLowerCase() as Network,
      triggerType: action.triggerType.toLowerCase() as ActionTriggerType,
      triggerData,
      secrets,
    };

    // Execute the action
    const result = await executeAction(action.code, context, {
      memoryLimitMb: action.memoryLimitMb,
      timeoutMs: action.maxExecutionMs,
    });

    // Update execution record and broadcast completion
    if (result.success) {
      await updateExecution(executionId, {
        status: 'SUCCESS',
        result: result.result as Record<string, unknown>,
        logs: result.logs,
        durationMs: result.durationMs,
        memoryUsedMb: result.memoryUsedMb,
        completedAt: new Date(),
      });

      // Broadcast success
      broadcastActionExecution({
        actionId,
        executionId,
        status: 'SUCCESS',
        network: action.network.toLowerCase(),
        triggerType: action.triggerType.toLowerCase(),
        durationMs: result.durationMs,
        output: result.result,
        logs: result.logs,
      });

      // Set cooldown
      await setCooldown(actionId, action.cooldownSeconds);
    } else {
      const status = result.error?.message.includes('timeout') ? 'TIMEOUT' : 'FAILED';
      await updateExecution(executionId, {
        status,
        logs: result.logs,
        error: result.error as Record<string, unknown>,
        durationMs: result.durationMs,
        memoryUsedMb: result.memoryUsedMb,
        completedAt: new Date(),
      });

      // Broadcast failure/timeout
      broadcastActionExecution({
        actionId,
        executionId,
        status: status as 'FAILED' | 'TIMEOUT',
        network: action.network.toLowerCase(),
        triggerType: action.triggerType.toLowerCase(),
        durationMs: result.durationMs,
        error: result.error,
        logs: result.logs,
      });
    }

    // Update action statistics
    await updateActionStats(actionId, result.success);

    console.log(
      `[ActionProcessor] Execution ${executionId} completed: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.durationMs}ms)`
    );
  } catch (error) {
    console.error(`[ActionProcessor] Error processing execution ${executionId}:`, error);

    const errorObj = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    };

    // Update execution as failed
    await updateExecution(executionId, {
      status: 'FAILED',
      error: errorObj,
      completedAt: new Date(),
    });

    // Broadcast error
    try {
      const action = await prisma.action.findUnique({
        where: { id: actionId },
        select: { network: true, triggerType: true },
      });
      if (action) {
        broadcastActionExecution({
          actionId,
          executionId,
          status: 'FAILED',
          network: action.network.toLowerCase(),
          triggerType: action.triggerType.toLowerCase(),
          error: errorObj,
        });
      }
    } catch {
      // Ignore broadcast errors during error handling
    }

    // Update action failure count
    await updateActionStats(actionId, false);
  }
}

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Check if an event type matches the configured pattern
 * Supports exact match and wildcard suffix (e.g., "0x1::coin::*")
 */
function matchesEventType(pattern: string, eventType: string): boolean {
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return eventType.startsWith(prefix);
  }
  return pattern === eventType;
}

/**
 * Check if event data matches all filter conditions
 */
function matchesFilters(
  filters: Record<string, FilterCondition>,
  data: unknown
): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const dataObj = data as Record<string, unknown>;

  for (const [field, condition] of Object.entries(filters)) {
    const value = getNestedValue(dataObj, field);

    if (!matchesCondition(value, condition)) {
      return false;
    }
  }

  return true;
}

/**
 * Get nested value from object using dot notation (e.g., "amount.value")
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Check if a value matches a filter condition
 */
function matchesCondition(value: unknown, condition: FilterCondition): boolean {
  const { operator, value: expected } = condition;

  switch (operator) {
    case 'eq':
      return value === expected;
    case 'ne':
      return value !== expected;
    case 'gt':
      return typeof value === 'number' && typeof expected === 'number' && value > expected;
    case 'gte':
      return typeof value === 'number' && typeof expected === 'number' && value >= expected;
    case 'lt':
      return typeof value === 'number' && typeof expected === 'number' && value < expected;
    case 'lte':
      return typeof value === 'number' && typeof expected === 'number' && value <= expected;
    case 'contains':
      return typeof value === 'string' && typeof expected === 'string' && value.includes(expected);
    default:
      return false;
  }
}

/**
 * Queue matching actions for an event
 * Convenience function for indexers
 */
export async function processEvent(
  network: Network,
  eventType: string,
  eventData: unknown,
  transactionHash?: string
): Promise<string[]> {
  const matches = await evaluateEventTriggers(network, eventType, eventData, transactionHash);
  const executionIds: string[] = [];

  for (const match of matches) {
    const executionId = await queueExecution(match.actionId, match.triggerData);
    executionIds.push(executionId);
  }

  return executionIds;
}

/**
 * Queue matching actions for a block
 * Convenience function for block indexers
 */
export async function processBlock(
  network: Network,
  blockHeight: number,
  blockTime: string,
  blockHash: string
): Promise<string[]> {
  const matches = await evaluateBlockTriggers(network, blockHeight, blockTime, blockHash);
  const executionIds: string[] = [];

  for (const match of matches) {
    const executionId = await queueExecution(match.actionId, match.triggerData);
    executionIds.push(executionId);
  }

  return executionIds;
}
