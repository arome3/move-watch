import {
  type ChannelConfig,
  type ChannelType,
  type NotificationPayload,
  type TestNotificationResult,
  type DiscordChannelConfig,
  type SlackChannelConfig,
  type TelegramChannelConfig,
  type WebhookChannelConfig,
  type EmailChannelConfig,
  type ActionChannelConfig,
  type Network,
} from '@movewatch/shared';
import { sendEmail } from './emailService.js';
import { renderAlertEmail, renderAlertEmailText } from '../templates/alertEmail.js';
import { executeAction } from './actionExecutor.js';
import { prisma } from '../lib/prisma.js';
import { getDecryptedSecrets } from './secretsManager.js';
import { safeFetch, validateWebhookUrl, isKnownWebhookProvider } from '../lib/ssrfProtection.js';
import {
  withCircuitBreaker,
  CIRCUIT_CONFIGS,
  CircuitOpenError,
} from '../lib/circuitBreaker.js';

// Timeout for HTTP requests (10 seconds)
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Send notifications to all configured channels
 * Uses circuit breakers to prevent cascading failures
 */
export async function sendNotifications(
  channels: Array<{ type: string; config: unknown; enabled: boolean }>,
  payload: NotificationPayload
): Promise<Array<{ channel: string; success: boolean; error?: string; circuitOpen?: boolean }>> {
  const results = await Promise.all(
    channels
      .filter((c) => c.enabled)
      .map(async (channel) => {
        const startTime = Date.now();
        try {
          await sendToChannel(channel.type.toLowerCase() as ChannelType, channel.config, payload);
          return {
            channel: channel.type.toLowerCase(),
            success: true,
            latencyMs: Date.now() - startTime,
          };
        } catch (error) {
          // Check if circuit breaker is open
          if (error instanceof CircuitOpenError) {
            return {
              channel: channel.type.toLowerCase(),
              success: false,
              error: `Service temporarily unavailable (retry after ${Math.ceil(error.retryAfterMs / 1000)}s)`,
              circuitOpen: true,
              latencyMs: Date.now() - startTime,
            };
          }
          return {
            channel: channel.type.toLowerCase(),
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            latencyMs: Date.now() - startTime,
          };
        }
      })
  );

  return results;
}

/**
 * Test all notification channels with a sample payload
 */
export async function testNotificationChannels(
  channels: Array<{ type: string; config: unknown }>
): Promise<TestNotificationResult[]> {
  const testPayload: NotificationPayload = {
    alertId: 'test-alert-id',
    alertName: 'Test Alert',
    conditionType: 'tx_failed',
    eventType: 'test',
    eventData: { message: 'This is a test notification from MoveWatch' },
    transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    timestamp: new Date().toISOString(),
    link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/alerts`,
  };

  const results = await Promise.all(
    channels.map(async (channel) => {
      const startTime = Date.now();
      try {
        await sendToChannel(channel.type.toLowerCase() as ChannelType, channel.config, testPayload);
        return {
          channel: channel.type.toLowerCase() as ChannelType,
          success: true,
          latencyMs: Date.now() - startTime,
        };
      } catch (error) {
        return {
          channel: channel.type.toLowerCase() as ChannelType,
          success: false,
          latencyMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  return results;
}

/**
 * Route notification to the appropriate channel handler
 * Wraps each channel with a circuit breaker to prevent cascading failures
 */
async function sendToChannel(
  type: ChannelType,
  config: unknown,
  payload: NotificationPayload
): Promise<void> {
  // Get circuit breaker config for this channel type
  const circuitConfig = CIRCUIT_CONFIGS[type];

  // Function to execute based on channel type
  const execute = async () => {
    switch (type) {
      case 'discord':
        await sendDiscordNotification(config as DiscordChannelConfig, payload);
        break;
      case 'slack':
        await sendSlackNotification(config as SlackChannelConfig, payload);
        break;
      case 'telegram':
        await sendTelegramNotification(config as TelegramChannelConfig, payload);
        break;
      case 'webhook':
        await sendWebhookNotification(config as WebhookChannelConfig, payload);
        break;
      case 'email':
        await sendEmailNotification(config as EmailChannelConfig, payload);
        break;
      case 'action':
        // Actions have their own execution context, no circuit breaker
        await sendActionNotification(config as ActionChannelConfig, payload);
        break;
      default:
        throw new Error(`Unsupported channel type: ${type}`);
    }
  };

  // Wrap with circuit breaker if config exists (skip for action channel)
  if (circuitConfig && type !== 'action') {
    await withCircuitBreaker(circuitConfig, execute);
  } else {
    await execute();
  }
}

/**
 * Send Discord webhook notification with rich embed
 */
async function sendDiscordNotification(
  config: DiscordChannelConfig,
  payload: NotificationPayload
): Promise<void> {
  const color = getColorForConditionType(payload.conditionType);

  // Build error info fields if available
  const errorFields = payload.errorInfo
    ? [
        {
          name: '❌ Error',
          value: `**${payload.errorInfo.name}**\n${payload.errorInfo.description}`,
          inline: false,
        },
        {
          name: '💡 Suggestion',
          value: payload.errorInfo.suggestion,
          inline: false,
        },
      ]
    : [];

  const embed = {
    title: `🚨 ${payload.alertName}`,
    description: getDescriptionForConditionType(payload.conditionType),
    color,
    fields: [
      {
        name: 'Condition Type',
        value: formatConditionType(payload.conditionType),
        inline: true,
      },
      {
        name: 'Event Type',
        value: payload.eventType || 'N/A',
        inline: true,
      },
      ...(payload.transactionHash
        ? [
            {
              name: 'Transaction',
              value: `\`${truncateHash(payload.transactionHash)}\``,
              inline: false,
            },
          ]
        : []),
      ...errorFields,
      {
        name: 'Details',
        value: `[View in MoveWatch](${payload.link})`,
        inline: false,
      },
    ],
    timestamp: payload.timestamp,
    footer: {
      text: 'MoveWatch Alerts',
    },
  };

  const response = await fetchWithTimeout(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} - ${text}`);
  }
}

/**
 * Send Slack webhook notification with blocks
 */
async function sendSlackNotification(
  config: SlackChannelConfig,
  payload: NotificationPayload
): Promise<void> {
  // Build error info blocks if available
  const errorBlocks = payload.errorInfo
    ? [
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `❌ *Error:* ${payload.errorInfo.name}\n${payload.errorInfo.description}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `💡 *Suggestion:* ${payload.errorInfo.suggestion}`,
          },
        },
      ]
    : [];

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🚨 ${payload.alertName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: getDescriptionForConditionType(payload.conditionType),
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Condition:*\n${formatConditionType(payload.conditionType)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Event Type:*\n${payload.eventType || 'N/A'}`,
        },
      ],
    },
    ...(payload.transactionHash
      ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Transaction:* \`${truncateHash(payload.transactionHash)}\``,
            },
          },
        ]
      : []),
    ...errorBlocks,
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View in MoveWatch',
            emoji: true,
          },
          url: payload.link,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Triggered at ${new Date(payload.timestamp).toLocaleString()}`,
        },
      ],
    },
  ];

  const response = await fetchWithTimeout(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} - ${text}`);
  }
}

/**
 * Send Telegram bot notification
 */
async function sendTelegramNotification(
  config: TelegramChannelConfig,
  payload: NotificationPayload
): Promise<void> {
  const message = [
    `🚨 *${escapeMarkdown(payload.alertName)}*`,
    '',
    getDescriptionForConditionType(payload.conditionType),
    '',
    `*Condition:* ${formatConditionType(payload.conditionType)}`,
    `*Event Type:* ${payload.eventType || 'N/A'}`,
    ...(payload.transactionHash
      ? [`*Transaction:* \`${truncateHash(payload.transactionHash)}\``]
      : []),
    '',
    `[View in MoveWatch](${payload.link})`,
  ].join('\n');

  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: message,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: false,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(`Telegram API failed: ${(data as { description?: string }).description || response.status}`);
  }
}

/**
 * Send custom webhook notification
 * SECURITY: Validates webhook URL for SSRF before sending
 */
async function sendWebhookNotification(
  config: WebhookChannelConfig,
  payload: NotificationPayload
): Promise<void> {
  // SSRF Protection: Validate webhook URL
  const validation = await validateWebhookUrl(config.url);
  if (!validation.valid) {
    throw new Error(`SSRF Protection: ${validation.error}`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add custom auth header if configured
  if (config.authHeader && config.authValue) {
    headers[config.authHeader] = config.authValue;
  }

  // Use safeFetch which handles redirects securely
  const response = await safeFetchWithTimeout(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      alertId: payload.alertId,
      alertName: payload.alertName,
      conditionType: payload.conditionType,
      eventType: payload.eventType,
      eventData: payload.eventData,
      transactionHash: payload.transactionHash,
      timestamp: payload.timestamp,
      link: payload.link,
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status}`);
  }
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  config: EmailChannelConfig,
  payload: NotificationPayload
): Promise<void> {
  const html = renderAlertEmail(payload);
  const text = renderAlertEmailText(payload);

  const result = await sendEmail({
    to: config.email,
    subject: `[MoveWatch] ${payload.alertName} - ${formatConditionType(payload.conditionType)}`,
    html,
    text,
  });

  if (!result.success) {
    throw new Error(`Email notification failed: ${result.error}`);
  }
}

/**
 * Execute an action as notification channel
 *
 * This enables the powerful Alert → Action integration:
 * - Alert triggers (event, balance, gas spike, etc.) can execute serverless actions
 * - Alert event data is passed to the action's triggerData
 * - Action can react to the alert (send notifications, execute transactions, etc.)
 */
async function sendActionNotification(
  config: ActionChannelConfig,
  payload: NotificationPayload
): Promise<void> {
  const { actionId, passAlertData = true } = config;

  // Fetch the action from database
  const action = await prisma.action.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    throw new Error(`Action not found: ${actionId}`);
  }

  if (!action.enabled) {
    throw new Error(`Action is disabled: ${action.name}`);
  }

  // Get decrypted secrets for the action
  const secrets = await getDecryptedSecrets(actionId);

  // Build execution context with alert data
  const executionId = `alert-${payload.alertId}-${Date.now()}`;
  const context = {
    actionId: action.id,
    executionId,
    network: (action.network || 'mainnet') as Network,
    triggerType: 'event' as const, // Alert triggers are treated as event triggers
    triggerData: passAlertData
      ? {
          // Alert metadata
          alertId: payload.alertId,
          alertName: payload.alertName,
          conditionType: payload.conditionType,
          eventType: payload.eventType,
          timestamp: payload.timestamp,
          link: payload.link,
          // Original event data from the alert
          eventData: payload.eventData,
          transactionHash: payload.transactionHash,
          // Error info if available
          errorInfo: payload.errorInfo,
          // Mark this as triggered by alert
          source: 'alert',
        }
      : {
          alertId: payload.alertId,
          alertName: payload.alertName,
          source: 'alert',
        },
    secrets,
  };

  console.log(
    `[ActionNotification] Executing action "${action.name}" (${actionId}) ` +
      `triggered by alert "${payload.alertName}" (${payload.alertId})`
  );

  // Execute the action
  const result = await executeAction(action.code, context, {
    memoryLimitMb: action.memoryLimitMb || 128,
    timeoutMs: action.maxExecutionMs || 30000,
  });

  // Log execution in database
  await prisma.actionExecution.create({
    data: {
      id: executionId,
      actionId: action.id,
      status: result.success ? 'SUCCESS' : 'FAILED',
      triggerData: context.triggerData as object,
      result: result.result as object | undefined,
      logs: result.logs,
      error: result.error ? { message: result.error.message, stack: result.error.stack } : undefined,
      durationMs: result.durationMs,
      memoryUsedMb: result.memoryUsedMb,
    },
  });

  if (!result.success) {
    throw new Error(
      `Action execution failed: ${result.error?.message || 'Unknown error'}`
    );
  }

  console.log(
    `[ActionNotification] Action "${action.name}" completed successfully ` +
      `in ${result.durationMs}ms`
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch with timeout support (for known-safe URLs like Discord, Slack, Telegram)
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Safe fetch with timeout and SSRF protection
 * Uses safeFetch from ssrfProtection module for URL validation
 */
async function safeFetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // safeFetch validates URL for SSRF and handles redirects securely
    const response = await safeFetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get Discord embed color based on condition type
 */
function getColorForConditionType(type: string): number {
  const colors: Record<string, number> = {
    tx_failed: 0xff5555,         // Red - errors/failures
    balance_threshold: 0xffaa00,  // Orange - warnings
    event_emitted: 0x55ff55,      // Green - info
    gas_spike: 0xff55ff,          // Purple - performance
    function_call: 0x5555ff,      // Blue - activity
    token_transfer: 0x00ffaa,     // Cyan - transfers
    large_transaction: 0xffff55,  // Yellow - high value
  };
  return colors[type] || 0x5555ff; // Default blue
}

/**
 * Get human-readable description for condition type
 */
function getDescriptionForConditionType(type: string): string {
  const descriptions: Record<string, string> = {
    tx_failed: 'A monitored transaction has failed on the network.',
    balance_threshold: 'An account balance has crossed the configured threshold.',
    event_emitted: 'A monitored event has been emitted on-chain.',
    gas_spike: 'Gas usage has exceeded the normal range.',
    function_call: 'A specific function was called on a monitored contract.',
    token_transfer: 'A token transfer was detected to or from a monitored address.',
    large_transaction: 'A high-value transaction was detected on the network.',
  };
  return descriptions[type] || 'An alert condition was triggered.';
}

/**
 * Format condition type for display
 */
function formatConditionType(type: string): string {
  const formats: Record<string, string> = {
    tx_failed: 'Transaction Failed',
    balance_threshold: 'Balance Threshold',
    event_emitted: 'Event Emitted',
    gas_spike: 'Gas Spike',
    function_call: 'Function Call',
    token_transfer: 'Token Transfer',
    large_transaction: 'Large Transaction',
  };
  return formats[type] || type;
}

/**
 * Truncate transaction hash for display
 */
function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

/**
 * Escape special characters for Telegram MarkdownV2
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
