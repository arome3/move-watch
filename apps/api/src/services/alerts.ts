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
 */
export async function createAlert(
  userId: string,
  request: CreateAlertRequest
): Promise<AlertResponse> {
  // Ensure user exists (create if not - for dev purposes)
  await ensureUserExists(userId);

  const alert = await prisma.alert.create({
    data: {
      userId,
      name: request.name,
      network: (request.network?.toUpperCase() || 'TESTNET') as 'MAINNET' | 'TESTNET' | 'DEVNET',
      conditionType: mapConditionType(request.condition.type),
      conditionConfig: request.condition as unknown as Record<string, unknown>,
      cooldownSeconds: request.cooldownSeconds ?? 60,
      channels: {
        create: request.channels.map((channel) => ({
          type: mapChannelType(channel.type),
          config: channel.config as unknown as Record<string, unknown>,
        })),
      },
    },
    include: {
      channels: true,
    },
  });

  return formatAlertResponse(alert);
}

/**
 * Get all alerts for a user
 */
export async function getAlerts(userId: string): Promise<AlertResponse[]> {
  const alerts = await prisma.alert.findMany({
    where: { userId },
    include: { channels: true },
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
    include: { channels: true },
  });

  if (!alert) return null;
  return formatAlertResponse(alert);
}

/**
 * Update an existing alert
 */
export async function updateAlert(
  alertId: string,
  userId: string,
  updates: UpdateAlertRequest
): Promise<AlertResponse | null> {
  // Verify ownership
  const existing = await prisma.alert.findFirst({
    where: { id: alertId, userId },
  });

  if (!existing) return null;

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
    updateData.conditionConfig = updates.condition as unknown as Record<string, unknown>;
  }

  // Update alert
  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: updateData,
    include: { channels: true },
  });

  // If channels were updated, replace them
  if (updates.channels !== undefined) {
    // Delete existing channels
    await prisma.notificationChannel.deleteMany({
      where: { alertId },
    });

    // Create new channels
    await prisma.notificationChannel.createMany({
      data: updates.channels.map((channel) => ({
        alertId,
        type: mapChannelType(channel.type),
        config: channel.config as unknown as Record<string, unknown>,
      })),
    });

    // Refetch with updated channels
    const updatedAlert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: { channels: true },
    });

    return updatedAlert ? formatAlertResponse(updatedAlert) : null;
  }

  return formatAlertResponse(alert);
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

  // Delete from database (cascades to channels and triggers)
  await prisma.alert.delete({ where: { id: alertId } });

  // Clear cooldown from Redis
  await redis.del(`${COOLDOWN_KEY_PREFIX}${alertId}`);

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
 */
export async function checkCooldown(alertId: string): Promise<boolean> {
  const cooldownKey = `${COOLDOWN_KEY_PREFIX}${alertId}`;
  const lastTrigger = await redis.get(cooldownKey);
  return lastTrigger === null;
}

/**
 * Set cooldown for an alert
 */
export async function setCooldown(alertId: string, seconds: number): Promise<void> {
  const cooldownKey = `${COOLDOWN_KEY_PREFIX}${alertId}`;
  await redis.setex(cooldownKey, seconds, Date.now().toString());
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
        eventData: eventData as Record<string, unknown>,
        transactionHash,
        notificationsSent: successfulChannels,
        notificationErrors: Object.keys(errors).length > 0 ? errors : undefined,
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

/**
 * Get all active (enabled) alerts for a given network
 */
export async function getActiveAlerts(network: 'mainnet' | 'testnet' | 'devnet') {
  return prisma.alert.findMany({
    where: {
      enabled: true,
      network: network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
    },
    include: { channels: true },
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
function mapChannelType(type: string): 'DISCORD' | 'SLACK' | 'TELEGRAM' | 'WEBHOOK' {
  const mapping: Record<string, 'DISCORD' | 'SLACK' | 'TELEGRAM' | 'WEBHOOK'> = {
    discord: 'DISCORD',
    slack: 'SLACK',
    telegram: 'TELEGRAM',
    webhook: 'WEBHOOK',
  };
  return mapping[type] || 'WEBHOOK';
}

/**
 * Format database alert as API response
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
  channels: Array<{
    id: string;
    type: string;
    config: unknown;
    enabled: boolean;
  }>;
}): AlertResponse {
  return {
    id: alert.id,
    name: alert.name,
    enabled: alert.enabled,
    network: alert.network.toLowerCase() as 'mainnet' | 'testnet' | 'devnet',
    conditionType: alert.conditionType.toLowerCase().replace('_', '_') as AlertConditionType,
    conditionConfig: alert.conditionConfig as AlertResponse['conditionConfig'],
    channels: alert.channels.map((c) => ({
      id: c.id,
      type: c.type.toLowerCase() as ChannelType,
      configured: true,
      enabled: c.enabled,
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
