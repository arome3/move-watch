import type { SimulationRequest, SimulationResponse, SharedSimulation, ApiError } from '@movewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Simulate a transaction
 */
export async function simulateTransaction(
  request: SimulationRequest
): Promise<SimulationResponse> {
  const response = await fetch(`${API_URL}/v1/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    throw new Error(error.message || 'Simulation failed');
  }

  return data as SimulationResponse;
}

/**
 * Get a shared simulation by ID
 */
export async function getSharedSimulation(
  shareId: string
): Promise<SharedSimulation | null> {
  const response = await fetch(`${API_URL}/v1/sim/${shareId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const data = await response.json();
    const error = data.error as ApiError;
    throw new Error(error.message || 'Failed to fetch simulation');
  }

  return response.json();
}

/**
 * Check API health
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
