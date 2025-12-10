import type { AlertCondition, NotificationPayload } from '@movewatch/shared';
import { getMovementClient } from '../lib/movement.js';
import { checkCooldown, setCooldown, recordTrigger } from './alerts.js';
import { sendNotifications } from './notifications.js';

/**
 * Indexed event structure from the blockchain
 */
export interface IndexedEvent {
  type: string;
  data: unknown;
  transactionHash: string;
  version: string;
  success: boolean;
  gasUsed: number;
  moduleAddress?: string;
  functionName?: string;
}

/**
 * Alert with channels for processing
 */
interface AlertWithChannels {
  id: string;
  name: string;
  network: string;
  conditionType: string;
  conditionConfig: unknown;
  cooldownSeconds: number;
  channels: Array<{ type: string; config: unknown; enabled: boolean }>;
}

/**
 * Evaluate all active alerts against an indexed event
 */
export async function evaluateAlertConditions(
  event: IndexedEvent,
  alerts: AlertWithChannels[]
): Promise<void> {
  for (const alert of alerts) {
    try {
      const shouldTrigger = await evaluateCondition(
        alert.conditionConfig as AlertCondition,
        event,
        alert.network.toLowerCase() as 'mainnet' | 'testnet' | 'devnet'
      );

      if (!shouldTrigger) continue;

      // Check cooldown
      const canTrigger = await checkCooldown(alert.id);
      if (!canTrigger) {
        console.log(`Alert ${alert.id} in cooldown, skipping`);
        continue;
      }

      // Set cooldown immediately to prevent duplicate triggers
      await setCooldown(alert.id, alert.cooldownSeconds);

      // Build notification payload
      const payload = buildNotificationPayload(alert, event);

      // Send notifications
      const results = await sendNotifications(alert.channels, payload);

      // Record trigger
      await recordTrigger(alert.id, event.data, event.transactionHash, results);

      console.log(`Alert ${alert.id} triggered for tx ${event.transactionHash}`);
    } catch (error) {
      console.error(`Error evaluating alert ${alert.id}:`, error);
    }
  }
}

/**
 * Evaluate a single condition against an event
 */
async function evaluateCondition(
  condition: AlertCondition,
  event: IndexedEvent,
  network: 'mainnet' | 'testnet' | 'devnet'
): Promise<boolean> {
  switch (condition.type) {
    case 'tx_failed':
      return evaluateTxFailed(condition, event);

    case 'balance_threshold':
      return evaluateBalanceThreshold(condition, network);

    case 'event_emitted':
      return evaluateEventEmitted(condition, event);

    case 'gas_spike':
      return evaluateGasSpike(condition, event);

    default:
      return false;
  }
}

/**
 * Evaluate tx_failed condition
 * Triggers when a transaction fails for the specified module/function
 */
function evaluateTxFailed(
  condition: { moduleAddress: string; functionName?: string },
  event: IndexedEvent
): boolean {
  // Only check transaction events (synthetic event type)
  if (event.type !== '_transaction') return false;

  // Check if transaction failed
  if (event.success) return false;

  // Check module address match
  if (condition.moduleAddress) {
    const normalizedModule = condition.moduleAddress.toLowerCase();
    const eventModule = event.moduleAddress?.toLowerCase();

    if (!eventModule?.includes(normalizedModule)) {
      return false;
    }
  }

  // Check function name match (optional)
  if (condition.functionName) {
    const normalizedFunction = condition.functionName.toLowerCase();
    const eventFunction = event.functionName?.toLowerCase();

    if (eventFunction !== normalizedFunction) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate balance_threshold condition
 * Triggers when an account balance crosses the threshold
 */
async function evaluateBalanceThreshold(
  condition: {
    address: string;
    tokenType: string;
    threshold: string;
    operator: string;
  },
  network: 'mainnet' | 'testnet' | 'devnet'
): Promise<boolean> {
  try {
    const client = getMovementClient(network);

    // Get account resources
    const resources = await client.getAccountResources({
      accountAddress: condition.address,
    });

    // Find the coin store for the specified token
    const coinStoreType = `0x1::coin::CoinStore<${condition.tokenType}>`;
    const coinStore = resources.find((r) => r.type === coinStoreType);

    if (!coinStore) return false;

    // Extract balance
    const balance = BigInt((coinStore.data as { coin: { value: string } }).coin.value);
    const threshold = BigInt(condition.threshold);

    // Compare based on operator
    switch (condition.operator) {
      case 'gt':
        return balance > threshold;
      case 'lt':
        return balance < threshold;
      case 'eq':
        return balance === threshold;
      case 'gte':
        return balance >= threshold;
      case 'lte':
        return balance <= threshold;
      default:
        return false;
    }
  } catch (error) {
    console.error('Error evaluating balance threshold:', error);
    return false;
  }
}

/**
 * Evaluate event_emitted condition
 * Triggers when a specific event type is emitted with optional filters
 */
function evaluateEventEmitted(
  condition: { eventType: string; filters?: Record<string, unknown> },
  event: IndexedEvent
): boolean {
  // Check event type match
  if (event.type !== condition.eventType) return false;

  // Check filters if specified
  if (condition.filters) {
    for (const [key, filterValue] of Object.entries(condition.filters)) {
      const eventValue = (event.data as Record<string, unknown>)?.[key];

      if (typeof filterValue === 'object' && filterValue !== null) {
        // Handle comparison operators in filters
        const filter = filterValue as Record<string, unknown>;

        if ('gte' in filter) {
          if (BigInt(String(eventValue)) < BigInt(String(filter.gte))) {
            return false;
          }
        }
        if ('lte' in filter) {
          if (BigInt(String(eventValue)) > BigInt(String(filter.lte))) {
            return false;
          }
        }
        if ('gt' in filter) {
          if (BigInt(String(eventValue)) <= BigInt(String(filter.gt))) {
            return false;
          }
        }
        if ('lt' in filter) {
          if (BigInt(String(eventValue)) >= BigInt(String(filter.lt))) {
            return false;
          }
        }
        if ('eq' in filter && eventValue !== filter.eq) {
          return false;
        }
      } else if (eventValue !== filterValue) {
        // Direct value comparison
        return false;
      }
    }
  }

  return true;
}

/**
 * Evaluate gas_spike condition
 * Triggers when gas usage exceeds normal range (threshold multiplier of average)
 */
function evaluateGasSpike(
  condition: { moduleAddress: string; thresholdMultiplier: number },
  event: IndexedEvent
): boolean {
  // Check module address match
  if (event.moduleAddress !== condition.moduleAddress) return false;

  // TODO: In production, calculate average gas from historical data stored in Redis
  // For now, use a baseline estimate
  const estimatedAverageGas = 10000;

  return event.gasUsed > estimatedAverageGas * condition.thresholdMultiplier;
}

/**
 * Build notification payload from alert and event
 */
function buildNotificationPayload(
  alert: AlertWithChannels,
  event: IndexedEvent
): NotificationPayload {
  return {
    alertId: alert.id,
    alertName: alert.name,
    conditionType: alert.conditionType.toLowerCase().replace('_', '_') as NotificationPayload['conditionType'],
    eventType: event.type,
    eventData: event.data,
    transactionHash: event.transactionHash,
    timestamp: new Date().toISOString(),
    link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tx/${event.transactionHash}`,
  };
}
