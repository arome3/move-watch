import { getSession } from 'next-auth/react';
import type {
  Network,
  DashboardPeriod,
  DashboardStats,
  TransactionDetail,
  GasAnalytics,
  WatchedContractResponse,
  CreateWatchedContractRequest,
  PaginatedTransactionsResponse,
  PaginatedEventsResponse,
  TransactionFilterOptions,
  EventFilterOptions,
} from '@movewatch/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
 * Base fetch function with error handling and authentication
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}/v1/monitoring${endpoint}`;
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
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Build query string from options object
 */
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// ============================================================================
// DASHBOARD STATISTICS
// ============================================================================

/**
 * Fetch dashboard statistics
 */
export async function fetchDashboardStats(
  period: DashboardPeriod = '24h',
  network: Network = 'testnet',
  moduleAddress?: string,
  sender?: string
): Promise<DashboardStats> {
  const query = buildQueryString({ period, network, moduleAddress, sender });
  return fetchApi<DashboardStats>(`/stats${query}`);
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

/**
 * Fetch transactions with filtering and pagination
 */
export async function fetchTransactions(
  network: Network = 'testnet',
  options: TransactionFilterOptions & { sender?: string } = {}
): Promise<PaginatedTransactionsResponse> {
  const query = buildQueryString({ network, ...options });
  return fetchApi<PaginatedTransactionsResponse>(`/transactions${query}`);
}

/**
 * Fetch transaction detail by hash
 */
export async function fetchTransactionDetail(
  hash: string,
  network: Network = 'testnet'
): Promise<TransactionDetail | null> {
  try {
    const query = buildQueryString({ network });
    return await fetchApi<TransactionDetail>(`/transactions/${hash}${query}`);
  } catch (error: any) {
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      return null;
    }
    throw error;
  }
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Fetch events with filtering and pagination
 */
export async function fetchEvents(
  network: Network = 'testnet',
  options: EventFilterOptions & { sender?: string } = {}
): Promise<PaginatedEventsResponse> {
  const query = buildQueryString({ network, ...options });
  return fetchApi<PaginatedEventsResponse>(`/events${query}`);
}

// ============================================================================
// GAS ANALYTICS
// ============================================================================

/**
 * Fetch gas analytics data
 */
export async function fetchGasAnalytics(
  period: DashboardPeriod = '24h',
  network: Network = 'testnet',
  moduleAddress?: string,
  sender?: string
): Promise<GasAnalytics> {
  const query = buildQueryString({ period, network, moduleAddress, sender });
  return fetchApi<GasAnalytics>(`/gas${query}`);
}

// ============================================================================
// WATCHED CONTRACTS
// ============================================================================

/**
 * Fetch user's watched contracts
 */
export async function fetchWatchedContracts(): Promise<WatchedContractResponse[]> {
  const response = await fetchApi<{ contracts: WatchedContractResponse[] }>('/contracts');
  return response.contracts;
}

/**
 * Add a watched contract
 */
export async function addWatchedContract(
  data: CreateWatchedContractRequest
): Promise<WatchedContractResponse> {
  return fetchApi<WatchedContractResponse>('/contracts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Remove a watched contract
 */
export async function removeWatchedContract(id: string): Promise<void> {
  await fetchApi(`/contracts/${id}`, {
    method: 'DELETE',
  });
}
