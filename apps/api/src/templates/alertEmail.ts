import type { NotificationPayload, AlertConditionType } from '@movewatch/shared';

/**
 * Get color based on condition type
 */
function getColorForConditionType(type: AlertConditionType): string {
  switch (type) {
    case 'tx_failed':
      return '#ef4444'; // Red
    case 'balance_threshold':
      return '#f97316'; // Orange
    case 'event_emitted':
      return '#22c55e'; // Green
    case 'gas_spike':
      return '#eab308'; // Yellow
    default:
      return '#3b82f6'; // Blue
  }
}

/**
 * Get human-readable description for condition type
 */
function getDescriptionForConditionType(type: AlertConditionType): string {
  switch (type) {
    case 'tx_failed':
      return 'Transaction Failed';
    case 'balance_threshold':
      return 'Balance Threshold Crossed';
    case 'event_emitted':
      return 'Event Emitted';
    case 'gas_spike':
      return 'Gas Spike Detected';
    default:
      return 'Alert Triggered';
  }
}

/**
 * Truncate a hash for display
 */
function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

/**
 * Format event data as readable HTML
 */
function formatEventData(data: unknown): string {
  try {
    const formatted = JSON.stringify(data, null, 2);
    return `<pre style="background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px;">${escapeHtml(formatted)}</pre>`;
  } catch {
    return '<p style="color: #94a3b8;">Unable to format event data</p>';
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render alert notification email HTML
 */
export function renderAlertEmail(payload: NotificationPayload): string {
  const color = getColorForConditionType(payload.conditionType);
  const description = getDescriptionForConditionType(payload.conditionType);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(payload.alertName)} - MoveWatch Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${color}22, ${color}11); padding: 24px 32px; border-left: 4px solid ${color};">
              <h1 style="margin: 0; color: #f8fafc; font-size: 20px; font-weight: 600;">
                ${escapeHtml(payload.alertName)}
              </h1>
              <p style="margin: 8px 0 0; color: ${color}; font-size: 14px; font-weight: 500;">
                ${description}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 24px 32px;">
              <!-- Event Type -->
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 6px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Event Type
                </p>
                <p style="margin: 0; color: #f1f5f9; font-size: 14px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;">
                  ${escapeHtml(payload.eventType)}
                </p>
              </div>

              <!-- Transaction Hash (if available) -->
              ${payload.transactionHash ? `
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 6px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Transaction
                </p>
                <p style="margin: 0; color: #f1f5f9; font-size: 14px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;">
                  ${truncateHash(payload.transactionHash)}
                </p>
              </div>
              ` : ''}

              <!-- Timestamp -->
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 6px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Triggered At
                </p>
                <p style="margin: 0; color: #f1f5f9; font-size: 14px;">
                  ${new Date(payload.timestamp).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'long',
                    timeZone: 'UTC'
                  })} UTC
                </p>
              </div>

              <!-- Event Data -->
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 6px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Event Data
                </p>
                ${formatEventData(payload.eventData)}
              </div>

              <!-- CTA Button -->
              <div style="margin-top: 24px;">
                <a href="${escapeHtml(payload.link)}" style="display: inline-block; background-color: ${color}; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
                  View in MoveWatch
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; border-top: 1px solid #334155;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                This alert was sent by <a href="https://movewatch.io" style="color: #3b82f6; text-decoration: none;">MoveWatch</a>.
                <br>
                You can manage your alerts in your <a href="https://movewatch.io/alerts" style="color: #3b82f6; text-decoration: none;">dashboard</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Render plain text version of alert email
 */
export function renderAlertEmailText(payload: NotificationPayload): string {
  const description = getDescriptionForConditionType(payload.conditionType);

  return `
${payload.alertName}
${description}

Event Type: ${payload.eventType}
${payload.transactionHash ? `Transaction: ${payload.transactionHash}` : ''}
Triggered: ${new Date(payload.timestamp).toISOString()}

Event Data:
${JSON.stringify(payload.eventData, null, 2)}

View in MoveWatch: ${payload.link}

---
This alert was sent by MoveWatch (https://movewatch.io)
  `.trim();
}
