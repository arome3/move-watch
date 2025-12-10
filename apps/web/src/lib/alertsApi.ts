import type {
  CreateAlertRequest,
  UpdateAlertRequest,
  AlertResponse,
  AlertTriggersResponse,
  TestNotificationResult,
  ApiError,
} from '@movewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Fetch all alerts for the current user
 */
export async function fetchAlerts(): Promise<AlertResponse[]> {
  const response = await fetch(`${API_URL}/v1/alerts`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to fetch alerts');
  }

  return data.alerts as AlertResponse[];
}

/**
 * Get a single alert by ID
 */
export async function getAlert(id: string): Promise<AlertResponse | null> {
  const response = await fetch(`${API_URL}/v1/alerts/${id}`, {
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
    throw new Error(error.message || 'Failed to fetch alert');
  }

  return data as AlertResponse;
}

/**
 * Create a new alert
 */
export async function createAlert(
  request: CreateAlertRequest
): Promise<AlertResponse> {
  const response = await fetch(`${API_URL}/v1/alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to create alert');
  }

  return data as AlertResponse;
}

/**
 * Update an existing alert
 */
export async function updateAlert(
  id: string,
  updates: UpdateAlertRequest
): Promise<AlertResponse> {
  const response = await fetch(`${API_URL}/v1/alerts/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to update alert');
  }

  return data as AlertResponse;
}

/**
 * Delete an alert
 */
export async function deleteAlert(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/alerts/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok && response.status !== 204) {
    const data = await response.json();
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to delete alert');
  }
}

/**
 * Toggle alert enabled/disabled
 */
export async function toggleAlert(
  id: string,
  enabled: boolean
): Promise<AlertResponse> {
  return updateAlert(id, { enabled });
}

/**
 * Test alert notifications
 */
export async function testAlert(id: string): Promise<TestNotificationResult[]> {
  const response = await fetch(`${API_URL}/v1/alerts/${id}/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to test alert');
  }

  return data.results as TestNotificationResult[];
}

/**
 * Get trigger history for an alert
 */
export async function getAlertTriggers(
  id: string,
  limit: number = 10,
  offset: number = 0
): Promise<AlertTriggersResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${API_URL}/v1/alerts/${id}/triggers?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to fetch triggers');
  }

  return data as AlertTriggersResponse;
}
