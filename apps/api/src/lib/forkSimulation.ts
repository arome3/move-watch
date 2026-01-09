/**
 * Fork Simulation Service
 * Provides mainnet forking capabilities for transaction simulation
 *
 * Features:
 * - Historical state simulation (at specific ledger version)
 * - State overrides for testing scenarios (via CLI simulation sessions)
 * - Cross-network queries
 */
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import type { ForkMetadata, StateOverride, Network as MoveNetwork } from '@movewatch/shared';
import { NETWORK_CONFIGS } from '@movewatch/shared';
import {
  checkSimulationSessionSupport,
  createSession,
  applyStateOverrides as applySessionOverrides,
  runSessionSimulation,
  destroySession,
  runSimulationWithOverrides,
  type SimulationSession,
  type SessionSimulationResult,
} from './simulationSession';

/**
 * Get ledger info for a network
 */
export async function getLedgerInfo(network: MoveNetwork): Promise<{
  chainId: number;
  epoch: string;
  ledgerVersion: string;
  oldestLedgerVersion: string;
  ledgerTimestamp: string;
  nodeRole: string;
  oldestBlockHeight: string;
  blockHeight: string;
  gitHash: string;
}> {
  const { fullnode } = NETWORK_CONFIGS[network];

  const response = await fetch(fullnode);
  if (!response.ok) {
    throw new Error(`Failed to fetch ledger info: ${response.statusText}`);
  }

  return response.json() as Promise<{
    chainId: number;
    epoch: string;
    ledgerVersion: string;
    oldestLedgerVersion: string;
    ledgerTimestamp: string;
    nodeRole: string;
    oldestBlockHeight: string;
    blockHeight: string;
    gitHash: string;
  }>;
}

/**
 * Check if a ledger version is available (not pruned)
 */
export async function isVersionAvailable(
  network: MoveNetwork,
  version: string
): Promise<{ available: boolean; oldestVersion: string; currentVersion: string }> {
  const ledgerInfo = await getLedgerInfo(network);
  const requestedVersion = BigInt(version);
  const oldestVersion = BigInt(ledgerInfo.oldestLedgerVersion);
  const currentVersion = BigInt(ledgerInfo.ledgerVersion);

  return {
    available: requestedVersion >= oldestVersion && requestedVersion <= currentVersion,
    oldestVersion: ledgerInfo.oldestLedgerVersion,
    currentVersion: ledgerInfo.ledgerVersion,
  };
}

/**
 * Get account resource at a specific ledger version
 */
export async function getAccountResourceAtVersion(
  network: MoveNetwork,
  address: string,
  resourceType: string,
  version?: string
): Promise<{ data: unknown; version: string } | null> {
  const { fullnode } = NETWORK_CONFIGS[network];

  // Normalize address
  const normalizedAddress = address.startsWith('0x')
    ? '0x' + address.slice(2).padStart(64, '0')
    : '0x' + address.padStart(64, '0');

  // Build URL with optional version
  let url = `${fullnode}/accounts/${normalizedAddress}/resource/${encodeURIComponent(resourceType)}`;
  if (version) {
    url += `?ledger_version=${version}`;
  }

  try {
    const response = await fetch(url);
    if (response.status === 404) {
      return null;
    }
    if (response.status === 410) {
      throw new Error(`Ledger version ${version} has been pruned and is no longer available`);
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch resource: ${response.statusText}`);
    }

    const data = await response.json() as { data: unknown };
    return {
      data: data.data,
      version: version || 'latest',
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('pruned')) {
      throw error;
    }
    return null;
  }
}

/**
 * Get account balance at a specific ledger version
 */
export async function getBalanceAtVersion(
  network: MoveNetwork,
  address: string,
  coinType: string = '0x1::aptos_coin::AptosCoin',
  version?: string
): Promise<{ balance: string; version: string } | null> {
  const resourceType = `0x1::coin::CoinStore<${coinType}>`;
  const resource = await getAccountResourceAtVersion(network, address, resourceType, version);

  if (!resource) return null;

  const data = resource.data as { coin?: { value?: string } };
  return {
    balance: data.coin?.value || '0',
    version: resource.version,
  };
}

/**
 * Build fork metadata for simulation response
 */
export async function buildForkMetadata(
  network: MoveNetwork,
  version?: string,
  stateOverrides?: StateOverride[]
): Promise<ForkMetadata> {
  const ledgerInfo = await getLedgerInfo(network);

  return {
    forkedFrom: network,
    ledgerVersion: version || ledgerInfo.ledgerVersion,
    ledgerTimestamp: ledgerInfo.ledgerTimestamp,
    stateOverrides: stateOverrides?.length,
  };
}

/**
 * Validate state overrides
 * Returns errors for any invalid overrides
 */
export function validateStateOverrides(
  overrides: StateOverride[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < overrides.length; i++) {
    const override = overrides[i];

    // Validate address format
    if (!override.address.match(/^0x[a-fA-F0-9]{1,64}$/)) {
      errors.push(`Override ${i}: Invalid address format "${override.address}"`);
    }

    // Validate resource type format
    if (!override.resource_type.match(/^0x[a-fA-F0-9]+::\w+::\w+/)) {
      errors.push(`Override ${i}: Invalid resource type format "${override.resource_type}"`);
    }

    // Validate data is an object
    if (typeof override.data !== 'object' || override.data === null) {
      errors.push(`Override ${i}: Data must be an object`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Cache for CLI support check
let cliSupportCache: { supported: boolean; version?: string; error?: string } | null = null;

/**
 * Check if CLI-based state overrides are available
 */
export async function checkStateOverrideSupport(): Promise<{
  supported: boolean;
  method: 'cli_session' | 'none';
  version?: string;
  error?: string;
}> {
  if (cliSupportCache) {
    return {
      supported: cliSupportCache.supported,
      method: cliSupportCache.supported ? 'cli_session' : 'none',
      version: cliSupportCache.version,
      error: cliSupportCache.error,
    };
  }

  const result = await checkSimulationSessionSupport();
  cliSupportCache = result;

  return {
    supported: result.supported,
    method: result.supported ? 'cli_session' : 'none',
    version: result.version,
    error: result.error,
  };
}

/**
 * Apply state overrides to simulation context
 *
 * This function uses the Aptos CLI Transaction Simulation Sessions when available,
 * which allows for:
 * - Funding accounts with custom balances
 * - Forking from specific ledger versions
 * - Running transactions in isolated environments
 *
 * If CLI support is not available, it falls back to documenting the overrides
 * without actually applying them.
 */
export function applyStateOverrides(
  overrides: StateOverride[]
): {
  applied: boolean;
  message: string;
  details: Array<{ address: string; resource: string; status: string }>;
} {
  // This is the synchronous fallback version
  // For actual state overrides, use applyStateOverridesAsync which uses CLI sessions

  const details = overrides.map(override => ({
    address: override.address,
    resource: override.resource_type,
    status: 'pending', // Will be applied via CLI session
  }));

  return {
    applied: false,
    message: 'State overrides will be applied via CLI simulation session if available.',
    details,
  };
}

/**
 * Apply state overrides using CLI simulation sessions
 * This is the async version that actually applies overrides when CLI support is available
 */
export async function applyStateOverridesAsync(
  network: MoveNetwork,
  overrides: StateOverride[],
  ledgerVersion?: string
): Promise<{
  applied: boolean;
  session?: SimulationSession;
  message: string;
  details: Array<{ address: string; resource: string; status: string; error?: string }>;
}> {
  // Check CLI support
  const support = await checkStateOverrideSupport();

  if (!support.supported) {
    // Fall back to documenting overrides without applying
    const details = overrides.map(override => ({
      address: override.address,
      resource: override.resource_type,
      status: 'not_applied',
      error: support.error || 'CLI simulation sessions not available',
    }));

    return {
      applied: false,
      message: `State overrides could not be applied: ${support.error || 'CLI not available'}. ` +
               'Install Aptos CLI 4.5.0+ to enable state overrides.',
      details,
    };
  }

  try {
    // Create a simulation session
    const session = await createSession({
      network,
      forkFromNetwork: true,
      ledgerVersion,
    });

    // Apply state overrides to the session
    const overrideResults = await applySessionOverrides(session, overrides);

    const details = overrideResults.results.map(result => ({
      address: result.address,
      resource: result.type === 'fund' ? 'balance' : 'resource',
      status: result.status,
      error: result.details,
    }));

    return {
      applied: overrideResults.applied,
      session,
      message: overrideResults.applied
        ? `Applied ${details.filter(d => d.status === 'applied').length} state override(s) via CLI session`
        : 'No state overrides could be applied. Only coin balance overrides are currently supported.',
      details,
    };
  } catch (error) {
    const details = overrides.map(override => ({
      address: override.address,
      resource: override.resource_type,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));

    return {
      applied: false,
      message: `Failed to apply state overrides: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details,
    };
  }
}

/**
 * Run a simulation with state overrides in a CLI session
 * This is the main entry point for fork simulations with state modifications
 */
export async function runForkSimulationWithOverrides(
  network: MoveNetwork,
  overrides: StateOverride[],
  simulationRequest: {
    functionId: string;
    sender: string;
    typeArguments?: string[];
    arguments?: string[];
    maxGasAmount?: number;
    gasUnitPrice?: number;
  },
  ledgerVersion?: string
): Promise<SessionSimulationResult & {
  forkMetadata?: ForkMetadata;
  overrideDetails?: Array<{ address: string; resource: string; status: string; error?: string }>;
}> {
  // Check CLI support first
  const support = await checkStateOverrideSupport();

  if (!support.supported) {
    return {
      success: false,
      gasUsed: 0,
      vmStatus: 'CLI_NOT_AVAILABLE',
      error: `State overrides require Aptos CLI 4.5.0+. ${support.error || ''}`,
      stateOverridesApplied: [],
      overrideDetails: overrides.map(o => ({
        address: o.address,
        resource: o.resource_type,
        status: 'not_available',
        error: 'CLI simulation sessions not available',
      })),
    };
  }

  // Run simulation with overrides
  const result = await runSimulationWithOverrides(
    {
      network,
      forkFromNetwork: true,
      ledgerVersion,
    },
    overrides,
    simulationRequest
  );

  // Build fork metadata
  const forkMetadata = await buildForkMetadata(network, ledgerVersion, overrides);

  return {
    ...result,
    forkMetadata,
    overrideDetails: result.stateOverridesApplied.map(o => ({
      address: o.address,
      resource: o.type,
      status: o.status,
      error: o.details,
    })),
  };
}

/**
 * Compare state between two ledger versions
 */
export async function compareStateVersions(
  network: MoveNetwork,
  address: string,
  resourceType: string,
  version1: string,
  version2: string
): Promise<{
  version1Data: unknown;
  version2Data: unknown;
  changed: boolean;
  diff?: Record<string, { before: unknown; after: unknown }>;
}> {
  const [state1, state2] = await Promise.all([
    getAccountResourceAtVersion(network, address, resourceType, version1),
    getAccountResourceAtVersion(network, address, resourceType, version2),
  ]);

  const v1Data = state1?.data || null;
  const v2Data = state2?.data || null;

  // Simple diff (deep comparison would be more complex)
  const changed = JSON.stringify(v1Data) !== JSON.stringify(v2Data);

  let diff: Record<string, { before: unknown; after: unknown }> | undefined;
  if (changed && v1Data && v2Data && typeof v1Data === 'object' && typeof v2Data === 'object') {
    diff = {};
    const allKeys = new Set([...Object.keys(v1Data), ...Object.keys(v2Data)]);
    for (const key of allKeys) {
      const before = (v1Data as Record<string, unknown>)[key];
      const after = (v2Data as Record<string, unknown>)[key];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        diff[key] = { before, after };
      }
    }
  }

  return {
    version1Data: v1Data,
    version2Data: v2Data,
    changed,
    diff,
  };
}

/**
 * Get recent transaction versions for an account
 * Useful for finding specific points in time to fork from
 */
export async function getAccountTransactionVersions(
  network: MoveNetwork,
  address: string,
  limit: number = 10
): Promise<Array<{ version: string; timestamp: string; hash: string; success: boolean }>> {
  const { fullnode } = NETWORK_CONFIGS[network];

  // Normalize address
  const normalizedAddress = address.startsWith('0x')
    ? '0x' + address.slice(2).padStart(64, '0')
    : '0x' + address.padStart(64, '0');

  const url = `${fullnode}/accounts/${normalizedAddress}/transactions?limit=${limit}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const transactions = await response.json() as Array<Record<string, unknown>>;
    return transactions.map((tx) => ({
      version: tx.version as string,
      timestamp: tx.timestamp as string,
      hash: tx.hash as string,
      success: tx.success as boolean,
    }));
  } catch {
    return [];
  }
}

/**
 * Suggest fork points based on account activity
 */
export async function suggestForkPoints(
  network: MoveNetwork,
  address: string
): Promise<Array<{
  version: string;
  timestamp: string;
  description: string;
  type: 'transaction' | 'block' | 'latest';
}>> {
  const suggestions: Array<{
    version: string;
    timestamp: string;
    description: string;
    type: 'transaction' | 'block' | 'latest';
  }> = [];

  // Get current ledger info
  const ledgerInfo = await getLedgerInfo(network);

  // Add latest as an option
  suggestions.push({
    version: ledgerInfo.ledgerVersion,
    timestamp: ledgerInfo.ledgerTimestamp,
    description: 'Current state (latest)',
    type: 'latest',
  });

  // Get recent transactions for the account
  const transactions = await getAccountTransactionVersions(network, address, 5);
  for (const tx of transactions) {
    suggestions.push({
      version: tx.version,
      timestamp: tx.timestamp,
      description: tx.success ? 'After successful transaction' : 'After failed transaction',
      type: 'transaction',
    });
  }

  return suggestions;
}
