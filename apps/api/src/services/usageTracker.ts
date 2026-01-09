/**
 * Usage Tracker Service
 *
 * Tracks API usage per user/wallet for free tier enforcement.
 * Uses database for persistent tracking with daily/monthly resets.
 */

import { prisma } from '@movewatch/database';
import type { EndpointPricing } from '@movewatch/shared';

// Mapping of endpoints to their usage counter fields
const ENDPOINT_COUNTER_MAP: Record<string, keyof UsageCounters> = {
  'POST /v1/simulate': 'simulationsToday',
  'POST /v1/alerts': 'alertsCreated',
  'POST /v1/actions/:id/test': 'actionsExecuted',
  'GET /v1/monitoring/stats': 'monitoringCalls',
};

interface UsageCounters {
  simulationsToday: number;
  alertsCreated: number;
  actionsExecuted: number;
  monitoringCalls: number;
}

/**
 * Check if user/wallet has exceeded their free quota for an endpoint
 * Returns true if quota exceeded (payment required)
 */
export async function checkUsageQuota(
  identifier: string,
  endpoint: string,
  pricing: EndpointPricing
): Promise<boolean> {
  if (pricing.freeLimit === 0) {
    // No free tier for this endpoint
    return true;
  }

  const counterField = ENDPOINT_COUNTER_MAP[endpoint];
  if (!counterField) {
    // Unknown endpoint - don't enforce quota
    return false;
  }

  // Get or create usage quota record
  const quota = await getOrCreateQuota(identifier);

  // Check if quota needs reset
  const needsReset = shouldResetQuota(quota.lastResetDate, pricing.freePeriod);
  if (needsReset) {
    await resetQuota(identifier, pricing.freePeriod);
    return false; // Fresh quota, not exceeded
  }

  // Check current usage against limit
  const currentUsage = quota[counterField];
  return currentUsage >= pricing.freeLimit;
}

/**
 * Increment usage counter for an endpoint
 */
export async function incrementUsage(
  identifier: string,
  endpoint: string
): Promise<void> {
  const counterField = ENDPOINT_COUNTER_MAP[endpoint];
  if (!counterField) return;

  // Determine if identifier is userId or wallet address
  const isWallet = identifier.startsWith('0x');

  const whereClause = isWallet
    ? { walletAddress: identifier }
    : { userId: identifier };

  const updateData = {
    [counterField]: { increment: 1 },
  };

  try {
    await prisma.usageQuota.update({
      where: whereClause,
      data: updateData,
    });
  } catch (error) {
    // Record might not exist, create it with incremented value
    await prisma.usageQuota.create({
      data: {
        ...(isWallet ? { walletAddress: identifier } : { userId: identifier }),
        [counterField]: 1,
        lastResetDate: new Date(),
      },
    });
  }
}

/**
 * Get usage quota for a user/wallet
 */
export async function getUsageQuota(identifier: string): Promise<UsageCounters & { lastResetDate: Date }> {
  const quota = await getOrCreateQuota(identifier);
  return {
    simulationsToday: quota.simulationsToday,
    alertsCreated: quota.alertsCreated,
    actionsExecuted: quota.actionsExecuted,
    monitoringCalls: quota.monitoringCalls,
    lastResetDate: quota.lastResetDate,
  };
}

/**
 * Get or create usage quota record
 */
async function getOrCreateQuota(identifier: string) {
  const isWallet = identifier.startsWith('0x');

  const whereClause = isWallet
    ? { walletAddress: identifier }
    : { userId: identifier };

  let quota = await prisma.usageQuota.findFirst({
    where: whereClause,
  });

  if (!quota) {
    quota = await prisma.usageQuota.create({
      data: {
        ...(isWallet ? { walletAddress: identifier } : { userId: identifier }),
        simulationsToday: 0,
        alertsCreated: 0,
        actionsExecuted: 0,
        monitoringCalls: 0,
        lastResetDate: new Date(),
      },
    });
  }

  return quota;
}

/**
 * Check if quota should be reset based on period
 */
function shouldResetQuota(lastResetDate: Date, period: 'day' | 'month'): boolean {
  const now = new Date();
  const lastReset = new Date(lastResetDate);

  if (period === 'day') {
    // Reset at midnight UTC
    const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const lastResetUTC = new Date(Date.UTC(lastReset.getUTCFullYear(), lastReset.getUTCMonth(), lastReset.getUTCDate()));
    return nowUTC > lastResetUTC;
  }

  if (period === 'month') {
    // Reset on first of month
    return (
      now.getUTCMonth() !== lastReset.getUTCMonth() ||
      now.getUTCFullYear() !== lastReset.getUTCFullYear()
    );
  }

  return false;
}

/**
 * Reset quota counters based on period
 */
async function resetQuota(identifier: string, period: 'day' | 'month'): Promise<void> {
  const isWallet = identifier.startsWith('0x');

  const whereClause = isWallet
    ? { walletAddress: identifier }
    : { userId: identifier };

  // Reset fields based on period
  const resetFields = period === 'day'
    ? {
        simulationsToday: 0,
        actionsExecuted: 0,
        monitoringCalls: 0,
        lastResetDate: new Date(),
      }
    : {
        simulationsToday: 0,
        alertsCreated: 0,
        actionsExecuted: 0,
        monitoringCalls: 0,
        lastResetDate: new Date(),
      };

  await prisma.usageQuota.update({
    where: whereClause,
    data: resetFields,
  });
}

/**
 * Get the next reset time for a given period
 */
export function getNextResetTime(period: 'day' | 'month'): Date {
  const now = new Date();

  if (period === 'day') {
    // Next midnight UTC
    const tomorrow = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    return tomorrow;
  }

  // First of next month UTC
  const nextMonth = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1, 0, 0, 0, 0
  ));
  return nextMonth;
}
