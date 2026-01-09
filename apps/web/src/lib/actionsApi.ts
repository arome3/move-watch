import { getSession } from 'next-auth/react';
import type {
  CreateActionRequest,
  UpdateActionRequest,
  ActionResponse,
  ActionListItem,
  ActionExecutionsResponse,
  TestActionResult,
  ActionSecretResponse,
  SetSecretRequest,
  ApiError,
  ActionTriggerType,
} from '@movewatch/shared';

// Re-export types used by other components
export type { ActionListItem };
import { x402Fetch } from './x402Client';
import { usePaymentStore } from '@/stores/payment';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export interface ActionTemplateSecret {
  name: string;
  description: string;
}

export interface ActionTemplateSummary {
  id: string;
  name: string;
  description: string;
  category: 'defi' | 'security' | 'monitoring' | 'nft' | 'utility';
  triggerType: ActionTriggerType;
  network: 'mainnet' | 'testnet' | 'both';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  requiredSecrets: ActionTemplateSecret[];
}

export interface ActionTemplate extends ActionTemplateSummary {
  triggerConfig: Record<string, unknown>;
  code: string;
}

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

/**
 * Fetch all actions for the current user (list view, without code)
 */
export async function fetchActions(): Promise<ActionListItem[]> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/v1/actions`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to fetch actions');
  }

  return data.actions as ActionListItem[];
}

/**
 * Get a single action by ID (full details including code)
 */
export async function getAction(id: string): Promise<ActionResponse | null> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/v1/actions/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });

  if (response.status === 404) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to fetch action');
  }

  return data as ActionResponse;
}

/**
 * Create a new action
 */
export async function createAction(
  request: CreateActionRequest
): Promise<ActionResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/v1/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to create action');
  }

  return data as ActionResponse;
}

/**
 * Update an existing action
 */
export async function updateAction(
  id: string,
  updates: UpdateActionRequest
): Promise<ActionResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/v1/actions/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(updates),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to update action');
  }

  return data as ActionResponse;
}

/**
 * Delete an action
 */
export async function deleteAction(id: string): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/v1/actions/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });

  if (!response.ok && response.status !== 204) {
    const data = await response.json();
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to delete action');
  }
}

/**
 * Toggle action enabled/disabled
 */
export async function toggleAction(
  id: string,
  enabled: boolean
): Promise<ActionResponse> {
  return updateAction(id, { enabled });
}

/**
 * Test an action with sample trigger data
 *
 * Uses x402 protocol - triggers payment modal if free quota exceeded.
 * Pricing: 0.01 MOVE per test (5 free/day)
 */
export async function testAction(
  id: string,
  triggerData?: unknown
): Promise<TestActionResult> {
  const authHeaders = await getAuthHeaders();

  // Direct fetch instead of x402Fetch to simplify (payments are disabled)
  const response = await fetch(`${API_URL}/v1/actions/${id}/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ triggerData }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to test action');
  }

  // Normalize the response to match expected type
  // API may return error as object {message, stack} - extract just the message
  const errorMessage = data.error
    ? (typeof data.error === 'string' ? data.error : data.error.message || String(data.error))
    : undefined;

  return {
    executionId: data.executionId,
    status: data.status?.toLowerCase() as 'success' | 'failed' | 'timeout',
    duration: data.duration ?? 0,
    output: data.output,
    logs: data.logs ?? [],
    error: errorMessage,
  };
}

/**
 * Get execution history for an action
 */
export async function getExecutions(
  id: string,
  limit: number = 10,
  offset: number = 0
): Promise<ActionExecutionsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/v1/actions/${id}/executions?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to fetch executions');
  }

  return data as ActionExecutionsResponse;
}

/**
 * Get secrets for an action (names only)
 */
export async function getSecrets(id: string): Promise<ActionSecretResponse[]> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/v1/actions/${id}/secrets`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to fetch secrets');
  }

  return data.secrets as ActionSecretResponse[];
}

/**
 * Set a secret for an action
 */
export async function setSecret(
  actionId: string,
  request: SetSecretRequest
): Promise<ActionSecretResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/v1/actions/${actionId}/secrets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to set secret');
  }

  return data as ActionSecretResponse;
}

/**
 * Delete a secret
 */
export async function deleteSecret(actionId: string, name: string): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${API_URL}/v1/actions/${actionId}/secrets/${encodeURIComponent(name)}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    }
  );

  if (!response.ok && response.status !== 204) {
    const data = await response.json();
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to delete secret');
  }
}

// ============================================================================
// TEMPLATE API
// ============================================================================

/**
 * Fetch all available action templates
 * No authentication required
 */
export async function fetchTemplates(filters?: {
  category?: string;
  difficulty?: string;
  network?: string;
}): Promise<ActionTemplateSummary[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.difficulty) params.set('difficulty', filters.difficulty);
  if (filters?.network) params.set('network', filters.network);

  const queryString = params.toString();
  const url = `${API_URL}/v1/actions/templates${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to fetch templates');
  }

  return data.templates as ActionTemplateSummary[];
}

/**
 * Get a single template with full code
 * No authentication required
 */
export async function getTemplate(id: string): Promise<ActionTemplate | null> {
  const response = await fetch(`${API_URL}/v1/actions/templates/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 404) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to fetch template');
  }

  return data as ActionTemplate;
}
