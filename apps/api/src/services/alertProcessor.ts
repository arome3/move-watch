import type { AlertCondition, NotificationPayload, Network } from '@movewatch/shared';
import { getMovementClient } from '../lib/movement.js';
import { acquireCooldown, recordTrigger } from './alerts.js';
import { sendNotifications } from './notifications.js';
import { queueNotification, BackpressureError } from './notificationQueue.js';
import { parseVMStatus, getErrorSummary, type ParsedVMStatus } from '../lib/vmStatus.js';
import { broadcastAlert } from './websocketService.js';
import { getBenchmark, type GasBenchmark } from './gasBenchmarkService.js';
import { getNotificationConfig } from './channelConfigService.js';

// Configuration
const USE_ASYNC_NOTIFICATIONS = process.env.ASYNC_NOTIFICATIONS !== 'false';

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
 * Supports both junction table structure (alertChannels) and flattened channels
 */
interface AlertWithChannels {
  id: string;
  name: string;
  network: string;
  conditionType: string;
  conditionConfig: unknown;
  cooldownSeconds: number;
  alertChannels: Array<{
    enabled: boolean;
    channel: {
      type: string;
      config: unknown;
    };
  }>;
}

/**
 * Helper to extract channels from alert for notification
 * SECURITY: Decrypts channel configs before passing to notification service
 */
function getEnabledChannels(alert: AlertWithChannels): Array<{ type: string; config: unknown; enabled: boolean }> {
  return alert.alertChannels
    .filter((ac) => ac.enabled)
    .map((ac) => {
      const channelType = ac.channel.type.toLowerCase();
      // Decrypt config for sending notifications
      const decryptedConfig = getNotificationConfig(channelType, ac.channel.config);
      return {
        type: ac.channel.type,
        config: decryptedConfig,
        enabled: true, // Already filtered above
      };
    });
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

      // Atomically check and acquire cooldown lock
      // This prevents race conditions where multiple workers process the same alert
      const acquired = await acquireCooldown(alert.id, alert.cooldownSeconds);
      if (!acquired) {
        console.log(`Alert ${alert.id} in cooldown, skipping`);
        continue;
      }

      // Build notification payload
      const payload = buildNotificationPayload(alert, event);

      // Get enabled channels
      const channels = getEnabledChannels(alert);

      // Broadcast to connected WebSocket clients for real-time updates (always sync)
      broadcastAlert(alert.id, alert.network, payload);

      // Send notifications (async or sync based on configuration)
      let results: Array<{ channel: string; success: boolean; error?: string }>;

      if (USE_ASYNC_NOTIFICATIONS) {
        try {
          // Queue notifications for async processing (non-blocking)
          await queueNotification(alert.id, channels, payload);
          // Record as pending - actual results will be logged by the worker
          results = channels.map((c) => ({
            channel: c.type.toLowerCase(),
            success: true, // Optimistically mark as queued
            latencyMs: 0,
          }));
          console.log(`Alert ${alert.id} triggered, notifications queued for tx ${event.transactionHash}`);
        } catch (queueError) {
          // Handle backpressure gracefully - alert was processed, just couldn't queue notification
          if (queueError instanceof BackpressureError) {
            console.warn(
              `[AlertProcessor] Backpressure: notification queue full for alert ${alert.id}. ` +
                `Alert recorded but notification not sent.`
            );
            results = channels.map((c) => ({
              channel: c.type.toLowerCase(),
              success: false,
              error: 'Notification queue full (backpressure)',
            }));
          } else {
            throw queueError;
          }
        }
      } else {
        // Synchronous notification (legacy behavior)
        results = await sendNotifications(channels, payload);
        console.log(`Alert ${alert.id} triggered for tx ${event.transactionHash}`);
      }

      // Record trigger
      await recordTrigger(alert.id, event.data, event.transactionHash, results);
    } catch (error) {
      console.error(`Error evaluating alert ${alert.id}:`, error);
    }
  }
}

/**
 * Evaluate a single condition against an event
 *
 * NOTE: balance_threshold is handled by the dedicated BalanceChecker service
 * which runs on a separate interval. This prevents expensive RPC calls on every event.
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
      // Skip - handled by dedicated BalanceChecker service (balanceChecker.ts)
      // Balance checks are expensive (RPC calls) and run on a separate interval
      return false;

    case 'event_emitted':
      return evaluateEventEmitted(condition, event);

    case 'gas_spike':
      return evaluateGasSpike(condition, event, network);

    case 'function_call':
      return evaluateFunctionCall(condition, event);

    case 'token_transfer':
      return evaluateTokenTransfer(condition, event);

    case 'large_transaction':
      return evaluateLargeTransaction(condition, event);

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
 * Now uses real benchmark data from the gas benchmark service
 */
async function evaluateGasSpike(
  condition: { moduleAddress: string; thresholdMultiplier: number },
  event: IndexedEvent,
  network: 'mainnet' | 'testnet' | 'devnet'
): Promise<boolean> {
  // Must have a module address to evaluate
  if (!event.moduleAddress) return false;

  // Check module address match
  const normalizedModule = condition.moduleAddress.toLowerCase();
  const eventModule = event.moduleAddress.toLowerCase();

  if (!eventModule.includes(normalizedModule)) return false;

  // Build function path for benchmark lookup
  const functionPath = event.functionName
    ? `${event.moduleAddress}::${event.functionName}`
    : event.moduleAddress;

  try {
    // Get real benchmark data for this function
    const benchmark = await getBenchmark(network, functionPath);

    // Use the 90th percentile as the baseline for spike detection
    // This is more robust than average for detecting anomalies
    const spikeThreshold = benchmark.p90 * condition.thresholdMultiplier;

    // Log for monitoring
    if (event.gasUsed > spikeThreshold) {
      console.log(
        `[GasSpike] Detected: ${functionPath} used ${event.gasUsed} gas, ` +
          `threshold=${spikeThreshold} (p90=${benchmark.p90} * ${condition.thresholdMultiplier})`
      );
    }

    return event.gasUsed > spikeThreshold;
  } catch (error) {
    // Fallback to conservative estimate if benchmark service fails
    console.warn(`[GasSpike] Benchmark lookup failed, using fallback: ${error}`);
    const fallbackThreshold = 10000 * condition.thresholdMultiplier;
    return event.gasUsed > fallbackThreshold;
  }
}

/**
 * Evaluate function_call condition
 * Triggers when a specific function is invoked
 */
function evaluateFunctionCall(
  condition: {
    moduleAddress: string;
    moduleName: string;
    functionName: string;
    trackSuccess?: boolean;
    trackFailed?: boolean;
    filters?: { sender?: string; minGas?: number };
  },
  event: IndexedEvent
): boolean {
  // Only check transaction events
  if (event.type !== '_transaction') return false;

  // Check success/failure tracking preferences
  const trackSuccess = condition.trackSuccess ?? true;
  const trackFailed = condition.trackFailed ?? false;

  if (event.success && !trackSuccess) return false;
  if (!event.success && !trackFailed) return false;

  // Build expected function path
  const expectedPath = `${condition.moduleAddress}::${condition.moduleName}::${condition.functionName}`;
  const eventFunction = event.functionName?.toLowerCase();
  const expectedLower = expectedPath.toLowerCase();

  // Check if event function matches (handle various formats)
  if (!eventFunction) return false;

  // Direct match or partial match
  const matches =
    eventFunction === expectedLower ||
    eventFunction.endsWith(`::${condition.moduleName}::${condition.functionName}`.toLowerCase()) ||
    eventFunction.includes(expectedLower);

  if (!matches) return false;

  // Apply filters if specified
  if (condition.filters) {
    // Sender filter
    if (condition.filters.sender) {
      const eventData = event.data as { sender?: string } | undefined;
      const eventSender = eventData?.sender?.toLowerCase();
      if (eventSender !== condition.filters.sender.toLowerCase()) {
        return false;
      }
    }

    // Minimum gas filter
    if (condition.filters.minGas && event.gasUsed < condition.filters.minGas) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate token_transfer condition
 * Monitors coin/token movements to/from an address
 */
function evaluateTokenTransfer(
  condition: {
    tokenType: string;
    direction: 'in' | 'out' | 'both';
    address: string;
    minAmount?: string;
    maxAmount?: string;
  },
  event: IndexedEvent
): boolean {
  // Check for deposit or withdraw events
  const isDeposit = event.type.includes('DepositEvent') || event.type.includes('::Deposit');
  const isWithdraw = event.type.includes('WithdrawEvent') || event.type.includes('::Withdraw');

  if (!isDeposit && !isWithdraw) return false;

  // Check direction filter
  if (condition.direction === 'in' && !isDeposit) return false;
  if (condition.direction === 'out' && !isWithdraw) return false;

  // Check token type matches
  if (!event.type.includes(condition.tokenType)) return false;

  // Extract event data
  const eventData = event.data as { account?: string; amount?: string } | undefined;
  if (!eventData) return false;

  // Check address matches
  const eventAddress = eventData.account?.toLowerCase();
  if (eventAddress !== condition.address.toLowerCase()) return false;

  // Check amount filters
  if (eventData.amount) {
    const amount = BigInt(eventData.amount);

    if (condition.minAmount && amount < BigInt(condition.minAmount)) {
      return false;
    }

    if (condition.maxAmount && amount > BigInt(condition.maxAmount)) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate large_transaction condition
 * Alerts on high-value transfers above threshold
 */
function evaluateLargeTransaction(
  condition: {
    tokenType: string;
    threshold: string;
    addresses?: string[];
  },
  event: IndexedEvent
): boolean {
  // Check for transfer-related events
  const isTransfer =
    event.type.includes('DepositEvent') ||
    event.type.includes('WithdrawEvent') ||
    event.type.includes('::Deposit') ||
    event.type.includes('::Withdraw') ||
    event.type.includes('Transfer');

  if (!isTransfer) return false;

  // Check token type
  if (!event.type.includes(condition.tokenType)) return false;

  // Extract amount from event data
  const eventData = event.data as { amount?: string; account?: string } | undefined;
  if (!eventData?.amount) return false;

  const amount = BigInt(eventData.amount);
  const threshold = BigInt(condition.threshold);

  // Check if amount exceeds threshold
  if (amount < threshold) return false;

  // If specific addresses are configured, check if this involves one
  if (condition.addresses && condition.addresses.length > 0) {
    const eventAddress = eventData.account?.toLowerCase();
    const matchesAddress = condition.addresses.some(
      (addr) => addr.toLowerCase() === eventAddress
    );
    if (!matchesAddress) return false;
  }

  console.log(
    `[LargeTransaction] Detected: ${amount.toString()} ${condition.tokenType} ` +
      `(threshold: ${condition.threshold}), tx: ${event.transactionHash}`
  );

  return true;
}

/**
 * Build notification payload from alert and event
 */
function buildNotificationPayload(
  alert: AlertWithChannels,
  event: IndexedEvent
): NotificationPayload {
  // Parse VM status for failed transactions
  let parsedError: ParsedVMStatus | undefined;
  if (!event.success && event.type === '_transaction') {
    const vmStatus = (event.data as { vmStatus?: string })?.vmStatus || '';
    parsedError = parseVMStatus(vmStatus);
  }

  return {
    alertId: alert.id,
    alertName: alert.name,
    conditionType: alert.conditionType.toLowerCase().replace('_', '_') as NotificationPayload['conditionType'],
    eventType: event.type,
    eventData: event.data,
    transactionHash: event.transactionHash,
    timestamp: new Date().toISOString(),
    link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tx/${event.transactionHash}`,
    // Enhanced error information
    errorInfo: parsedError ? {
      code: parsedError.code,
      name: parsedError.name,
      description: parsedError.description,
      category: parsedError.category,
      suggestion: parsedError.suggestion,
    } : undefined,
  };
}
