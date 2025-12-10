import {
  type ChannelConfig,
  type ChannelType,
  type NotificationPayload,
  type TestNotificationResult,
  type DiscordChannelConfig,
  type SlackChannelConfig,
  type TelegramChannelConfig,
  type WebhookChannelConfig,
} from '@movewatch/shared';

// Timeout for HTTP requests (10 seconds)
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Send notifications to all configured channels
 */
export async function sendNotifications(
  channels: Array<{ type: string; config: unknown; enabled: boolean }>,
  payload: NotificationPayload
): Promise<Array<{ channel: string; success: boolean; error?: string }>> {
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
 */
async function sendToChannel(
  type: ChannelType,
  config: unknown,
  payload: NotificationPayload
): Promise<void> {
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
    default:
      throw new Error(`Unsupported channel type: ${type}`);
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
 */
async function sendWebhookNotification(
  config: WebhookChannelConfig,
  payload: NotificationPayload
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add custom auth header if configured
  if (config.authHeader && config.authValue) {
    headers[config.authHeader] = config.authValue;
  }

  const response = await fetchWithTimeout(config.url, {
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch with timeout support
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
 * Get Discord embed color based on condition type
 */
function getColorForConditionType(type: string): number {
  const colors: Record<string, number> = {
    tx_failed: 0xff5555, // Red
    balance_threshold: 0xffaa00, // Orange
    event_emitted: 0x55ff55, // Green
    gas_spike: 0xff55ff, // Purple
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
