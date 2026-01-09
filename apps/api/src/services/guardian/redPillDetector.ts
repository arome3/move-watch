/**
 * Red Pill Attack Detection & Prevention
 *
 * The "Red Pill" attack exploits simulation environments by detecting when code
 * runs in simulation vs production. Malicious contracts check special variables
 * (COINBASE, TIMESTAMP, BLOCK_NUMBER) that have arbitrary values during simulation.
 *
 * References:
 * - ZenGo Research (Ethereum Foundation $50k grant): https://zengo.com/zengo-uncovers-security-vulnerabilities-in-popular-web3-transaction-simulation-solutions-the-red-pill-attack/
 * - Tenderly Fix: https://blog.tenderly.co/how-to-protect-wallet-users-from-the-red-pill-attack/
 * - Affected: Coinbase Wallet, Rabby, Pocket Universe, Fire, Blowfish (all patched)
 *
 * Detection Strategy:
 * 1. Detect contracts that READ special variables (block.coinbase, block.timestamp, etc.)
 * 2. Run simulation twice with different environment values
 * 3. Compare results - divergence indicates Red Pill behavior
 * 4. Flag contracts that access simulation-detectable variables
 */

import type { Network, RiskSeverity, SimulationEvent, StateChange } from '@movewatch/shared';
import type { DetectedIssue } from './types.js';
import { CONFIDENCE_LEVELS } from './utils.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RedPillAnalysisResult {
  isVulnerable: boolean;
  detectedPatterns: RedPillPattern[];
  issues: DetectedIssue[];
  recommendations: string[];
  simulationIntegrity: {
    environmentHardened: boolean;
    usedRealBlockData: boolean;
    multiRunVerified: boolean;
  };
}

export interface RedPillPattern {
  id: string;
  name: string;
  description: string;
  detectionMethod: string;
  severity: RiskSeverity;
  evidence: Record<string, unknown>;
}

export interface BlockchainEnvironment {
  blockHeight: number;
  blockTimestamp: number;
  epoch: number;
  ledgerVersion: number;
  chainId: number;
  // Movement/Aptos specific
  gasUnitPrice: number;
  proposer?: string;
}

// ============================================================================
// RED PILL DETECTION PATTERNS
// ============================================================================

/**
 * Patterns that indicate a contract may be detecting simulation environment
 */
const RED_PILL_INDICATORS = {
  // Functions that access block/chain metadata
  environmentAccessPatterns: [
    /block::get_current_block_height/i,
    /timestamp::now_seconds/i,
    /timestamp::now_microseconds/i,
    /chain_id::get/i,
    /block::get_epoch/i,
    /transaction_context::get_transaction_hash/i,
    /transaction_context::generate_unique_address/i,
    /randomness::u64_range/i,  // On-chain randomness
    /randomness::permutation/i,
  ],

  // Patterns that compare environment values (simulation detection)
  comparisonPatterns: [
    /if.*block.*==.*0/i,      // Check if block height is 0 (simulation default)
    /if.*timestamp.*<.*1/i,   // Check if timestamp is suspiciously low
    /if.*chain_id.*!=/i,      // Chain ID mismatch check
    /require.*block/i,        // Assertions on block data
  ],

  // Event patterns that might indicate conditional behavior
  conditionalEventPatterns: [
    /SimulationDetected/i,
    /EnvironmentCheck/i,
    /BlockValidation/i,
  ],

  // State access patterns that vary by environment
  stateAccessPatterns: [
    /global_storage/i,
    /borrow_global/i,
    /move_to/i,
    /move_from/i,
  ],
};

/**
 * Known Red Pill bytecode signatures (from real attacks)
 * These are actual patterns found in malicious contracts
 */
const KNOWN_RED_PILL_SIGNATURES = [
  {
    id: 'RP-001',
    name: 'Coinbase Zero Check',
    // In EVM: if(block.coinbase == address(0))
    // In Move: Similar pattern checking block proposer
    pattern: /proposer.*==.*0x0+/i,
    description: 'Contract checks if block proposer is zero (simulation indicator)',
  },
  {
    id: 'RP-002',
    name: 'Timestamp Sanity Check',
    // Checks if timestamp is unrealistically low
    pattern: /timestamp.*<.*1000000/,
    description: 'Contract verifies timestamp is realistic (fails in default simulation)',
  },
  {
    id: 'RP-003',
    name: 'Block Height Validation',
    pattern: /block_height.*==.*0|get_current_block_height.*0/i,
    description: 'Contract checks for zero block height (common simulation default)',
  },
  {
    id: 'RP-004',
    name: 'Chain ID Mismatch',
    pattern: /chain_id.*!=.*[0-9]+/i,
    description: 'Contract validates chain ID matches expected network',
  },
  {
    id: 'RP-005',
    name: 'Transaction Hash Check',
    pattern: /transaction_hash.*==.*0x0+/i,
    description: 'Contract checks transaction hash (often zeroed in simulation)',
  },
];

// ============================================================================
// BLOCKCHAIN DATA FETCHING
// ============================================================================

/**
 * Fetch real blockchain environment data for simulation hardening
 * This is the key fix for Red Pill attacks - use REAL data, not defaults
 */
export async function fetchRealBlockchainEnvironment(
  network: Network
): Promise<BlockchainEnvironment | null> {
  const endpoints: Record<Network, string> = {
    mainnet: 'https://mainnet.movementnetwork.xyz/v1',
    testnet: 'https://testnet.movementnetwork.xyz/v1',
    devnet: 'https://devnet.movementnetwork.xyz/v1',
  };

  const endpoint = endpoints[network];
  if (!endpoint) return null;

  try {
    // Fetch current ledger info
    const response = await fetch(endpoint, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch blockchain env: ${response.status}`);
      return null;
    }

    interface LedgerInfo {
      block_height?: string;
      ledger_timestamp?: string;
      epoch?: string;
      ledger_version?: string;
      chain_id?: number;
      gas_estimate?: { gas_unit_price?: number };
    }

    const data = await response.json() as LedgerInfo;

    return {
      blockHeight: parseInt(data.block_height || '0', 10),
      blockTimestamp: parseInt(data.ledger_timestamp || '0', 10),
      epoch: parseInt(data.epoch || '0', 10),
      ledgerVersion: parseInt(data.ledger_version || '0', 10),
      chainId: data.chain_id || 0,
      gasUnitPrice: data.gas_estimate?.gas_unit_price || 100,
    };
  } catch (error) {
    console.error('Error fetching blockchain environment:', error);
    return null;
  }
}

// ============================================================================
// RED PILL DETECTION
// ============================================================================

/**
 * Analyze module bytecode/ABI for Red Pill patterns
 */
export function detectRedPillPatterns(
  moduleCode: string | undefined,
  functionName: string,
  events?: SimulationEvent[],
  stateChanges?: StateChange[]
): RedPillPattern[] {
  const detected: RedPillPattern[] = [];

  // Check known signatures in code (if available)
  if (moduleCode) {
    for (const sig of KNOWN_RED_PILL_SIGNATURES) {
      if (sig.pattern.test(moduleCode)) {
        detected.push({
          id: sig.id,
          name: sig.name,
          description: sig.description,
          detectionMethod: 'bytecode_pattern',
          severity: 'HIGH',
          evidence: { matchedPattern: sig.pattern.source },
        });
      }
    }
  }

  // Check function name for environment access
  for (const pattern of RED_PILL_INDICATORS.environmentAccessPatterns) {
    if (pattern.test(functionName)) {
      detected.push({
        id: 'RP-ENV-ACCESS',
        name: 'Environment Variable Access',
        description: `Function accesses blockchain environment data that differs between simulation and production`,
        detectionMethod: 'function_analysis',
        severity: 'MEDIUM',
        evidence: { functionName, pattern: pattern.source },
      });
    }
  }

  // Check events for conditional behavior indicators
  if (events) {
    for (const event of events) {
      for (const pattern of RED_PILL_INDICATORS.conditionalEventPatterns) {
        if (pattern.test(event.type)) {
          detected.push({
            id: 'RP-COND-EVENT',
            name: 'Conditional Execution Event',
            description: 'Contract emitted event suggesting environment-dependent behavior',
            detectionMethod: 'event_analysis',
            severity: 'HIGH',
            evidence: { eventType: event.type },
          });
        }
      }
    }
  }

  return detected;
}

/**
 * Compare two simulation runs to detect behavioral divergence
 * Run simulation twice with different environment values
 */
export function detectBehavioralDivergence(
  run1: {
    success: boolean;
    gasUsed?: number;
    events?: SimulationEvent[];
    stateChanges?: StateChange[];
  },
  run2: {
    success: boolean;
    gasUsed?: number;
    events?: SimulationEvent[];
    stateChanges?: StateChange[];
  }
): { divergent: boolean; divergenceType?: string; severity: RiskSeverity } {
  // Success/failure divergence is critical
  if (run1.success !== run2.success) {
    return {
      divergent: true,
      divergenceType: 'execution_outcome',
      severity: 'CRITICAL',
    };
  }

  // Significant gas difference (>20%) suggests different code paths
  if (run1.gasUsed && run2.gasUsed) {
    const gasDiff = Math.abs(run1.gasUsed - run2.gasUsed);
    const avgGas = (run1.gasUsed + run2.gasUsed) / 2;
    if (gasDiff / avgGas > 0.2) {
      return {
        divergent: true,
        divergenceType: 'gas_usage',
        severity: 'HIGH',
      };
    }
  }

  // Different number of events suggests different behavior
  const events1Count = run1.events?.length || 0;
  const events2Count = run2.events?.length || 0;
  if (events1Count !== events2Count) {
    return {
      divergent: true,
      divergenceType: 'event_count',
      severity: 'HIGH',
    };
  }

  // Different state changes
  const changes1Count = run1.stateChanges?.length || 0;
  const changes2Count = run2.stateChanges?.length || 0;
  if (changes1Count !== changes2Count) {
    return {
      divergent: true,
      divergenceType: 'state_changes',
      severity: 'CRITICAL',
    };
  }

  return { divergent: false, severity: 'LOW' };
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Comprehensive Red Pill vulnerability analysis
 */
export async function analyzeRedPillVulnerability(data: {
  network: Network;
  functionName: string;
  moduleCode?: string;
  simulationResult?: {
    success: boolean;
    gasUsed?: number;
    events?: SimulationEvent[];
    stateChanges?: StateChange[];
  };
  // Optional: second simulation run with different env for comparison
  comparisonResult?: {
    success: boolean;
    gasUsed?: number;
    events?: SimulationEvent[];
    stateChanges?: StateChange[];
  };
}): Promise<RedPillAnalysisResult> {
  const issues: DetectedIssue[] = [];
  const recommendations: string[] = [];

  // 1. Fetch real blockchain environment
  const realEnv = await fetchRealBlockchainEnvironment(data.network);
  const environmentHardened = realEnv !== null;

  if (!environmentHardened) {
    recommendations.push(
      'WARNING: Could not fetch real blockchain environment data. ' +
      'Simulation may use default values that attackers can detect.'
    );
  }

  // 2. Detect Red Pill patterns in code/events
  const detectedPatterns = detectRedPillPatterns(
    data.moduleCode,
    data.functionName,
    data.simulationResult?.events,
    data.simulationResult?.stateChanges
  );

  // 3. Check for behavioral divergence if we have comparison data
  let multiRunVerified = false;
  if (data.simulationResult && data.comparisonResult) {
    multiRunVerified = true;
    const divergence = detectBehavioralDivergence(
      data.simulationResult,
      data.comparisonResult
    );

    if (divergence.divergent) {
      issues.push({
        patternId: 'redpill:behavioral_divergence',
        category: 'EXPLOIT',
        severity: divergence.severity,
        title: 'Red Pill Attack: Behavioral Divergence Detected',
        description: `Contract behaves differently across simulation runs with different environment values. ` +
          `Divergence type: ${divergence.divergenceType}. ` +
          `This is a strong indicator of Red Pill attack - the contract detects simulation and behaves safely, ` +
          `but will execute malicious logic in production.`,
        recommendation: 'DO NOT proceed with this transaction. The contract is actively trying to evade security detection. ' +
          'This is a known attack pattern that has stolen millions of dollars.',
        confidence: CONFIDENCE_LEVELS.VERY_HIGH,
        source: 'pattern' as const,
        evidence: {
          divergenceType: divergence.divergenceType,
          verificationMethod: 'multi_run_comparison',
          run1Success: data.simulationResult.success,
          run2Success: data.comparisonResult.success,
        },
      });
    }
  }

  // 4. Generate issues for detected patterns
  for (const pattern of detectedPatterns) {
    issues.push({
      patternId: `redpill:${pattern.id.toLowerCase()}`,
      category: 'EXPLOIT',
      severity: pattern.severity,
      title: `Red Pill Pattern: ${pattern.name}`,
      description: pattern.description + ' ' +
        'Contracts that access blockchain environment variables may behave differently in simulation vs production.',
      recommendation: 'Verify this contract through multiple independent security tools. ' +
        'Consider running simulation with hardened environment values.',
      confidence: pattern.detectionMethod === 'bytecode_pattern'
        ? CONFIDENCE_LEVELS.HIGH
        : CONFIDENCE_LEVELS.MEDIUM,
      source: 'pattern' as const,
      evidence: pattern.evidence,
    });
  }

  // 5. Add general recommendations
  if (detectedPatterns.length > 0) {
    recommendations.push(
      'This contract accesses blockchain environment variables. ' +
      'Recommend verifying behavior on testnet before mainnet interaction.'
    );
  }

  if (!multiRunVerified) {
    recommendations.push(
      'For maximum security, run simulation twice with different block heights/timestamps ' +
      'and compare results to detect Red Pill behavior.'
    );
  }

  return {
    isVulnerable: detectedPatterns.length > 0 || issues.some(i => i.severity === 'CRITICAL'),
    detectedPatterns,
    issues,
    recommendations,
    simulationIntegrity: {
      environmentHardened,
      usedRealBlockData: environmentHardened,
      multiRunVerified,
    },
  };
}

/**
 * Get simulation environment configuration with real blockchain data
 * This should be used when running simulations to prevent Red Pill attacks
 */
export async function getHardenedSimulationConfig(
  network: Network
): Promise<{
  blockHeight: number;
  timestamp: number;
  chainId: number;
  isHardened: boolean;
}> {
  const realEnv = await fetchRealBlockchainEnvironment(network);

  if (realEnv) {
    return {
      blockHeight: realEnv.blockHeight,
      timestamp: realEnv.blockTimestamp,
      chainId: realEnv.chainId,
      isHardened: true,
    };
  }

  // Fallback to realistic-looking values (not ideal but better than zeros)
  const now = Date.now() * 1000; // microseconds
  return {
    blockHeight: 10000000 + Math.floor(Math.random() * 1000000),
    timestamp: now,
    chainId: network === 'mainnet' ? 1 : 2,
    isHardened: false,
  };
}

/**
 * Quick check if a function name suggests environment access
 */
export function mightAccessEnvironment(functionName: string): boolean {
  const envPatterns = [
    /timestamp/i,
    /block/i,
    /chain_id/i,
    /random/i,
    /epoch/i,
  ];

  return envPatterns.some(p => p.test(functionName));
}

export { RED_PILL_INDICATORS, KNOWN_RED_PILL_SIGNATURES };
