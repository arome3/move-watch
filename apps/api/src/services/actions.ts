import type { Prisma } from '@movewatch/database';
import {
  type CreateActionRequest,
  type UpdateActionRequest,
  type ActionResponse,
  type ActionListItem,
  type ActionExecutionResponse,
  type ActionExecutionsResponse,
  type ActionTriggerType,
  type TriggerConfig,
  type Network,
} from '@movewatch/shared';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { createSecrets, listSecretNames } from './secretsManager.js';

// Redis key prefixes
const COOLDOWN_KEY_PREFIX = 'cooldown:action:';

/**
 * Create a new action with optional secrets
 */
export async function createAction(
  userId: string,
  request: CreateActionRequest
): Promise<ActionResponse> {
  // Ensure user exists (create if not - for dev purposes)
  await ensureUserExists(userId);

  const action = await prisma.action.create({
    data: {
      userId,
      name: request.name,
      description: request.description,
      code: request.code,
      network: ((request.network?.toUpperCase() || 'TESTNET') as 'MAINNET' | 'TESTNET' | 'DEVNET'),
      triggerType: mapTriggerType(request.triggerType),
      triggerConfig: request.triggerConfig as unknown as Prisma.InputJsonValue,
      maxExecutionMs: request.maxExecutionMs ?? 30000,
      memoryLimitMb: request.memoryLimitMb ?? 128,
      cooldownSeconds: request.cooldownSeconds ?? 60,
    },
  });

  // Create secrets if provided
  if (request.secrets && request.secrets.length > 0) {
    await createSecrets(action.id, request.secrets);
  }

  const secretNames = request.secrets?.map((s) => s.name) ?? [];

  return formatActionResponse(action, secretNames);
}

/**
 * Get all actions for a user (list view, without code)
 */
export async function getActions(userId: string): Promise<ActionListItem[]> {
  const actions = await prisma.action.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      enabled: true,
      network: true,
      triggerType: true,
      lastExecutedAt: true,
      executionCount: true,
      successCount: true,
      failureCount: true,
      createdAt: true,
    },
  });

  return actions.map(formatActionListItem);
}

/**
 * Get a single action by ID with full details (including code)
 */
export async function getActionById(
  actionId: string,
  userId: string
): Promise<ActionResponse | null> {
  const action = await prisma.action.findFirst({
    where: { id: actionId, userId },
  });

  if (!action) return null;

  const secretNames = await listSecretNames(actionId);
  return formatActionResponse(action, secretNames);
}

/**
 * Update an existing action
 */
export async function updateAction(
  actionId: string,
  userId: string,
  updates: UpdateActionRequest
): Promise<ActionResponse | null> {
  // Verify ownership
  const existing = await prisma.action.findFirst({
    where: { id: actionId, userId },
  });

  if (!existing) return null;

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.code !== undefined) updateData.code = updates.code;
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
  if (updates.network !== undefined) {
    updateData.network = updates.network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET';
  }
  if (updates.triggerType !== undefined) {
    updateData.triggerType = mapTriggerType(updates.triggerType);
  }
  if (updates.triggerConfig !== undefined) {
    updateData.triggerConfig = updates.triggerConfig as unknown as Prisma.InputJsonValue;
  }
  if (updates.maxExecutionMs !== undefined) {
    updateData.maxExecutionMs = updates.maxExecutionMs;
  }
  if (updates.memoryLimitMb !== undefined) {
    updateData.memoryLimitMb = updates.memoryLimitMb;
  }
  if (updates.cooldownSeconds !== undefined) {
    updateData.cooldownSeconds = updates.cooldownSeconds;
  }

  const action = await prisma.action.update({
    where: { id: actionId },
    data: updateData,
  });

  const secretNames = await listSecretNames(actionId);
  return formatActionResponse(action, secretNames);
}

/**
 * Delete an action and clear its cooldown
 */
export async function deleteAction(
  actionId: string,
  userId: string
): Promise<boolean> {
  // Verify ownership
  const action = await prisma.action.findFirst({
    where: { id: actionId, userId },
  });

  if (!action) return false;

  // Delete from database (cascades to secrets and executions)
  await prisma.action.delete({ where: { id: actionId } });

  // Clear cooldown from Redis
  await redis.del(`${COOLDOWN_KEY_PREFIX}${actionId}`);

  return true;
}

/**
 * Get execution history for an action
 */
export async function getExecutions(
  actionId: string,
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<ActionExecutionsResponse | null> {
  // Verify ownership
  const action = await prisma.action.findFirst({
    where: { id: actionId, userId },
  });

  if (!action) return null;

  const [executions, total] = await Promise.all([
    prisma.actionExecution.findMany({
      where: { actionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.actionExecution.count({ where: { actionId } }),
  ]);

  return {
    executions: executions.map(formatExecutionResponse),
    total,
    limit,
    offset,
  };
}

/**
 * Get a single execution by ID
 */
export async function getExecutionById(
  executionId: string,
  userId: string
): Promise<ActionExecutionResponse | null> {
  const execution = await prisma.actionExecution.findFirst({
    where: { id: executionId },
    include: {
      action: {
        select: { userId: true },
      },
    },
  });

  if (!execution || execution.action.userId !== userId) return null;

  return formatExecutionResponse(execution);
}

/**
 * Check if an action is in cooldown
 */
export async function checkCooldown(actionId: string): Promise<boolean> {
  const cooldownKey = `${COOLDOWN_KEY_PREFIX}${actionId}`;
  const lastExecution = await redis.get(cooldownKey);
  return lastExecution === null;
}

/**
 * Set cooldown for an action
 */
export async function setCooldown(actionId: string, seconds: number): Promise<void> {
  const cooldownKey = `${COOLDOWN_KEY_PREFIX}${actionId}`;
  await redis.setex(cooldownKey, seconds, Date.now().toString());
}

/**
 * Get all active (enabled) actions for a given network and trigger type
 */
export async function getActiveActions(
  network: Network,
  triggerType: ActionTriggerType
) {
  return prisma.action.findMany({
    where: {
      enabled: true,
      network: network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
      triggerType: mapTriggerType(triggerType),
    },
    include: {
      secrets: {
        select: { name: true, encryptedValue: true, iv: true },
      },
    },
  });
}

/**
 * Get all active (enabled) actions for a given network (any trigger type)
 */
export async function getActiveActionsByNetwork(network: Network) {
  return prisma.action.findMany({
    where: {
      enabled: true,
      network: network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
    },
    include: {
      secrets: {
        select: { name: true, encryptedValue: true, iv: true },
      },
    },
  });
}

/**
 * Record an action execution result
 */
export async function recordExecution(
  actionId: string,
  data: {
    status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
    triggerData?: unknown;
    transactionHash?: string;
    result?: unknown;
    logs?: string[];
    error?: unknown;
    durationMs?: number;
    memoryUsedMb?: number;
    startedAt?: Date;
    completedAt?: Date;
  }
): Promise<string> {
  const execution = await prisma.actionExecution.create({
    data: {
      actionId,
      status: data.status,
      triggerData: data.triggerData as Prisma.InputJsonValue | undefined,
      transactionHash: data.transactionHash,
      result: data.result as Prisma.InputJsonValue | undefined,
      logs: data.logs ?? [],
      error: data.error as Prisma.InputJsonValue | undefined,
      durationMs: data.durationMs,
      memoryUsedMb: data.memoryUsedMb,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
    },
  });

  return execution.id;
}

/**
 * Update an existing execution record
 */
export async function updateExecution(
  executionId: string,
  data: {
    status?: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
    result?: unknown;
    logs?: string[];
    error?: unknown;
    durationMs?: number;
    memoryUsedMb?: number;
    completedAt?: Date;
  }
): Promise<void> {
  await prisma.actionExecution.update({
    where: { id: executionId },
    data: {
      status: data.status,
      result: data.result as Prisma.InputJsonValue | undefined,
      logs: data.logs,
      error: data.error as Prisma.InputJsonValue | undefined,
      durationMs: data.durationMs,
      memoryUsedMb: data.memoryUsedMb,
      completedAt: data.completedAt,
    },
  });
}

/**
 * Update action statistics after execution
 */
export async function updateActionStats(
  actionId: string,
  success: boolean
): Promise<void> {
  await prisma.action.update({
    where: { id: actionId },
    data: {
      executionCount: { increment: 1 },
      successCount: success ? { increment: 1 } : undefined,
      failureCount: !success ? { increment: 1 } : undefined,
      lastExecutedAt: new Date(),
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Ensure a user exists in the database (for dev without auth)
 */
async function ensureUserExists(userId: string): Promise<void> {
  const exists = await prisma.user.findUnique({ where: { id: userId } });
  if (!exists) {
    await prisma.user.create({
      data: {
        id: userId,
        name: 'Development User',
      },
    });
  }
}

/**
 * Map trigger type string to Prisma enum
 */
function mapTriggerType(type: ActionTriggerType): 'EVENT' | 'BLOCK' | 'SCHEDULE' | 'WEBHOOK' {
  const mapping: Record<ActionTriggerType, 'EVENT' | 'BLOCK' | 'SCHEDULE' | 'WEBHOOK'> = {
    event: 'EVENT',
    block: 'BLOCK',
    schedule: 'SCHEDULE',
    webhook: 'WEBHOOK',
  };
  return mapping[type] || 'EVENT';
}

/**
 * Format database action as full API response
 */
function formatActionResponse(
  action: {
    id: string;
    name: string;
    description: string | null;
    enabled: boolean;
    network: string;
    code: string;
    triggerType: string;
    triggerConfig: unknown;
    maxExecutionMs: number;
    memoryLimitMb: number;
    cooldownSeconds: number;
    lastExecutedAt: Date | null;
    executionCount: number;
    successCount: number;
    failureCount: number;
    createdAt: Date;
    updatedAt: Date;
  },
  secretNames: string[]
): ActionResponse {
  return {
    id: action.id,
    name: action.name,
    description: action.description,
    enabled: action.enabled,
    network: action.network.toLowerCase() as Network,
    code: action.code,
    triggerType: action.triggerType.toLowerCase() as ActionTriggerType,
    triggerConfig: action.triggerConfig as TriggerConfig,
    maxExecutionMs: action.maxExecutionMs,
    memoryLimitMb: action.memoryLimitMb,
    cooldownSeconds: action.cooldownSeconds,
    lastExecutedAt: action.lastExecutedAt?.toISOString() ?? null,
    executionCount: action.executionCount,
    successCount: action.successCount,
    failureCount: action.failureCount,
    secretNames,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
  };
}

/**
 * Format database action as list item response
 */
function formatActionListItem(action: {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  network: string;
  triggerType: string;
  lastExecutedAt: Date | null;
  executionCount: number;
  successCount: number;
  failureCount: number;
  createdAt: Date;
}): ActionListItem {
  return {
    id: action.id,
    name: action.name,
    description: action.description,
    enabled: action.enabled,
    network: action.network.toLowerCase() as Network,
    triggerType: action.triggerType.toLowerCase() as ActionTriggerType,
    lastExecutedAt: action.lastExecutedAt?.toISOString() ?? null,
    executionCount: action.executionCount,
    successCount: action.successCount,
    failureCount: action.failureCount,
    createdAt: action.createdAt.toISOString(),
  };
}

/**
 * Format database execution as API response
 */
function formatExecutionResponse(execution: {
  id: string;
  actionId: string;
  status: string;
  triggerData: unknown;
  transactionHash: string | null;
  result: unknown;
  logs: string[];
  error: unknown;
  durationMs: number | null;
  memoryUsedMb: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}): ActionExecutionResponse {
  return {
    id: execution.id,
    actionId: execution.actionId,
    status: execution.status.toLowerCase() as ActionExecutionResponse['status'],
    triggerData: execution.triggerData,
    transactionHash: execution.transactionHash,
    result: execution.result,
    logs: execution.logs,
    error: execution.error as { message: string; stack?: string } | null,
    durationMs: execution.durationMs,
    memoryUsedMb: execution.memoryUsedMb,
    startedAt: execution.startedAt?.toISOString() ?? null,
    completedAt: execution.completedAt?.toISOString() ?? null,
    createdAt: execution.createdAt.toISOString(),
  };
}
