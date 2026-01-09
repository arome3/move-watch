/**
 * Movement Network Gas Model Analysis
 *
 * Movement Network inherits Aptos's gas model but with key differences:
 * - Different gas unit pricing (typically lower due to L2 economics)
 * - Different storage cost structures
 * - Snowman consensus affects finality costs
 * - Block-STM parallelization affects complex transaction costs
 *
 * This module provides Movement-specific gas analysis and comparisons.
 */

import type { Network, GasBreakdown } from '@movewatch/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface GasModelAnalysis {
  network: Network;
  model: GasModelDetails;
  comparison?: NetworkComparison;
  optimizations: GasOptimizationTip[];
  costProjection: CostProjection;
}

export interface GasModelDetails {
  name: string;
  description: string;
  characteristics: GasCharacteristic[];
  feeComponents: FeeComponent[];
  pricing: GasPricing;
}

export interface GasCharacteristic {
  name: string;
  value: string;
  description: string;
  impact: 'positive' | 'neutral' | 'negative';
}

export interface FeeComponent {
  name: string;
  description: string;
  formula?: string;
  percentage?: number; // Typical percentage of total fee
}

export interface GasPricing {
  minGasUnitPrice: number; // In octas
  recommendedGasUnitPrice: number;
  storagePerByte: number; // Octas per byte
  executionMultiplier: number; // Relative to base
}

export interface NetworkComparison {
  movementVsAptos: ComparisonResult;
  movementVsSui: ComparisonResult;
  summary: string;
}

export interface ComparisonResult {
  gasCostRatio: number; // < 1 means Movement is cheaper
  storageCostRatio: number;
  finalityTime: { movement: string; other: string };
  notes: string[];
}

export interface GasOptimizationTip {
  id: string;
  category: 'storage' | 'computation' | 'batching' | 'pattern';
  title: string;
  description: string;
  potentialSavings: string; // e.g., "10-30%"
  applicable: boolean;
  reason?: string;
}

export interface CostProjection {
  singleTx: CostEstimate;
  daily100Tx: CostEstimate;
  monthly: CostEstimate;
  currency: 'MOVE' | 'USD';
}

export interface CostEstimate {
  low: number;
  expected: number;
  high: number;
  formatted: string;
}

// ============================================================================
// NETWORK GAS MODELS
// ============================================================================

const MOVEMENT_GAS_MODEL: GasModelDetails = {
  name: 'Movement Network Gas Model',
  description:
    'Movement inherits Aptos\'s gas model with L2 optimizations. Uses Block-STM for parallel execution and Snowman consensus for fast finality.',
  characteristics: [
    {
      name: 'Parallel Execution',
      value: 'Block-STM',
      description:
        'Optimistic parallelization processes transactions concurrently, re-executing conflicts',
      impact: 'positive',
    },
    {
      name: 'Consensus',
      value: 'Snowman (Avalanche)',
      description:
        'Probabilistic consensus via validator sampling enables fast finality (~1-2s)',
      impact: 'positive',
    },
    {
      name: 'Storage Model',
      value: 'Resource-based',
      description:
        'Storage fees based on resource allocation with refunds on deletion',
      impact: 'neutral',
    },
    {
      name: 'L2 Economics',
      value: 'Lower Base Fees',
      description:
        'As an L2/modular chain, Movement typically has lower base fees than L1s',
      impact: 'positive',
    },
    {
      name: 'Move VM',
      value: 'Aptos Move',
      description:
        'Uses Aptos Move VM with full Move 2 support',
      impact: 'positive',
    },
  ],
  feeComponents: [
    {
      name: 'Execution Gas',
      description: 'CPU cycles for VM instruction execution',
      formula: 'instruction_count × instruction_cost',
      percentage: 40,
    },
    {
      name: 'IO Gas',
      description: 'Read/write operations to global storage',
      formula: 'reads × read_cost + writes × write_cost',
      percentage: 30,
    },
    {
      name: 'Storage Fee',
      description: 'Persistent storage allocation (refundable on deletion)',
      formula: 'bytes_allocated × storage_per_byte',
      percentage: 25,
    },
    {
      name: 'Intrinsic Gas',
      description: 'Base transaction overhead',
      formula: 'base_cost + payload_size × per_byte_cost',
      percentage: 5,
    },
  ],
  pricing: {
    minGasUnitPrice: 100, // 100 octas = 0.000001 MOVE
    recommendedGasUnitPrice: 150,
    storagePerByte: 100, // octas per byte
    executionMultiplier: 1.0,
  },
};

const APTOS_GAS_MODEL: GasModelDetails = {
  name: 'Aptos Gas Model',
  description:
    'L1 gas model with execution, IO, and storage components. Uses AptosBFT consensus.',
  characteristics: [
    {
      name: 'Parallel Execution',
      value: 'Block-STM',
      description: 'Same parallelization as Movement',
      impact: 'positive',
    },
    {
      name: 'Consensus',
      value: 'AptosBFT',
      description: 'BFT consensus with ~400ms block time',
      impact: 'neutral',
    },
    {
      name: 'L1 Economics',
      value: 'Higher Base Fees',
      description: 'L1 security costs reflected in fees',
      impact: 'negative',
    },
  ],
  feeComponents: MOVEMENT_GAS_MODEL.feeComponents, // Same structure
  pricing: {
    minGasUnitPrice: 100,
    recommendedGasUnitPrice: 100,
    storagePerByte: 100,
    executionMultiplier: 1.0,
  },
};

// ============================================================================
// GAS ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze gas usage and provide Movement-specific insights
 */
export function analyzeGasModel(
  network: Network,
  gasBreakdown?: GasBreakdown,
  functionPath?: string
): GasModelAnalysis {
  const model = network === 'mainnet' || network === 'testnet'
    ? MOVEMENT_GAS_MODEL
    : MOVEMENT_GAS_MODEL; // All Movement networks use same model

  const optimizations = generateOptimizations(gasBreakdown, functionPath);
  const costProjection = calculateCostProjection(gasBreakdown?.total || 1000, network);
  const comparison = generateComparison(gasBreakdown);

  return {
    network,
    model,
    comparison,
    optimizations,
    costProjection,
  };
}

/**
 * Generate optimization tips based on gas breakdown
 */
function generateOptimizations(
  gasBreakdown?: GasBreakdown,
  functionPath?: string
): GasOptimizationTip[] {
  const tips: GasOptimizationTip[] = [];

  // Storage optimization
  tips.push({
    id: 'storage_cleanup',
    category: 'storage',
    title: 'Clean Up Unused Storage',
    description:
      'Delete resources when no longer needed to receive storage fee refunds. Movement refunds 100% of storage fees on deletion.',
    potentialSavings: '20-40%',
    applicable: true,
  });

  // Check if storage is high percentage
  if (gasBreakdown?.byCategory?.storage && gasBreakdown.total) {
    const storagePercent = (gasBreakdown.byCategory.storage / gasBreakdown.total) * 100;
    if (storagePercent > 30) {
      tips.push({
        id: 'reduce_storage',
        category: 'storage',
        title: 'High Storage Usage Detected',
        description:
          `Storage accounts for ${storagePercent.toFixed(0)}% of gas. Consider using SmartVector/SmartTable for large collections.`,
        potentialSavings: '15-25%',
        applicable: true,
        reason: `Storage: ${storagePercent.toFixed(0)}% of total gas`,
      });
    }
  }

  // Batching optimization
  tips.push({
    id: 'batch_transactions',
    category: 'batching',
    title: 'Batch Related Operations',
    description:
      'Combine multiple operations into single transactions to share intrinsic gas costs (~5% of each tx).',
    potentialSavings: '5-15%',
    applicable: true,
  });

  // Block-STM optimization
  tips.push({
    id: 'parallel_friendly',
    category: 'pattern',
    title: 'Design for Parallelization',
    description:
      'Movement uses Block-STM. Avoid global state contention to benefit from parallel execution.',
    potentialSavings: 'Throughput improvement',
    applicable: true,
  });

  // View functions
  if (functionPath && !functionPath.includes('view')) {
    tips.push({
      id: 'use_view_functions',
      category: 'computation',
      title: 'Use View Functions for Reads',
      description:
        'View functions are free (no gas) when called off-chain. Use them for read-only operations.',
      potentialSavings: '100% for reads',
      applicable: true,
    });
  }

  // Resource access patterns
  tips.push({
    id: 'minimize_reads',
    category: 'computation',
    title: 'Minimize Resource Reads',
    description:
      'Each resource read costs IO gas. Cache values locally instead of re-reading from global storage.',
    potentialSavings: '10-20%',
    applicable: true,
  });

  return tips;
}

/**
 * Calculate cost projections
 */
function calculateCostProjection(
  gasUsed: number,
  network: Network
): CostProjection {
  const pricing = MOVEMENT_GAS_MODEL.pricing;
  const gasPrice = pricing.recommendedGasUnitPrice;

  // Cost in octas
  const singleTxOctas = gasUsed * gasPrice;
  const daily100Octas = singleTxOctas * 100;
  const monthlyOctas = daily100Octas * 30;

  // Convert to MOVE (8 decimals)
  const octasToMove = (octas: number) => octas / 100_000_000;

  // Format helper
  const formatMove = (move: number): string => {
    if (move < 0.0001) return `${(move * 100_000_000).toFixed(0)} octas`;
    if (move < 0.01) return `${move.toFixed(6)} MOVE`;
    if (move < 1) return `${move.toFixed(4)} MOVE`;
    return `${move.toFixed(2)} MOVE`;
  };

  // Variance: ±30%
  const variance = 0.3;

  return {
    singleTx: {
      low: octasToMove(singleTxOctas * (1 - variance)),
      expected: octasToMove(singleTxOctas),
      high: octasToMove(singleTxOctas * (1 + variance)),
      formatted: formatMove(octasToMove(singleTxOctas)),
    },
    daily100Tx: {
      low: octasToMove(daily100Octas * (1 - variance)),
      expected: octasToMove(daily100Octas),
      high: octasToMove(daily100Octas * (1 + variance)),
      formatted: formatMove(octasToMove(daily100Octas)),
    },
    monthly: {
      low: octasToMove(monthlyOctas * (1 - variance)),
      expected: octasToMove(monthlyOctas),
      high: octasToMove(monthlyOctas * (1 + variance)),
      formatted: formatMove(octasToMove(monthlyOctas)),
    },
    currency: 'MOVE',
  };
}

/**
 * Generate comparison with other networks
 */
function generateComparison(gasBreakdown?: GasBreakdown): NetworkComparison {
  // Movement vs Aptos comparison
  // Movement is typically cheaper due to L2 economics
  const movementVsAptos: ComparisonResult = {
    gasCostRatio: 0.7, // Movement ~30% cheaper
    storageCostRatio: 1.0, // Same storage model
    finalityTime: {
      movement: '~1-2s (Snowman)',
      other: '~400ms (AptosBFT)',
    },
    notes: [
      'Movement uses same Move VM and gas schedule as Aptos',
      'L2 economics typically result in lower effective fees',
      'Block-STM parallelization identical on both networks',
      'Aptos has faster block times but Movement has economic advantages',
    ],
  };

  // Movement vs Sui comparison
  const movementVsSui: ComparisonResult = {
    gasCostRatio: 0.8, // Varies significantly
    storageCostRatio: 0.9,
    finalityTime: {
      movement: '~1-2s',
      other: '~400ms (Narwhal/Bullshark)',
    },
    notes: [
      'Sui uses different Move dialect (Sui Move vs Aptos Move)',
      'Sui has object-centric model vs Movement resource model',
      'Different parallelization approaches (DAG vs Block-STM)',
      'Movement supports both Move and Solidity (via Move EVM)',
    ],
  };

  return {
    movementVsAptos,
    movementVsSui,
    summary:
      'Movement Network offers competitive gas costs with the security of Move. As an L2, it typically has lower fees than L1 chains while maintaining full Move 2 compatibility.',
  };
}

/**
 * Get gas model details for a network
 */
export function getGasModelDetails(network: Network): GasModelDetails {
  return MOVEMENT_GAS_MODEL;
}

/**
 * Estimate gas for common operations
 */
export function estimateCommonOperations(): Record<string, { gas: number; cost: string }> {
  const pricing = MOVEMENT_GAS_MODEL.pricing;
  const formatCost = (gas: number) => {
    const octas = gas * pricing.recommendedGasUnitPrice;
    const move = octas / 100_000_000;
    return move < 0.0001 ? `${octas} octas` : `${move.toFixed(6)} MOVE`;
  };

  return {
    'Token Transfer (APT/MOVE)': {
      gas: 500,
      cost: formatCost(500),
    },
    'NFT Mint': {
      gas: 2000,
      cost: formatCost(2000),
    },
    'DEX Swap': {
      gas: 5000,
      cost: formatCost(5000),
    },
    'Liquidity Add': {
      gas: 8000,
      cost: formatCost(8000),
    },
    'Account Creation': {
      gas: 1000,
      cost: formatCost(1000),
    },
    'Coin Registration': {
      gas: 800,
      cost: formatCost(800),
    },
    'Complex Contract Call': {
      gas: 15000,
      cost: formatCost(15000),
    },
  };
}

/**
 * Calculate storage refund potential
 */
export function calculateStorageRefund(
  bytesAllocated: number,
  bytesFreed: number
): { potential: number; formatted: string } {
  const pricing = MOVEMENT_GAS_MODEL.pricing;
  const refundOctas = bytesFreed * pricing.storagePerByte;
  const refundMove = refundOctas / 100_000_000;

  return {
    potential: refundOctas,
    formatted:
      refundMove < 0.0001
        ? `${refundOctas} octas`
        : `${refundMove.toFixed(6)} MOVE`,
  };
}

// ============================================================================
// MOVEMENT-SPECIFIC FEATURES
// ============================================================================

export interface MovementFeature {
  id: string;
  name: string;
  description: string;
  benefit: string;
  available: boolean;
}

/**
 * Get Movement-specific features that differentiate it from Aptos
 */
export function getMovementFeatures(): MovementFeature[] {
  return [
    {
      id: 'snowman_consensus',
      name: 'Snowman Consensus',
      description:
        'Probabilistic consensus from Avalanche that samples validator subsets',
      benefit: 'Fast finality with dynamic load adjustment',
      available: true,
    },
    {
      id: 'eth_settlement',
      name: 'Ethereum Settlement',
      description:
        'Transaction data posted to Ethereum for security',
      benefit: 'Inherits Ethereum security guarantees',
      available: true,
    },
    {
      id: 'move_evm',
      name: 'Move EVM',
      description:
        'Run Solidity contracts on Movement via Move EVM',
      benefit: 'Access to existing Solidity ecosystem',
      available: true,
    },
    {
      id: 'move2_support',
      name: 'Full Move 2 Support',
      description:
        'All Move 2.x features including enums, function values, signed integers',
      benefit: 'Modern Move development experience',
      available: true,
    },
    {
      id: 'block_stm',
      name: 'Block-STM Parallelization',
      description:
        'Optimistic parallel transaction execution',
      benefit: 'High throughput for non-conflicting transactions',
      available: true,
    },
    {
      id: 'faucet',
      name: 'Testnet Faucet',
      description:
        'Free testnet MOVE tokens for development',
      benefit: 'Easy testing without mainnet funds',
      available: true,
    },
  ];
}
