import { getSession } from 'next-auth/react';
import type {
  NotificationChannelResponse,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
  ChannelType,
} from '@movewatch/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get authentication headers for API requests
 * Uses the JWT accessToken from NextAuth session
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();

  if (session?.accessToken) {
    return {
      Authorization: `Bearer ${session.accessToken}`,
    };
  }

  return {};
}

async function fetchWithError<T>(url: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.error?.message || error.message || 'Request failed');
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============================================================================
// CHANNEL API FUNCTIONS
// ============================================================================

/**
 * Get all notification channels
 */
export async function getChannels(): Promise<{
  channels: NotificationChannelResponse[];
  total: number;
}> {
  return fetchWithError(`${API_BASE}/v1/channels`);
}

/**
 * Get a specific channel by ID
 */
export async function getChannel(id: string): Promise<NotificationChannelResponse & {
  alerts: Array<{
    id: string;
    name: string;
    enabled: boolean;
    channelEnabled: boolean;
  }>;
}> {
  return fetchWithError(`${API_BASE}/v1/channels/${id}`);
}

/**
 * Create a new notification channel
 */
export async function createChannel(
  request: CreateNotificationChannelRequest
): Promise<NotificationChannelResponse> {
  return fetchWithError(`${API_BASE}/v1/channels`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Update an existing channel
 */
export async function updateChannel(
  id: string,
  request: UpdateNotificationChannelRequest
): Promise<NotificationChannelResponse> {
  return fetchWithError(`${API_BASE}/v1/channels/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

/**
 * Delete a channel
 * @param id - Channel ID
 * @param force - If true, delete even if channel is used by alerts
 */
export async function deleteChannel(id: string, force?: boolean): Promise<void> {
  const url = force ? `${API_BASE}/v1/channels/${id}?force=true` : `${API_BASE}/v1/channels/${id}`;
  return fetchWithError(url, {
    method: 'DELETE',
  });
}

/**
 * Test a channel by sending a test notification
 */
export async function testChannel(id: string): Promise<{
  success: boolean;
  latencyMs?: number;
  error?: string;
}> {
  return fetchWithError(`${API_BASE}/v1/channels/${id}/test`, {
    method: 'POST',
  });
}

// ============================================================================
// HELPER TYPES & FUNCTIONS
// ============================================================================

/**
 * Channel type display names
 */
export const channelTypeLabels: Record<ChannelType, string> = {
  discord: 'Discord',
  slack: 'Slack',
  telegram: 'Telegram',
  webhook: 'Webhook',
  email: 'Email',
  action: 'Action',
};

/**
 * Channel type icons (emoji for now, can be replaced with SVG)
 */
export const channelTypeIcons: Record<ChannelType, string> = {
  discord: '\u{1F3AE}', // 🎮
  slack: '\u{1F4AC}', // 💬
  telegram: '\u{2708}', // ✈
  webhook: '\u{1F517}', // 🔗
  email: '\u{2709}', // ✉
  action: '\u{26A1}', // ⚡
};
