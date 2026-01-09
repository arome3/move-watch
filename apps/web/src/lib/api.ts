import type { SimulationRequest, SimulationResponse, SharedSimulation, ApiError } from '@movewatch/shared';
import { x402Fetch } from './x402Client';
import { usePaymentStore } from '@/stores/payment';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Simulate a transaction
 *
 * Uses x402 protocol - triggers payment modal if free quota exceeded.
 * Pricing: 0.001 MOVE per request (10 free/day)
 */
export async function simulateTransaction(
  request: SimulationRequest
): Promise<SimulationResponse> {
  const { openPaymentModal } = usePaymentStore.getState();

  const result = await x402Fetch<SimulationResponse>('/v1/simulate', {
    method: 'POST',
    body: JSON.stringify(request),
    onPaymentRequired: async (details) => {
      // Trigger payment modal and wait for user to complete or cancel
      return openPaymentModal(details);
    },
  });

  if (result.error) {
    throw new Error(result.error.message || 'Simulation failed');
  }

  return result.data!;
}

/**
 * Get a shared simulation by ID
 */
export async function getSharedSimulation(
  shareId: string
): Promise<SharedSimulation | null> {
  try {
    const response = await fetch(`${API_URL}/v1/simulate/sim/${shareId}`, {
      cache: 'no-store',  // Disable Next.js caching for real-time data
      next: { revalidate: 0 },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const data = await response.json();
      const error = data.error as ApiError;
      console.error('[API] getSharedSimulation error:', error);
      throw new Error(error.message || 'Failed to fetch simulation');
    }

    return response.json();
  } catch (error) {
    console.error('[API] getSharedSimulation fetch failed:', error);
    return null;
  }
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

// ============================================================================
// MODULE ABI API
// ============================================================================

export interface PopularModule {
  address: string;
  name: string;
  description: string;
}

export interface ModuleSearchResult {
  address: string;
  name: string;
  description?: string;
}

export interface FunctionInfo {
  name: string;
  fullPath: string;
  visibility: string;
  isEntry: boolean;
  isView: boolean;
  typeParameters: number;
  typeParameterConstraints: string[][];
  parameters: ParsedParameter[];
  returnTypes: string[];
  signature: string;
  description?: string;
}

export interface ParsedParameter {
  index: number;
  type: string;
  baseType: string;
  isGeneric: boolean;
  isReference: boolean;
  isMutable: boolean;
  isSigner: boolean;
  genericIndex?: number;
  innerTypes?: string[];
  description?: string;
}

export interface ArgumentField {
  index: number;
  name: string;
  type: string;
  inputType: 'text' | 'number' | 'boolean' | 'address' | 'array' | 'object';
  placeholder: string;
  description: string;
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

/**
 * Get popular/common modules for quick selection
 */
export async function getPopularModules(): Promise<PopularModule[]> {
  try {
    const response = await fetch(`${API_URL}/v1/modules/popular`);
    if (!response.ok) throw new Error('Failed to fetch popular modules');
    const data = await response.json();
    return data.modules;
  } catch (error) {
    console.error('[API] getPopularModules error:', error);
    return [];
  }
}

/**
 * Search for modules by name or address
 */
export async function searchModules(
  network: string,
  query: string,
  limit: number = 10
): Promise<ModuleSearchResult[]> {
  try {
    const params = new URLSearchParams({ network, q: query, limit: String(limit) });
    const response = await fetch(`${API_URL}/v1/modules/search?${params}`);
    if (!response.ok) throw new Error('Failed to search modules');
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('[API] searchModules error:', error);
    return [];
  }
}

/**
 * List all modules for an account
 */
export async function listAccountModules(
  network: string,
  address: string
): Promise<string[]> {
  try {
    const params = new URLSearchParams({ network });
    const response = await fetch(`${API_URL}/v1/modules/${address}?${params}`);
    if (!response.ok) throw new Error('Failed to list modules');
    const data = await response.json();
    return data.modules;
  } catch (error) {
    console.error('[API] listAccountModules error:', error);
    return [];
  }
}

/**
 * Get callable functions from a module
 */
export async function getModuleFunctions(
  network: string,
  address: string,
  moduleName: string,
  filter: 'entry' | 'view' | 'public' | 'all' = 'entry'
): Promise<FunctionInfo[]> {
  try {
    const params = new URLSearchParams({ network, filter });
    const response = await fetch(`${API_URL}/v1/modules/${address}/${moduleName}/functions?${params}`);
    if (!response.ok) throw new Error('Failed to fetch module functions');
    const data = await response.json();
    return data.functions;
  } catch (error) {
    console.error('[API] getModuleFunctions error:', error);
    return [];
  }
}

/**
 * Get function details with argument fields
 */
export async function getFunctionDetails(
  network: string,
  address: string,
  moduleName: string,
  functionName: string
): Promise<{ function: FunctionInfo; argumentFields: ArgumentField[] } | null> {
  try {
    const params = new URLSearchParams({ network });
    const response = await fetch(
      `${API_URL}/v1/modules/${address}/${moduleName}/functions/${functionName}?${params}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return {
      function: data.function,
      argumentFields: data.argumentFields,
    };
  } catch (error) {
    console.error('[API] getFunctionDetails error:', error);
    return null;
  }
}

// ============================================================================
// MOVEMENT FAUCET
// ============================================================================

const FAUCET_URLS: Record<string, string> = {
  testnet: 'https://faucet.testnet.movementnetwork.xyz',
  devnet: 'https://faucet.devnet.movementnetwork.xyz',
};

export interface FaucetResult {
  success: boolean;
  message: string;
  txHash?: string;
}

/**
 * Request testnet/devnet MOVE tokens from the Movement faucet
 */
export async function requestFaucet(
  network: string,
  address: string,
  amount: number = 100000000 // Default 1 MOVE (8 decimals)
): Promise<FaucetResult> {
  const faucetUrl = FAUCET_URLS[network];

  if (!faucetUrl) {
    return {
      success: false,
      message: `Faucet not available for ${network}. Only testnet and devnet are supported.`,
    };
  }

  if (!address.match(/^0x[a-fA-F0-9]{1,64}$/)) {
    return {
      success: false,
      message: 'Invalid address format',
    };
  }

  try {
    const response = await fetch(`${faucetUrl}/mint?address=${address}&amount=${amount}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `Faucet request failed: ${errorText || response.statusText}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      message: `Successfully funded ${amount / 100000000} MOVE to ${address.slice(0, 10)}...`,
      txHash: data.txn_hashes?.[0] || data.hash,
    };
  } catch (error) {
    console.error('[API] requestFaucet error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Faucet request failed',
    };
  }
}
