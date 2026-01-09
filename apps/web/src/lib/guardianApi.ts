import type {
  GuardianCheckRequest,
  GuardianCheckResponse,
  DemoTransaction,
  RiskPattern,
} from '@movewatch/shared';
import { x402Fetch } from './x402Client';
import { usePaymentStore } from '@/stores/payment';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Analyze a transaction for security risks using Guardian
 *
 * Uses x402 protocol - triggers payment modal if free quota exceeded.
 * Pricing: 0.005 MOVE per request (5 free/day)
 */
export async function analyzeTransaction(
  request: GuardianCheckRequest
): Promise<GuardianCheckResponse> {
  const { openPaymentModal } = usePaymentStore.getState();

  const result = await x402Fetch<GuardianCheckResponse>('/v1/guardian/check', {
    method: 'POST',
    body: JSON.stringify(request),
    onPaymentRequired: async (details) => {
      // Trigger payment modal and wait for user to complete or cancel
      return openPaymentModal(details);
    },
  });

  if (result.error) {
    throw new Error(result.error.message || 'Guardian analysis failed');
  }

  return result.data!;
}

/**
 * Get a shared Guardian analysis by share ID
 */
export async function getSharedGuardianCheck(
  shareId: string
): Promise<GuardianCheckResponse | null> {
  const response = await fetch(`${API_URL}/v1/guardian/check/${shareId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message || 'Failed to fetch Guardian analysis');
  }

  return response.json();
}

/**
 * Get demo transactions for testing Guardian
 */
export async function getDemoTransactions(): Promise<DemoTransaction[]> {
  const response = await fetch(`${API_URL}/v1/guardian/demo`);

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message || 'Failed to fetch demo transactions');
  }

  const data = await response.json();
  return data.transactions;
}

/**
 * Get all available risk detection patterns
 */
export async function getPatterns(): Promise<{
  patterns: RiskPattern[];
  stats: {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}> {
  const response = await fetch(`${API_URL}/v1/guardian/patterns`);

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message || 'Failed to fetch patterns');
  }

  return response.json();
}

/**
 * Hook-friendly wrapper to load Guardian data
 */
export async function loadGuardianData(): Promise<{
  demoTransactions: DemoTransaction[];
  patterns: RiskPattern[];
}> {
  const [demosResponse, patternsResponse] = await Promise.all([
    getDemoTransactions(),
    getPatterns(),
  ]);

  return {
    demoTransactions: demosResponse,
    patterns: patternsResponse.patterns,
  };
}
