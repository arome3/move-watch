/**
 * Execution Trace Builder
 * Builds execution traces from simulation results (events, changes)
 * Since Movement/Aptos doesn't provide full execution traces via API,
 * we reconstruct the flow from observable side effects.
 */
import type {
  ExecutionTrace,
  ExecutionStep,
  ExecutionStepType,
  CallGraphNode,
  StateChange,
  SimulationEvent,
  GasBreakdown,
  GasOperation,
  SimulationWarning,
  GasEstimate,
  GasOptimization,
  GasEfficiencyScore,
  StorageCostProjection,
} from '@movewatch/shared';

// Gas cost estimates per operation type (approximate)
const GAS_ESTIMATES = {
  FUNCTION_CALL_BASE: 10,
  RESOURCE_READ: 100,
  RESOURCE_WRITE: 500,
  RESOURCE_CREATE: 1000,
  RESOURCE_DELETE: 100,
  EVENT_EMIT: 50,
  STORAGE_PER_BYTE: 10,
  INTRINSIC_BASE: 100,
  DEPENDENCY_LOAD: 50,
};

import type { Network } from '@movewatch/shared';
import {
  getBenchmark,
  calculateRealEfficiencyScore,
  type GasBenchmark,
} from '../services/gasBenchmarkService.js';

// Fallback benchmarks (used only when service unavailable)
// These are marked as estimates in the UI
const FALLBACK_BENCHMARKS: Record<string, { avg: number; median: number; p90: number }> = {
  'coin::transfer': { avg: 700, median: 650, p90: 1000 },
  'aptos_account::transfer': { avg: 800, median: 750, p90: 1100 },
  'account::create_account': { avg: 1200, median: 1100, p90: 1600 },
  'staking::stake': { avg: 2200, median: 2000, p90: 3000 },
  'nft::mint': { avg: 2800, median: 2500, p90: 4000 },
  'default': { avg: 1500, median: 1200, p90: 2500 },
};

/**
 * Parse a fully qualified type/function path
 */
function parseTypePath(typePath: string): { moduleAddress: string; moduleName: string; typeName: string } | null {
  // Handle generics: 0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>
  const baseMatch = typePath.match(/^(0x[a-fA-F0-9]+)::(\w+)::(\w+)/);
  if (!baseMatch) return null;
  return {
    moduleAddress: baseMatch[1],
    moduleName: baseMatch[2],
    typeName: baseMatch[3],
  };
}

/**
 * Build execution steps from events
 */
function buildEventSteps(
  events: SimulationEvent[],
  startIndex: number,
  gasPerEvent: number
): ExecutionStep[] {
  return events.map((event, idx) => {
    const parsed = parseTypePath(event.type);
    return {
      index: startIndex + idx,
      type: 'EVENT_EMIT' as ExecutionStepType,
      module: parsed ? `${parsed.moduleAddress}::${parsed.moduleName}` : 'unknown',
      function: parsed?.typeName,
      description: `Emit ${parsed?.typeName || event.type}`,
      gasUsed: gasPerEvent,
      cumulativeGas: gasPerEvent * (idx + 1),
      data: event.data,
    };
  });
}

/**
 * Build execution steps from state changes
 */
function buildStateChangeSteps(
  changes: StateChange[],
  startIndex: number,
  totalGasForChanges: number
): ExecutionStep[] {
  const gasPerChange = Math.floor(totalGasForChanges / Math.max(changes.length, 1));

  return changes.map((change, idx) => {
    const parsed = parseTypePath(change.resource);
    let stepType: ExecutionStepType;
    let description: string;

    switch (change.type) {
      case 'create':
        stepType = 'RESOURCE_CREATE';
        description = `Create ${parsed?.typeName || change.resource} at ${change.address.slice(0, 10)}...`;
        break;
      case 'delete':
        stepType = 'RESOURCE_DELETE';
        description = `Delete ${parsed?.typeName || change.resource} from ${change.address.slice(0, 10)}...`;
        break;
      case 'modify':
      default:
        stepType = 'RESOURCE_WRITE';
        description = `Update ${parsed?.typeName || change.resource} at ${change.address.slice(0, 10)}...`;
        break;
    }

    return {
      index: startIndex + idx,
      type: stepType,
      module: parsed ? `${parsed.moduleAddress}::${parsed.moduleName}` : 'unknown',
      description,
      gasUsed: gasPerChange,
      cumulativeGas: gasPerChange * (idx + 1),
      data: {
        address: change.address,
        before: change.before,
        after: change.after,
      },
    };
  });
}

/**
 * Build a call graph from events and changes
 * Groups operations by module to show the flow
 */
function buildCallGraph(
  entryFunction: string,
  events: SimulationEvent[],
  changes: StateChange[],
  totalGas: number
): CallGraphNode {
  // Parse entry function
  const entryMatch = entryFunction.match(/^(0x[a-fA-F0-9]+)::(\w+)::(\w+)$/);
  const entryModule = entryMatch ? `${entryMatch[1]}::${entryMatch[2]}` : 'entry';
  const entryFn = entryMatch?.[3] || entryFunction;

  // Group by module
  const moduleGas: Map<string, { gas: number; functions: Set<string> }> = new Map();

  // Add entry function
  moduleGas.set(entryModule, { gas: totalGas * 0.3, functions: new Set([entryFn]) });

  // Add modules from events
  for (const event of events) {
    const parsed = parseTypePath(event.type);
    if (parsed) {
      const module = `${parsed.moduleAddress}::${parsed.moduleName}`;
      if (!moduleGas.has(module)) {
        moduleGas.set(module, { gas: 0, functions: new Set() });
      }
      const data = moduleGas.get(module)!;
      data.gas += GAS_ESTIMATES.EVENT_EMIT;
      data.functions.add(parsed.typeName);
    }
  }

  // Add modules from changes
  for (const change of changes) {
    const parsed = parseTypePath(change.resource);
    if (parsed) {
      const module = `${parsed.moduleAddress}::${parsed.moduleName}`;
      if (!moduleGas.has(module)) {
        moduleGas.set(module, { gas: 0, functions: new Set() });
      }
      const data = moduleGas.get(module)!;
      data.gas += change.type === 'create' ? GAS_ESTIMATES.RESOURCE_CREATE : GAS_ESTIMATES.RESOURCE_WRITE;
      data.functions.add(parsed.typeName);
    }
  }

  // Build tree (entry function calls all other modules)
  const children: CallGraphNode[] = [];
  for (const [module, data] of moduleGas) {
    if (module !== entryModule) {
      children.push({
        module,
        function: Array.from(data.functions).join(', '),
        gasUsed: Math.round(data.gas),
        percentage: Math.round((data.gas / totalGas) * 100),
        children: [],
      });
    }
  }

  return {
    module: entryModule,
    function: entryFn,
    gasUsed: totalGas,
    percentage: 100,
    children,
  };
}

/**
 * Build a complete execution trace
 */
export function buildExecutionTrace(
  entryFunction: string,
  events: SimulationEvent[],
  changes: StateChange[],
  totalGas: number,
  success: boolean
): ExecutionTrace {
  // Allocate gas estimates
  const eventGas = events.length * GAS_ESTIMATES.EVENT_EMIT;
  const storageGas = changes.reduce((sum, c) => {
    return sum + (c.type === 'create' ? GAS_ESTIMATES.RESOURCE_CREATE : GAS_ESTIMATES.RESOURCE_WRITE);
  }, 0);
  const computeGas = totalGas - eventGas - storageGas;

  const steps: ExecutionStep[] = [];
  let stepIndex = 0;

  // Step 1: Entry function call
  const entryMatch = entryFunction.match(/^(0x[a-fA-F0-9]+)::(\w+)::(\w+)$/);
  steps.push({
    index: stepIndex++,
    type: 'FUNCTION_CALL',
    module: entryMatch ? `${entryMatch[1]}::${entryMatch[2]}` : 'unknown',
    function: entryMatch?.[3],
    description: `Call ${entryFunction}`,
    gasUsed: Math.max(computeGas, GAS_ESTIMATES.FUNCTION_CALL_BASE),
    cumulativeGas: Math.max(computeGas, GAS_ESTIMATES.FUNCTION_CALL_BASE),
  });

  // Step 2: State changes (reads/writes)
  if (changes.length > 0) {
    const changeSteps = buildStateChangeSteps(changes, stepIndex, storageGas);
    steps.push(...changeSteps);
    stepIndex += changeSteps.length;
  }

  // Step 3: Events
  if (events.length > 0) {
    const gasPerEvent = Math.floor(eventGas / events.length);
    const eventSteps = buildEventSteps(events, stepIndex, gasPerEvent);
    steps.push(...eventSteps);
    stepIndex += eventSteps.length;
  }

  // Step 4: If failed, add abort step
  if (!success) {
    steps.push({
      index: stepIndex,
      type: 'ABORT',
      module: entryMatch ? `${entryMatch[1]}::${entryMatch[2]}` : 'unknown',
      function: entryMatch?.[3],
      description: 'Transaction aborted',
      gasUsed: 0,
      cumulativeGas: totalGas,
    });
  }

  // Build call graph
  const callGraph = buildCallGraph(entryFunction, events, changes, totalGas);

  return {
    entryFunction,
    totalGas,
    executionTimeEstimateMs: Math.ceil(totalGas / 1000), // Rough estimate
    steps,
    callGraph,
    // Mark this trace as reconstructed/approximated since it's built from API data
    traceSource: {
      type: 'api_reconstructed',
      isApproximated: true,
      message: 'Gas per step is estimated. Use CLI simulation with --profile-gas for real execution traces.',
    },
  };
}

/**
 * Build enhanced gas breakdown from events and changes
 */
export function buildEnhancedGasBreakdown(
  events: SimulationEvent[],
  changes: StateChange[],
  totalGas: number
): GasBreakdown {
  // Estimate gas distribution
  const eventGas = events.length * GAS_ESTIMATES.EVENT_EMIT;
  const storageGas = changes.reduce((sum, c) => {
    return sum + (c.type === 'create' ? GAS_ESTIMATES.RESOURCE_CREATE : GAS_ESTIMATES.RESOURCE_WRITE);
  }, 0);
  const ioGas = changes.length * GAS_ESTIMATES.RESOURCE_READ;
  const intrinsicGas = GAS_ESTIMATES.INTRINSIC_BASE;
  const dependencyGas = GAS_ESTIMATES.DEPENDENCY_LOAD * 2; // Assume 2 dependencies on average
  const executionGas = Math.max(0, totalGas - eventGas - storageGas - ioGas - intrinsicGas - dependencyGas);

  // Build operations list
  const operations: GasOperation[] = [];
  let idx = 0;

  // Entry function
  operations.push({
    operation: 'call',
    function: 'entry',
    gasUsed: executionGas,
    percentage: Math.round((executionGas / totalGas) * 100),
    depth: 0,
  });

  // Group changes by module
  const moduleChanges: Map<string, { count: number; gas: number }> = new Map();
  for (const change of changes) {
    const parsed = parseTypePath(change.resource);
    const module = parsed ? `${parsed.moduleAddress}::${parsed.moduleName}` : 'unknown';
    if (!moduleChanges.has(module)) {
      moduleChanges.set(module, { count: 0, gas: 0 });
    }
    const data = moduleChanges.get(module)!;
    data.count++;
    data.gas += change.type === 'create' ? GAS_ESTIMATES.RESOURCE_CREATE : GAS_ESTIMATES.RESOURCE_WRITE;
  }

  for (const [module, data] of moduleChanges) {
    operations.push({
      operation: 'write_resource',
      module,
      gasUsed: data.gas,
      percentage: Math.round((data.gas / totalGas) * 100),
      depth: 1,
    });
  }

  // Events
  if (events.length > 0) {
    operations.push({
      operation: 'emit_events',
      gasUsed: eventGas,
      percentage: Math.round((eventGas / totalGas) * 100),
      depth: 1,
    });
  }

  return {
    total: totalGas,
    computation: executionGas + intrinsicGas,
    storage: storageGas,
    operations,
    byCategory: {
      execution: executionGas,
      io: ioGas,
      storage: storageGas,
      intrinsic: intrinsicGas,
      dependencies: dependencyGas,
    },
  };
}

/**
 * Generate warnings based on simulation analysis
 */
export function generateWarnings(
  events: SimulationEvent[],
  changes: StateChange[],
  gasUsed: number,
  maxGas: number
): SimulationWarning[] {
  const warnings: SimulationWarning[] = [];

  // High gas usage warning
  const gasRatio = gasUsed / maxGas;
  if (gasRatio > 0.8) {
    warnings.push({
      code: 'HIGH_GAS_USAGE',
      severity: 'warning',
      message: `Transaction uses ${Math.round(gasRatio * 100)}% of max gas limit`,
      details: 'Consider increasing max_gas_amount or optimizing the transaction',
    });
  }

  // Many state changes warning
  if (changes.length > 10) {
    warnings.push({
      code: 'MANY_STATE_CHANGES',
      severity: 'info',
      message: `Transaction modifies ${changes.length} resources`,
      details: 'Large state changes may increase storage costs',
    });
  }

  // No events warning (might be unexpected)
  if (events.length === 0 && changes.length > 0) {
    warnings.push({
      code: 'NO_EVENTS',
      severity: 'info',
      message: 'Transaction produces no events',
      details: 'Consider emitting events for better observability',
    });
  }

  // Check for large value transfers in coin events
  for (const event of events) {
    if (event.type.includes('WithdrawEvent') || event.type.includes('DepositEvent')) {
      const amount = (event.data as { amount?: string })?.amount;
      if (amount && BigInt(amount) > BigInt('1000000000000')) { // 10,000 MOVE
        warnings.push({
          code: 'LARGE_TRANSFER',
          severity: 'caution',
          message: 'Large token transfer detected',
          details: `Transfer amount: ${(Number(amount) / 100000000).toFixed(2)} tokens`,
        });
        break;
      }
    }
  }

  return warnings;
}

/**
 * Generate recommendations based on simulation
 */
export function generateRecommendations(
  success: boolean,
  gasUsed: number,
  maxGas: number,
  events: SimulationEvent[],
  changes: StateChange[]
): string[] {
  const recommendations: string[] = [];

  if (!success) {
    recommendations.push('Review the error details and fix the issue before submitting the transaction.');
  }

  // Gas optimization
  const gasRatio = gasUsed / maxGas;
  if (gasRatio < 0.3) {
    recommendations.push(`You can reduce max_gas_amount to ~${Math.ceil(gasUsed * 1.5)} to save on gas buffer.`);
  } else if (gasRatio > 0.9) {
    recommendations.push('Increase max_gas_amount to avoid out-of-gas errors in production.');
  }

  // Best practices
  if (changes.length > 0) {
    recommendations.push('Transaction will modify on-chain state. Verify all changes are expected.');
  }

  if (events.some(e => e.type.includes('DepositEvent'))) {
    recommendations.push('Token deposit detected. Verify recipient address is correct.');
  }

  return recommendations;
}

/**
 * Enhance state changes with before/after diff
 * Note: The API doesn't always provide "before" values, so we mark them as unavailable
 */
export function enhanceStateChanges(
  changes: StateChange[],
  rawChanges?: Array<Record<string, unknown>>
): StateChange[] {
  return changes.map((change, idx) => {
    // Try to extract more info from raw changes if available
    const raw = rawChanges?.[idx];

    return {
      ...change,
      // If we have raw data with more context, add it
      before: change.before || (raw?.state_key_hash ? { _note: 'Previous state not available via API' } : undefined),
    };
  });
}

// ============================================================================
// GAS ESTIMATION & OPTIMIZATION
// ============================================================================

/**
 * Calculate gas estimate with confidence intervals
 */
export function calculateGasEstimate(
  gasUsed: number,
  events: SimulationEvent[],
  changes: StateChange[],
  functionPath: string
): GasEstimate {
  // Factors that increase uncertainty
  const factors: string[] = [];
  let uncertaintyMultiplier = 0.1; // Base 10% uncertainty

  // More events = more variability in gas
  if (events.length > 5) {
    factors.push(`High event count (${events.length} events)`);
    uncertaintyMultiplier += 0.05;
  }

  // More state changes = more variability
  if (changes.length > 5) {
    factors.push(`Multiple state changes (${changes.length} resources)`);
    uncertaintyMultiplier += 0.05;
  }

  // Dynamic data structures increase uncertainty
  const hasVectorOps = changes.some(c =>
    JSON.stringify(c.after).includes('[]') ||
    JSON.stringify(c.after).includes('vector')
  );
  if (hasVectorOps) {
    factors.push('Vector/dynamic data operations detected');
    uncertaintyMultiplier += 0.1;
  }

  // Complex nested calls increase uncertainty
  const isComplex = functionPath.includes('swap') ||
    functionPath.includes('liquidate') ||
    functionPath.includes('flash');
  if (isComplex) {
    factors.push('Complex DeFi operation');
    uncertaintyMultiplier += 0.15;
  }

  // Calculate bounds
  const margin = Math.ceil(gasUsed * uncertaintyMultiplier);
  const lower = Math.max(gasUsed - margin, Math.floor(gasUsed * 0.8));
  const upper = gasUsed + margin;

  // Confidence decreases with more uncertainty factors
  const confidence = Math.max(0.7, 0.95 - (factors.length * 0.05));

  return {
    predicted: gasUsed,
    lower,
    upper,
    confidence,
    methodology: 'static',
    factors: factors.length > 0 ? factors : ['Standard transaction with predictable gas usage'],
  };
}

/**
 * Generate smart gas optimization suggestions
 */
export function generateOptimizations(
  gasUsed: number,
  events: SimulationEvent[],
  changes: StateChange[],
  gasBreakdown: GasBreakdown
): GasOptimization[] {
  const optimizations: GasOptimization[] = [];
  let optimizationId = 1;

  // Analyze storage costs
  const storageGas = gasBreakdown.byCategory?.storage || gasBreakdown.storage;
  const storagePercent = (storageGas / gasUsed) * 100;

  if (storagePercent > 50) {
    optimizations.push({
      id: `opt-${optimizationId++}`,
      category: 'storage',
      severity: 'warning',
      title: 'High Storage Cost',
      description: `Storage operations consume ${storagePercent.toFixed(1)}% of total gas (${storageGas.toLocaleString()} gas units).`,
      potentialSavings: Math.floor(storageGas * 0.3),
      potentialSavingsPercent: Math.floor(storagePercent * 0.3),
      recommendation: 'Consider batching resource updates or using more compact data structures to reduce storage costs.',
    });
  }

  // Check for multiple writes to same module
  const moduleWrites: Record<string, number> = {};
  for (const change of changes) {
    const parsed = parseTypePath(change.resource);
    if (parsed) {
      const module = `${parsed.moduleAddress}::${parsed.moduleName}`;
      moduleWrites[module] = (moduleWrites[module] || 0) + 1;
    }
  }

  for (const [module, count] of Object.entries(moduleWrites)) {
    if (count > 3) {
      optimizations.push({
        id: `opt-${optimizationId++}`,
        category: 'io',
        severity: 'suggestion',
        title: 'Multiple Resource Updates',
        description: `${count} separate writes to ${module.split('::').pop()} resources.`,
        potentialSavings: (count - 1) * GAS_ESTIMATES.RESOURCE_WRITE * 0.3,
        potentialSavingsPercent: Math.floor(((count - 1) * GAS_ESTIMATES.RESOURCE_WRITE * 0.3 / gasUsed) * 100),
        codeLocation: { module, operation: 'write_resource' },
        recommendation: 'Consider combining multiple resource updates into a single operation where possible.',
      });
    }
  }

  // Check for many events
  if (events.length > 10) {
    const eventGas = events.length * GAS_ESTIMATES.EVENT_EMIT;
    optimizations.push({
      id: `opt-${optimizationId++}`,
      category: 'io',
      severity: 'info',
      title: 'High Event Count',
      description: `Transaction emits ${events.length} events (${eventGas.toLocaleString()} gas).`,
      potentialSavings: Math.floor(eventGas * 0.2),
      potentialSavingsPercent: Math.floor((eventGas * 0.2 / gasUsed) * 100),
      recommendation: 'Consider aggregating related events into fewer, richer events if downstream consumers allow.',
    });
  }

  // Check for resource creation vs modification
  const creations = changes.filter(c => c.type === 'create').length;
  if (creations > 2) {
    const creationGas = creations * GAS_ESTIMATES.RESOURCE_CREATE;
    optimizations.push({
      id: `opt-${optimizationId++}`,
      category: 'storage',
      severity: 'suggestion',
      title: 'Multiple Resource Creations',
      description: `Creating ${creations} new resources (${creationGas.toLocaleString()} gas).`,
      potentialSavings: Math.floor(creationGas * 0.2),
      potentialSavingsPercent: Math.floor((creationGas * 0.2 / gasUsed) * 100),
      recommendation: 'If these resources are related, consider using a single composite resource instead of multiple separate ones.',
    });
  }

  // Check gas unit price efficiency
  const executionGas = gasBreakdown.byCategory?.execution || gasBreakdown.computation;
  if (executionGas > gasUsed * 0.4 && gasUsed > 5000) {
    optimizations.push({
      id: `opt-${optimizationId++}`,
      category: 'computation',
      severity: 'info',
      title: 'Computation-Heavy Transaction',
      description: `Execution uses ${((executionGas / gasUsed) * 100).toFixed(1)}% of gas.`,
      recommendation: 'For frequently called functions, consider off-chain computation with on-chain verification where appropriate.',
    });
  }

  // Add general optimization tip if gas is high but no specific issues
  if (optimizations.length === 0 && gasUsed > 3000) {
    optimizations.push({
      id: `opt-${optimizationId++}`,
      category: 'pattern',
      severity: 'info',
      title: 'Gas Usage Analysis',
      description: `Transaction uses ${gasUsed.toLocaleString()} gas units with a healthy distribution.`,
      recommendation: 'Gas usage is reasonable. For further optimization, consider profiling with --profile-gas flag.',
    });
  }

  return optimizations;
}

/**
 * Calculate gas efficiency score compared to benchmarks (sync fallback version)
 * Use calculateEfficiencyScoreAsync for real network benchmarks
 */
export function calculateEfficiencyScore(
  gasUsed: number,
  functionPath: string,
  gasBreakdown: GasBreakdown
): GasEfficiencyScore {
  // Extract function name for benchmark lookup
  const fnMatch = functionPath.match(/::(\w+)::(\w+)$/);
  const fnKey = fnMatch ? `${fnMatch[1]}::${fnMatch[2]}` : 'default';

  // Get fallback benchmark
  const benchmark = FALLBACK_BENCHMARKS[fnKey] || FALLBACK_BENCHMARKS['default'];

  // Calculate percentile (lower gas = better percentile)
  let percentile: number;
  if (gasUsed <= benchmark.median) {
    percentile = 50 + ((benchmark.median - gasUsed) / benchmark.median) * 40;
  } else if (gasUsed <= benchmark.avg) {
    percentile = 30 + ((benchmark.avg - gasUsed) / (benchmark.avg - benchmark.median)) * 20;
  } else if (gasUsed <= benchmark.p90) {
    percentile = 10 + ((benchmark.p90 - gasUsed) / (benchmark.p90 - benchmark.avg)) * 20;
  } else {
    percentile = Math.max(1, 10 - ((gasUsed - benchmark.p90) / benchmark.p90) * 10);
  }
  percentile = Math.min(99, Math.max(1, Math.round(percentile)));

  // Calculate overall score (0-100)
  const efficiencyRatio = benchmark.median / Math.max(gasUsed, 1);
  const score = Math.min(100, Math.round(efficiencyRatio * 80 + 20));

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  // Calculate component efficiencies
  const storageGas = gasBreakdown.byCategory?.storage || gasBreakdown.storage;
  const computeGas = gasBreakdown.byCategory?.execution || gasBreakdown.computation;
  const ioGas = gasBreakdown.byCategory?.io || 0;

  // Efficiency = (expected / actual) * 100, capped at 100
  const storageEfficiency = Math.min(100, Math.round((benchmark.median * 0.35) / Math.max(storageGas, 1) * 100));
  const computeEfficiency = Math.min(100, Math.round((benchmark.median * 0.50) / Math.max(computeGas, 1) * 100));
  const ioEfficiency = Math.min(100, Math.round((benchmark.median * 0.15) / Math.max(ioGas, 1) * 100));

  return {
    score,
    grade,
    comparison: {
      percentile,
      averageForType: benchmark.avg,
      medianForType: benchmark.median,
      isEstimate: true, // Flag that this uses fallback data
    },
    breakdown: {
      computeEfficiency,
      storageEfficiency,
      ioEfficiency,
    },
  };
}

/**
 * Calculate gas efficiency score using real network benchmarks
 */
export async function calculateEfficiencyScoreAsync(
  network: Network,
  gasUsed: number,
  functionPath: string,
  gasBreakdown: GasBreakdown
): Promise<GasEfficiencyScore> {
  try {
    // Get real efficiency score from benchmark service
    const result = await calculateRealEfficiencyScore(network, functionPath, gasUsed);

    // Calculate component efficiencies using real benchmark
    const storageGas = gasBreakdown.byCategory?.storage || gasBreakdown.storage;
    const computeGas = gasBreakdown.byCategory?.execution || gasBreakdown.computation;
    const ioGas = gasBreakdown.byCategory?.io || 0;

    const benchmark = result.benchmark;
    const storageEfficiency = Math.min(100, Math.round((benchmark.median * 0.35) / Math.max(storageGas, 1) * 100));
    const computeEfficiency = Math.min(100, Math.round((benchmark.median * 0.50) / Math.max(computeGas, 1) * 100));
    const ioEfficiency = Math.min(100, Math.round((benchmark.median * 0.15) / Math.max(ioGas, 1) * 100));

    return {
      score: result.score,
      grade: result.grade,
      comparison: {
        percentile: result.percentile,
        averageForType: benchmark.avg,
        medianForType: benchmark.median,
        sampleSize: benchmark.sampleSize,
        isEstimate: !result.isRealData,
      },
      breakdown: {
        computeEfficiency,
        storageEfficiency,
        ioEfficiency,
      },
    };
  } catch (error) {
    console.warn('[TraceBuilder] Failed to get real benchmarks, using fallback:', error);
    // Fall back to sync version
    return calculateEfficiencyScore(gasUsed, functionPath, gasBreakdown);
  }
}

/**
 * Calculate storage cost projections
 */
export function calculateStorageCosts(
  changes: StateChange[],
  gasUnitPrice: number = 100
): StorageCostProjection {
  let bytesAllocated = 0;
  let bytesFreed = 0;
  let newResourcesCreated = 0;
  let resourcesDeleted = 0;

  for (const change of changes) {
    if (change.type === 'create') {
      newResourcesCreated++;
      // Estimate bytes from JSON stringified data
      const afterSize = change.after ? JSON.stringify(change.after).length : 100;
      bytesAllocated += afterSize;
    } else if (change.type === 'delete') {
      resourcesDeleted++;
      const beforeSize = change.before ? JSON.stringify(change.before).length : 100;
      bytesFreed += beforeSize;
    } else if (change.type === 'modify') {
      const beforeSize = change.before ? JSON.stringify(change.before).length : 0;
      const afterSize = change.after ? JSON.stringify(change.after).length : 0;
      const sizeDiff = afterSize - beforeSize;
      if (sizeDiff > 0) {
        bytesAllocated += sizeDiff;
      } else {
        bytesFreed += Math.abs(sizeDiff);
      }
    }
  }

  // Calculate gas costs (10 gas per byte is approximate)
  const allocationCost = bytesAllocated * GAS_ESTIMATES.STORAGE_PER_BYTE;
  const deallocationRefund = Math.floor(bytesFreed * GAS_ESTIMATES.STORAGE_PER_BYTE * 0.5); // 50% refund
  const netStorageCost = allocationCost - deallocationRefund;

  // Convert to MOVE (8 decimals, with gas unit price)
  const gasToMove = (gas: number) => {
    const moveAmount = (gas * gasUnitPrice) / 100000000;
    return moveAmount.toFixed(6);
  };

  return {
    allocationCost,
    allocationCostMove: gasToMove(allocationCost),
    deallocationRefund,
    deallocationRefundMove: gasToMove(deallocationRefund),
    netStorageCost,
    newResourcesCreated,
    resourcesDeleted,
    bytesAllocated,
    bytesFreed,
  };
}

/**
 * Build complete enhanced gas breakdown with all optimization data (sync version)
 * Use buildCompleteGasBreakdownAsync for real network benchmarks
 */
export function buildCompleteGasBreakdown(
  events: SimulationEvent[],
  changes: StateChange[],
  totalGas: number,
  functionPath: string,
  gasUnitPrice: number = 100
): GasBreakdown {
  // Get basic breakdown first
  const basicBreakdown = buildEnhancedGasBreakdown(events, changes, totalGas);

  // Add confidence intervals
  const estimate = calculateGasEstimate(totalGas, events, changes, functionPath);

  // Generate optimization suggestions
  const optimizations = generateOptimizations(totalGas, events, changes, basicBreakdown);

  // Calculate efficiency score (using fallback benchmarks)
  const efficiencyScore = calculateEfficiencyScore(totalGas, functionPath, basicBreakdown);

  // Calculate storage costs
  const storageCosts = calculateStorageCosts(changes, gasUnitPrice);

  return {
    ...basicBreakdown,
    estimate,
    optimizations: optimizations.length > 0 ? optimizations : undefined,
    efficiencyScore,
    storageCosts,
  };
}

/**
 * Build complete enhanced gas breakdown with real network benchmarks
 */
export async function buildCompleteGasBreakdownAsync(
  network: Network,
  events: SimulationEvent[],
  changes: StateChange[],
  totalGas: number,
  functionPath: string,
  gasUnitPrice: number = 100
): Promise<GasBreakdown> {
  // Get basic breakdown first
  const basicBreakdown = buildEnhancedGasBreakdown(events, changes, totalGas);

  // Add confidence intervals
  const estimate = calculateGasEstimate(totalGas, events, changes, functionPath);

  // Generate optimization suggestions
  const optimizations = generateOptimizations(totalGas, events, changes, basicBreakdown);

  // Calculate efficiency score using real network benchmarks
  const efficiencyScore = await calculateEfficiencyScoreAsync(
    network,
    totalGas,
    functionPath,
    basicBreakdown
  );

  // Calculate storage costs
  const storageCosts = calculateStorageCosts(changes, gasUnitPrice);

  return {
    ...basicBreakdown,
    estimate,
    optimizations: optimizations.length > 0 ? optimizations : undefined,
    efficiencyScore,
    storageCosts,
  };
}
