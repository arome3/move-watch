import type { Prisma } from '@movewatch/database';
import {
  type CreateAlertRequest,
  type UpdateAlertRequest,
  type AlertResponse,
  type AlertTriggerResponse,
  type AlertTriggersResponse,
  type AlertConditionType,
  type ChannelType,
} from '@movewatch/shared';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

// Mock user ID for development (auth deferred)
export const MOCK_USER_ID = 'mock-user-dev-001';

// Redis key prefixes
const COOLDOWN_KEY_PREFIX = 'cooldown:alert:';

/**
 * Create a new alert with notification channels
 * Accepts channelIds (array of existing channel IDs) to link to
 */
export async function createAlert(
  userId: string,
  request: CreateAlertRequest & { channelIds?: string[] }
): Promise<AlertResponse> {
  // Ensure user exists (create if not - for dev purposes)
  await ensureUserExists(userId);

  // Validate channelIds if provided
  if (request.channelIds && request.channelIds.length > 0) {
    const channels = await prisma.notificationChannel.findMany({
      where: {
        id: { in: request.channelIds },
        userId, // Ensure user owns these channels
      },
    });

    if (channels.length !== request.channelIds.length) {
      throw new Error('One or more channel IDs are invalid or not owned by user');
    }
  }

  const networkValue = (request.network?.toUpperCase() || 'TESTNET') as 'MAINNET' | 'TESTNET' | 'DEVNET';

  const alert = await prisma.alert.create({
    data: {
      userId,
      name: request.name,
      network: networkValue,
      conditionType: mapConditionType(request.condition.type),
      conditionConfig: request.condition as unknown as Prisma.InputJsonValue,
      cooldownSeconds: request.cooldownSeconds ?? 60,
      // Create AlertChannel junction records linking to existing channels
      alertChannels: request.channelIds?.length ? {
        create: request.channelIds.map((channelId) => ({
          channelId,
        })),
      } : undefined,
    },
    include: {
      alertChannels: {
        include: {
          channel: true,
        },
      },
    },
  });

  // Invalidate cache for this network
  await invalidateActiveAlertsCache(networkValue.toLowerCase());

  return formatAlertResponse(alert);
}

/**
 * Get all alerts for a user
 */
export async function getAlerts(userId: string): Promise<AlertResponse[]> {
  const alerts = await prisma.alert.findMany({
    where: { userId },
    include: {
      alertChannels: {
        include: {
          channel: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return alerts.map(formatAlertResponse);
}

/**
 * Get a single alert by ID (with ownership check)
 */
export async function getAlertById(
  alertId: string,
  userId: string
): Promise<AlertResponse | null> {
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, userId },
    include: {
      alertChannels: {
        include: {
          channel: true,
        },
      },
    },
  });

  if (!alert) return null;
  return formatAlertResponse(alert);
}

/**
 * Update an existing alert
 * Accepts channelIds to replace existing channel associations
 */
export async function updateAlert(
  alertId: string,
  userId: string,
  updates: UpdateAlertRequest & { channelIds?: string[] }
): Promise<AlertResponse | null> {
  // Verify ownership
  const existing = await prisma.alert.findFirst({
    where: { id: alertId, userId },
  });

  if (!existing) return null;

  // Validate channelIds if provided
  if (updates.channelIds !== undefined && updates.channelIds.length > 0) {
    const channels = await prisma.notificationChannel.findMany({
      where: {
        id: { in: updates.channelIds },
        userId, // Ensure user owns these channels
      },
    });

    if (channels.length !== updates.channelIds.length) {
      throw new Error('One or more channel IDs are invalid or not owned by user');
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
  if (updates.network !== undefined) {
    updateData.network = updates.network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET';
  }
  if (updates.cooldownSeconds !== undefined) {
    updateData.cooldownSeconds = updates.cooldownSeconds;
  }
  if (updates.condition !== undefined) {
    updateData.conditionType = mapConditionType(updates.condition.type);
    updateData.conditionConfig = updates.condition as unknown as Prisma.InputJsonValue;
  }

  // Wrap all updates in a transaction for atomicity
  const updatedAlert = await prisma.$transaction(async (tx) => {
    // Update alert
    await tx.alert.update({
      where: { id: alertId },
      data: updateData,
    });

    // If channelIds were provided, replace the junction table records
    if (updates.channelIds !== undefined) {
      // Delete existing alert-channel associations
      await tx.alertChannel.deleteMany({
        where: { alertId },
      });

      // Create new associations (if any channelIds provided)
      if (updates.channelIds.length > 0) {
        await tx.alertChannel.createMany({
          data: updates.channelIds.map((channelId) => ({
            alertId,
            channelId,
          })),
        });
      }
    }

    // Refetch with updated channels
    return tx.alert.findUnique({
      where: { id: alertId },
      include: {
        alertChannels: {
          include: {
            channel: true,
          },
        },
      },
    });
  });

  // Invalidate cache - both old and new network if changed
  if (updates.network) {
    await invalidateActiveAlertsCache(updates.network.toLowerCase());
  }
  await invalidateActiveAlertsCache(existing.network.toLowerCase());

  return updatedAlert ? formatAlertResponse(updatedAlert) : null;
}

/**
 * Delete an alert and clear its cooldown
 */
export async function deleteAlert(
  alertId: string,
  userId: string
): Promise<boolean> {
  // Verify ownership
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, userId },
  });

  if (!alert) return false;

  const network = alert.network.toLowerCase();

  // Delete from database (cascades to channels and triggers)
  await prisma.alert.delete({ where: { id: alertId } });

  // Clear cooldown from Redis
  await redis.del(`${COOLDOWN_KEY_PREFIX}${alertId}`);

  // Invalidate cache for this network
  await invalidateActiveAlertsCache(network);

  return true;
}

/**
 * Get trigger history for an alert
 */
export async function getTriggers(
  alertId: string,
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<AlertTriggersResponse | null> {
  // Verify ownership
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, userId },
  });

  if (!alert) return null;

  const [triggers, total] = await Promise.all([
    prisma.alertTrigger.findMany({
      where: { alertId },
      orderBy: { triggeredAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.alertTrigger.count({ where: { alertId } }),
  ]);

  return {
    triggers: triggers.map(formatTriggerResponse),
    total,
    limit,
    offset,
  };
}

/**
 * Check if an alert is in cooldown
 * @deprecated Use acquireCooldown for atomic check-and-set
 */
export async function checkCooldown(alertId: string): Promise<boolean> {
  const cooldownKey = `${COOLDOWN_KEY_PREFIX}${alertId}`;
  const lastTrigger = await redis.get(cooldownKey);
  return lastTrigger === null;
}

/**
 * Set cooldown for an alert
 * @deprecated Use acquireCooldown for atomic check-and-set
 */
export async function setCooldown(alertId: string, seconds: number): Promise<void> {
  const cooldownKey = `${COOLDOWN_KEY_PREFIX}${alertId}`;
  await redis.setex(cooldownKey, seconds, Date.now().toString());
}

/**
 * Atomically acquire a cooldown lock for an alert
 *
 * This prevents race conditions where multiple workers could process the same
 * alert simultaneously. Uses Redis SET NX (set if not exists) with expiration.
 *
 * @param alertId - The alert ID to acquire cooldown for
 * @param seconds - Cooldown duration in seconds
 * @returns true if cooldown was acquired (alert can be triggered), false if in cooldown
 */
export async function acquireCooldown(alertId: string, seconds: number): Promise<boolean> {
  const cooldownKey = `${COOLDOWN_KEY_PREFIX}${alertId}`;

  // SET NX with EX in a single atomic operation
  // Returns 'OK' if key was set (not in cooldown), null if key already exists (in cooldown)
  const result = await redis.set(
    cooldownKey,
    Date.now().toString(),
    { ex: seconds, nx: true }
  );

  return result === 'OK';
}

/**
 * Get remaining cooldown time for an alert
 * @returns Remaining seconds, or 0 if not in cooldown
 */
export async function getCooldownRemaining(alertId: string): Promise<number> {
  const cooldownKey = `${COOLDOWN_KEY_PREFIX}${alertId}`;
  const ttl = await redis.ttl(cooldownKey);
  return ttl > 0 ? ttl : 0;
}

/**
 * Clear cooldown for an alert (for testing or admin use)
 */
export async function clearCooldown(alertId: string): Promise<void> {
  const cooldownKey = `${COOLDOWN_KEY_PREFIX}${alertId}`;
  await redis.del(cooldownKey);
}

/**
 * Record an alert trigger
 */
export async function recordTrigger(
  alertId: string,
  eventData: unknown,
  transactionHash: string | null,
  notificationResults: Array<{ channel: string; success: boolean; error?: string }>
): Promise<void> {
  const successfulChannels = notificationResults
    .filter((r) => r.success)
    .map((r) => r.channel);

  const errors = notificationResults
    .filter((r) => !r.success)
    .reduce((acc, r) => ({ ...acc, [r.channel]: r.error || 'Unknown error' }), {});

  await prisma.$transaction([
    prisma.alertTrigger.create({
      data: {
        alertId,
        eventData: eventData as Prisma.InputJsonValue,
        transactionHash,
        notificationsSent: successfulChannels,
        notificationErrors: Object.keys(errors).length > 0 ? (errors as Prisma.InputJsonValue) : undefined,
      },
    }),
    prisma.alert.update({
      where: { id: alertId },
      data: {
        lastTriggeredAt: new Date(),
        triggerCount: { increment: 1 },
      },
    }),
  ]);
}

// Cache configuration for active alerts
const ACTIVE_ALERTS_CACHE_PREFIX = 'cache:activeAlerts:';
const ACTIVE_ALERTS_CACHE_TTL_SECONDS = 30; // Cache for 30 seconds

/**
 * Get all active (enabled) alerts for a given network
 * Results are cached in Redis for performance (30s TTL)
 */
export async function getActiveAlerts(network: 'mainnet' | 'testnet' | 'devnet') {
  const cacheKey = `${ACTIVE_ALERTS_CACHE_PREFIX}${network}`;

  // Try to get from cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      // Handle both string and already-parsed object from Upstash
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }
      return cached;
    }
  } catch (error) {
    // Cache miss or error, proceed to database
    console.warn('[AlertCache] Cache read error:', error);
  }

  // Query database
  const alerts = await prisma.alert.findMany({
    where: {
      enabled: true,
      network: network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
    },
    include: {
      alertChannels: {
        where: { enabled: true }, // Only include enabled channel associations
        include: {
          channel: true,
        },
      },
    },
  });

  // Store in cache
  try {
    await redis.setex(cacheKey, ACTIVE_ALERTS_CACHE_TTL_SECONDS, JSON.stringify(alerts));
  } catch (error) {
    console.warn('[AlertCache] Cache write error:', error);
  }

  return alerts;
}

/**
 * Invalidate the active alerts cache for a network
 * Call this when alerts are created, updated, or deleted
 */
export async function invalidateActiveAlertsCache(network?: string): Promise<void> {
  try {
    if (network) {
      await redis.del(`${ACTIVE_ALERTS_CACHE_PREFIX}${network.toLowerCase()}`);
    } else {
      // Invalidate all networks
      await Promise.all([
        redis.del(`${ACTIVE_ALERTS_CACHE_PREFIX}mainnet`),
        redis.del(`${ACTIVE_ALERTS_CACHE_PREFIX}testnet`),
        redis.del(`${ACTIVE_ALERTS_CACHE_PREFIX}devnet`),
      ]);
    }
  } catch (error) {
    console.warn('[AlertCache] Cache invalidation error:', error);
  }
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
 * Map condition type string to Prisma enum
 */
function mapConditionType(type: string): 'TX_FAILED' | 'BALANCE_THRESHOLD' | 'EVENT_EMITTED' | 'GAS_SPIKE' {
  const mapping: Record<string, 'TX_FAILED' | 'BALANCE_THRESHOLD' | 'EVENT_EMITTED' | 'GAS_SPIKE'> = {
    tx_failed: 'TX_FAILED',
    balance_threshold: 'BALANCE_THRESHOLD',
    event_emitted: 'EVENT_EMITTED',
    gas_spike: 'GAS_SPIKE',
  };
  return mapping[type] || 'TX_FAILED';
}

/**
 * Map channel type string to Prisma enum
 */
function mapChannelType(type: string): 'DISCORD' | 'SLACK' | 'TELEGRAM' | 'WEBHOOK' | 'EMAIL' {
  const mapping: Record<string, 'DISCORD' | 'SLACK' | 'TELEGRAM' | 'WEBHOOK' | 'EMAIL'> = {
    discord: 'DISCORD',
    slack: 'SLACK',
    telegram: 'TELEGRAM',
    webhook: 'WEBHOOK',
    email: 'EMAIL',
  };
  return mapping[type] || 'WEBHOOK';
}

/**
 * Format database alert as API response
 * Now uses alertChannels junction table to get channel data
 */
function formatAlertResponse(alert: {
  id: string;
  name: string;
  enabled: boolean;
  network: string;
  conditionType: string;
  conditionConfig: unknown;
  cooldownSeconds: number;
  lastTriggeredAt: Date | null;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
  alertChannels: Array<{
    id: string;
    enabled: boolean;
    channel: {
      id: string;
      name: string;
      type: string;
      config: unknown;
    };
  }>;
}): AlertResponse {
  return {
    id: alert.id,
    name: alert.name,
    enabled: alert.enabled,
    network: alert.network.toLowerCase() as 'mainnet' | 'testnet' | 'devnet',
    conditionType: alert.conditionType.toLowerCase().replace('_', '_') as AlertConditionType,
    conditionConfig: alert.conditionConfig as AlertResponse['conditionConfig'],
    channels: alert.alertChannels.map((ac) => ({
      id: ac.channel.id,
      name: ac.channel.name,
      type: ac.channel.type.toLowerCase() as ChannelType,
      configured: true,
      enabled: ac.enabled,
    })),
    cooldownSeconds: alert.cooldownSeconds,
    lastTriggeredAt: alert.lastTriggeredAt?.toISOString() ?? null,
    triggerCount: alert.triggerCount,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
  };
}

/**
 * Format database trigger as API response
 */
function formatTriggerResponse(trigger: {
  id: string;
  eventData: unknown;
  transactionHash: string | null;
  notificationsSent: string[];
  notificationErrors: unknown;
  triggeredAt: Date;
}): AlertTriggerResponse {
  return {
    id: trigger.id,
    eventData: trigger.eventData,
    transactionHash: trigger.transactionHash,
    notificationsSent: trigger.notificationsSent.map((s) => s.toLowerCase() as ChannelType),
    notificationErrors: trigger.notificationErrors as Record<string, string> | undefined,
    triggeredAt: trigger.triggeredAt.toISOString(),
  };
}
