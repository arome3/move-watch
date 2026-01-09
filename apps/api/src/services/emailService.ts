/**
 * Email Service - Sends emails via Resend API
 *
 * Uses the Resend HTTP API for sending emails.
 * Requires RESEND_API_KEY environment variable.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'MoveWatch <noreply@movewatch.io>';
const REQUEST_TIMEOUT = 10000; // 10 seconds

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  latencyMs?: number;
}

/**
 * Send an email via Resend
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const startTime = Date.now();

  // Check if API key is configured
  if (!apiKey) {
    console.warn('RESEND_API_KEY not configured, email will not be sent');
    return {
      success: false,
      error: 'Email service not configured (missing RESEND_API_KEY)',
      latencyMs: Date.now() - startTime,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || process.env.EMAIL_FROM || DEFAULT_FROM,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as { message?: string }).message || `HTTP ${response.status}`;
      console.error('Resend API error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        latencyMs,
      };
    }

    const data = await response.json() as { id?: string };
    return {
      success: true,
      messageId: data.id,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Email request timed out',
          latencyMs,
        };
      }
      return {
        success: false,
        error: error.message,
        latencyMs,
      };
    }

    return {
      success: false,
      error: 'Unknown error occurred',
      latencyMs,
    };
  }
}

/**
 * Send a test email to verify configuration
 */
export async function sendTestEmail(to: string): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: '[MoveWatch] Test Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">MoveWatch Test Email</h2>
        <p>This is a test email from MoveWatch to verify your email notification settings.</p>
        <p>If you received this email, your notifications are configured correctly!</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">
          This email was sent from MoveWatch. If you did not request this, please ignore it.
        </p>
      </div>
    `,
    text: 'This is a test email from MoveWatch to verify your email notification settings.',
  });
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
