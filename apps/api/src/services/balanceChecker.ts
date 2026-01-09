/**
 * Balance Checker Service
 *
 * Handles batch checking of balance_threshold alerts separately from event processing.
 * Balance checks are expensive (require RPC calls) and should not run on every event.
 *
 * This service:
 * - Groups balance checks by address to minimize RPC calls
 * - Caches balance results to reduce redundant queries
 * - Runs on a configurable interval (default 30s)
 */

import { redis } from '../lib/redis.js';
import { withMovementClient, CircuitOpenError } from '../lib/movement.js';
import { prisma } from '../lib/prisma.js';
import { acquireCooldown, recordTrigger } from './alerts.js';
import { queueNotification } from './notificationQueue.js';
import { broadcastAlert } from './websocketService.js';
import { getNotificationConfig } from './channelConfigService.js';
import type { NotificationPayload, Network } from '@movewatch/shared';

// Configuration
const BALANCE_CHECK_INTERVAL_MS = 30000; // 30 seconds
const BALANCE_CACHE_TTL_SECONDS = 15; // Cache balance for 15 seconds
const BALANCE_CACHE_PREFIX = 'cache:balance:';

// Track running state
let isRunning = false;
let checkIntervalId: NodeJS.Timeout | null = null;

/**
 * Balance threshold alert with channel info
 */
interface BalanceAlert {
  id: string;
  name: string;
  network: string;
  cooldownSeconds: number;
  condition: {
    address: string;
    tokenType: string;
    threshold: string;
    operator: string;
  };
  channels: Array<{ type: string; config: unknown; enabled: boolean }>;
}

/**
 * Grouped balance checks by address
 */
interface AddressCheck {
  address: string;
  tokenType: string;
  alerts: BalanceAlert[];
}

/**
 * Get all balance_threshold alerts for a network
 */
async function getBalanceAlerts(network: Network): Promise<BalanceAlert[]> {
  const alerts = await prisma.alert.findMany({
    where: {
      enabled: true,
      network: network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
      conditionType: 'BALANCE_THRESHOLD',
    },
    include: {
      alertChannels: {
        where: { enabled: true },
        include: {
          channel: true,
        },
      },
    },
  });

  return alerts.map((alert) => ({
    id: alert.id,
    name: alert.name,
    network: alert.network,
    cooldownSeconds: alert.cooldownSeconds,
    condition: alert.conditionConfig as BalanceAlert['condition'],
    channels: alert.alertChannels.map((ac) => ({
      type: ac.channel.type,
      config: getNotificationConfig(ac.channel.type.toLowerCase(), ac.channel.config),
      enabled: true,
    })),
  }));
}

/**
 * Group alerts by address+tokenType to minimize RPC calls
 */
function groupAlertsByAddress(alerts: BalanceAlert[]): AddressCheck[] {
  const groups = new Map<string, AddressCheck>();

  for (const alert of alerts) {
    const key = `${alert.condition.address}:${alert.condition.tokenType}`;

    if (!groups.has(key)) {
      groups.set(key, {
        address: alert.condition.address,
        tokenType: alert.condition.tokenType,
        alerts: [],
      });
    }

    groups.get(key)!.alerts.push(alert);
  }

  return Array.from(groups.values());
}

/**
 * Get balance with caching and circuit breaker protection
 */
async function getBalanceWithCache(
  network: Network,
  address: string,
  tokenType: string
): Promise<bigint | null> {
  const cacheKey = `${BALANCE_CACHE_PREFIX}${network}:${address}:${tokenType}`;

  // Try cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return BigInt(cached);
    }
  } catch {
    // Cache miss
  }

  // Fetch from chain with circuit breaker protection
  try {
    const resources = await withMovementClient(network, (client) =>
      client.getAccountResources({ accountAddress: address })
    );

    const coinStoreType = `0x1::coin::CoinStore<${tokenType}>`;
    const coinStore = resources.find((r) => r.type === coinStoreType);

    if (!coinStore) {
      return null;
    }

    const balance = BigInt((coinStore.data as { coin: { value: string } }).coin.value);

    // Cache the result
    try {
      await redis.setex(cacheKey, BALANCE_CACHE_TTL_SECONDS, balance.toString());
    } catch {
      // Cache write error, ignore
    }

    return balance;
  } catch (error) {
    // Handle circuit breaker open - skip gracefully
    if (error instanceof CircuitOpenError) {
      console.log(`[BalanceChecker] Circuit open for ${network}, skipping balance check`);
      return null;
    }
    console.error(`[BalanceChecker] Error fetching balance for ${address}:`, error);
    return null;
  }
}

/**
 * Evaluate threshold condition
 */
function evaluateThreshold(
  balance: bigint,
  threshold: string,
  operator: string
): boolean {
  const thresholdBigInt = BigInt(threshold);

  switch (operator) {
    case 'gt':
      return balance > thresholdBigInt;
    case 'lt':
      return balance < thresholdBigInt;
    case 'eq':
      return balance === thresholdBigInt;
    case 'gte':
      return balance >= thresholdBigInt;
    case 'lte':
      return balance <= thresholdBigInt;
    default:
      return false;
  }
}

/**
 * Process alerts for a single address check
 */
async function processAddressCheck(
  check: AddressCheck,
  network: Network
): Promise<void> {
  const balance = await getBalanceWithCache(network, check.address, check.tokenType);

  if (balance === null) {
    return; // Skip if balance couldn't be fetched
  }

  for (const alert of check.alerts) {
    const shouldTrigger = evaluateThreshold(
      balance,
      alert.condition.threshold,
      alert.condition.operator
    );

    if (!shouldTrigger) continue;

    // Atomically acquire cooldown
    const acquired = await acquireCooldown(alert.id, alert.cooldownSeconds);
    if (!acquired) {
      continue;
    }

    // Build notification payload
    const payload: NotificationPayload = {
      alertId: alert.id,
      alertName: alert.name,
      conditionType: 'balance_threshold',
      eventType: 'balance_check',
      eventData: {
        address: check.address,
        tokenType: check.tokenType,
        balance: balance.toString(),
        threshold: alert.condition.threshold,
        operator: alert.condition.operator,
      },
      timestamp: new Date().toISOString(),
      link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/alerts/${alert.id}`,
    };

    // Broadcast to WebSocket clients
    broadcastAlert(alert.id, alert.network, payload);

    // Queue notification
    await queueNotification(alert.id, alert.channels, payload);

    // Record trigger
    await recordTrigger(alert.id, payload.eventData, null, []);

    console.log(
      `[BalanceChecker] Alert ${alert.id} triggered: ` +
        `${check.address} balance ${balance} ${alert.condition.operator} ${alert.condition.threshold}`
    );
  }
}

/**
 * Run balance checks for a network
 */
async function checkNetworkBalances(network: Network): Promise<void> {
  try {
    const alerts = await getBalanceAlerts(network);

    if (alerts.length === 0) return;

    // Group by address to minimize RPC calls
    const addressChecks = groupAlertsByAddress(alerts);

    console.log(
      `[BalanceChecker] Checking ${alerts.length} balance alerts ` +
        `(${addressChecks.length} unique addresses) on ${network}`
    );

    // Process address checks in parallel with concurrency limit
    const CONCURRENCY = 5;
    for (let i = 0; i < addressChecks.length; i += CONCURRENCY) {
      const batch = addressChecks.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map((check) => processAddressCheck(check, network))
      );
    }
  } catch (error) {
    console.error(`[BalanceChecker] Error checking ${network}:`, error);
  }
}

/**
 * Run a single balance check cycle for all networks
 */
async function runBalanceCheckCycle(): Promise<void> {
  const networks: Network[] = ['mainnet', 'testnet'];

  await Promise.all(networks.map((network) => checkNetworkBalances(network)));
}

/**
 * Start the balance checker service
 */
export function startBalanceChecker(): void {
  if (isRunning) {
    console.log('[BalanceChecker] Already running');
    return;
  }

  isRunning = true;
  console.log(`[BalanceChecker] Starting (interval: ${BALANCE_CHECK_INTERVAL_MS}ms)`);

  // Run immediately
  runBalanceCheckCycle().catch((error) => {
    console.error('[BalanceChecker] Initial check failed:', error);
  });

  // Schedule periodic checks
  checkIntervalId = setInterval(() => {
    if (isRunning) {
      runBalanceCheckCycle().catch((error) => {
        console.error('[BalanceChecker] Check cycle failed:', error);
      });
    }
  }, BALANCE_CHECK_INTERVAL_MS);
}

/**
 * Stop the balance checker service
 */
export function stopBalanceChecker(): void {
  if (!isRunning) return;

  isRunning = false;

  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }

  console.log('[BalanceChecker] Stopped');
}

/**
 * Get balance checker status
 */
export function getBalanceCheckerStatus(): {
  running: boolean;
  intervalMs: number;
  cacheTtlSeconds: number;
} {
  return {
    running: isRunning,
    intervalMs: BALANCE_CHECK_INTERVAL_MS,
    cacheTtlSeconds: BALANCE_CACHE_TTL_SECONDS,
  };
}
