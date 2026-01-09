/**
 * Gas Benchmark Service
 * Fetches and caches real gas usage statistics from the network
 *
 * Instead of using hardcoded benchmarks, this service queries actual
 * transaction data from the Movement/Aptos indexer to calculate
 * real gas usage percentiles for different function types.
 */

import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { NETWORK_CONFIGS, type Network as MoveNetwork } from '@movewatch/shared';

export interface GasBenchmark {
  functionKey: string;
  sampleSize: number;
  avg: number;
  median: number;
  p10: number;
  p90: number;
  min: number;
  max: number;
  lastUpdated: Date;
}

export interface BenchmarkCache {
  benchmarks: Map<string, GasBenchmark>;
  networkStats: NetworkGasStats;
  lastUpdated: Date;
  network: MoveNetwork;
}

export interface NetworkGasStats {
  avgGasPrice: number;
  medianGasPrice: number;
  avgGasUsed: number;
  medianGasUsed: number;
  totalTransactions: number;
  timeWindowHours: number;
}

// Cache duration: 1 hour
const CACHE_DURATION_MS = 60 * 60 * 1000;

// Minimum sample size for reliable statistics
const MIN_SAMPLE_SIZE = 10;

// Cache per network
const benchmarkCaches: Map<MoveNetwork, BenchmarkCache> = new Map();

// Common function patterns to track
const TRACKED_FUNCTIONS = [
  '0x1::coin::transfer',
  '0x1::aptos_account::transfer',
  '0x1::aptos_account::create_account',
  '0x1::managed_coin::register',
  '0x1::managed_coin::mint',
  '0x1::staking_contract::stake',
  '0x1::staking_contract::unstake',
  '0x3::token::create_token_data_id',
  '0x3::token::mint_token',
  '0x3::token::transfer_with_opt_in',
];

/**
 * Get Aptos client for the specified network
 */
function getClient(network: MoveNetwork): Aptos {
  const networkConfig = NETWORK_CONFIGS[network];
  const aptosConfig = new AptosConfig({
    network: network === 'mainnet' ? Network.MAINNET : Network.TESTNET,
    fullnode: networkConfig.fullnode,
  });
  return new Aptos(aptosConfig);
}

/**
 * Fetch recent transactions for a specific function
 */
async function fetchTransactionsForFunction(
  client: Aptos,
  functionId: string,
  limit: number = 100
): Promise<Array<{ gasUsed: number; gasUnitPrice: number; timestamp: number }>> {
  try {
    // Query transactions using the REST API
    const response = await fetch(
      `${client.config.fullnode}/v1/transactions?limit=${limit}&start=0`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      console.warn(`[GasBenchmark] Failed to fetch transactions: ${response.status}`);
      return [];
    }

    const transactions = (await response.json()) as Record<string, unknown>[];

    // Filter for user transactions with matching function
    const filtered = transactions
      .filter((tx: Record<string, unknown>) => {
        if (tx.type !== 'user_transaction') return false;
        const payload = tx.payload as Record<string, unknown> | undefined;
        if (!payload || payload.type !== 'entry_function_payload') return false;
        const func = payload.function as string | undefined;
        return func && func.includes(functionId.split('::').slice(-2).join('::'));
      })
      .map((tx: Record<string, unknown>) => ({
        gasUsed: Number(tx.gas_used) || 0,
        gasUnitPrice: Number(tx.gas_unit_price) || 100,
        timestamp: Number(tx.timestamp) || Date.now(),
      }))
      .filter((tx: { gasUsed: number }) => tx.gasUsed > 0);

    return filtered;
  } catch (error) {
    console.error(`[GasBenchmark] Error fetching transactions for ${functionId}:`, error);
    return [];
  }
}

/**
 * Fetch general network gas statistics
 */
async function fetchNetworkStats(client: Aptos): Promise<NetworkGasStats> {
  try {
    const response = await fetch(
      `${client.config.fullnode}/v1/transactions?limit=200&start=0`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const transactions = (await response.json()) as Record<string, unknown>[];

    // Filter user transactions only
    const userTxs = transactions.filter(
      (tx: Record<string, unknown>) => tx.type === 'user_transaction' && Number(tx.gas_used) > 0
    );

    if (userTxs.length === 0) {
      return getDefaultNetworkStats();
    }

    const gasPrices = userTxs.map((tx: Record<string, unknown>) => Number(tx.gas_unit_price) || 100);
    const gasUsages = userTxs.map((tx: Record<string, unknown>) => Number(tx.gas_used) || 0);

    return {
      avgGasPrice: Math.round(gasPrices.reduce((a: number, b: number) => a + b, 0) / gasPrices.length),
      medianGasPrice: calculateMedian(gasPrices),
      avgGasUsed: Math.round(gasUsages.reduce((a: number, b: number) => a + b, 0) / gasUsages.length),
      medianGasUsed: calculateMedian(gasUsages),
      totalTransactions: userTxs.length,
      timeWindowHours: 24,
    };
  } catch (error) {
    console.error('[GasBenchmark] Error fetching network stats:', error);
    return getDefaultNetworkStats();
  }
}

/**
 * Calculate statistics from a list of gas values
 */
function calculateStats(values: number[]): Omit<GasBenchmark, 'functionKey' | 'lastUpdated'> {
  if (values.length === 0) {
    return {
      sampleSize: 0,
      avg: 0,
      median: 0,
      p10: 0,
      p90: 0,
      min: 0,
      max: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  return {
    sampleSize: n,
    avg: Math.round(values.reduce((a, b) => a + b, 0) / n),
    median: calculateMedian(values),
    p10: sorted[Math.floor(n * 0.1)] || sorted[0],
    p90: sorted[Math.floor(n * 0.9)] || sorted[n - 1],
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/**
 * Calculate median of an array
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Get default network stats when API fails
 */
function getDefaultNetworkStats(): NetworkGasStats {
  return {
    avgGasPrice: 100,
    medianGasPrice: 100,
    avgGasUsed: 1500,
    medianGasUsed: 1200,
    totalTransactions: 0,
    timeWindowHours: 24,
  };
}

/**
 * Get default benchmark when no real data is available
 * Based on reasonable estimates for Move transactions
 */
function getDefaultBenchmark(functionKey: string): GasBenchmark {
  // Base estimates that scale with complexity
  const baseEstimates: Record<string, { avg: number; median: number; p90: number }> = {
    'coin::transfer': { avg: 700, median: 650, p90: 1000 },
    'aptos_account::transfer': { avg: 800, median: 750, p90: 1100 },
    'aptos_account::create_account': { avg: 1200, median: 1100, p90: 1600 },
    'managed_coin::register': { avg: 900, median: 850, p90: 1200 },
    'managed_coin::mint': { avg: 1100, median: 1000, p90: 1500 },
    'staking_contract::stake': { avg: 2200, median: 2000, p90: 3000 },
    'staking_contract::unstake': { avg: 2000, median: 1800, p90: 2800 },
    'token::create_token_data_id': { avg: 2500, median: 2300, p90: 3500 },
    'token::mint_token': { avg: 2800, median: 2500, p90: 4000 },
    'token::transfer_with_opt_in': { avg: 1500, median: 1400, p90: 2200 },
  };

  // Find matching base estimate
  const fnParts = functionKey.split('::');
  const shortKey = fnParts.slice(-2).join('::');
  const base = baseEstimates[shortKey] || { avg: 1500, median: 1200, p90: 2500 };

  return {
    functionKey,
    sampleSize: 0, // Indicates this is an estimate, not real data
    avg: base.avg,
    median: base.median,
    p10: Math.round(base.median * 0.6),
    p90: base.p90,
    min: Math.round(base.median * 0.5),
    max: Math.round(base.p90 * 1.5),
    lastUpdated: new Date(),
  };
}

/**
 * Refresh benchmarks for a network
 */
async function refreshBenchmarks(network: MoveNetwork): Promise<BenchmarkCache> {
  console.log(`[GasBenchmark] Refreshing benchmarks for ${network}...`);
  const client = getClient(network);

  // Fetch network-wide stats
  const networkStats = await fetchNetworkStats(client);

  // Fetch benchmarks for tracked functions
  const benchmarks = new Map<string, GasBenchmark>();

  for (const functionId of TRACKED_FUNCTIONS) {
    const transactions = await fetchTransactionsForFunction(client, functionId, 100);

    if (transactions.length >= MIN_SAMPLE_SIZE) {
      const gasValues = transactions.map(tx => tx.gasUsed);
      const stats = calculateStats(gasValues);

      benchmarks.set(functionId, {
        functionKey: functionId,
        ...stats,
        lastUpdated: new Date(),
      });

      console.log(`[GasBenchmark] ${functionId}: ${stats.sampleSize} samples, median=${stats.median}`);
    } else {
      // Use default with note about low sample size
      const defaultBenchmark = getDefaultBenchmark(functionId);
      benchmarks.set(functionId, defaultBenchmark);
      console.log(`[GasBenchmark] ${functionId}: Using defaults (only ${transactions.length} samples found)`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const cache: BenchmarkCache = {
    benchmarks,
    networkStats,
    lastUpdated: new Date(),
    network,
  };

  benchmarkCaches.set(network, cache);
  console.log(`[GasBenchmark] Refresh complete for ${network}. ${benchmarks.size} functions tracked.`);

  return cache;
}

/**
 * Get benchmark cache for a network (refreshes if stale)
 */
export async function getBenchmarkCache(network: MoveNetwork): Promise<BenchmarkCache> {
  const existing = benchmarkCaches.get(network);

  // Check if cache exists and is fresh
  if (existing && Date.now() - existing.lastUpdated.getTime() < CACHE_DURATION_MS) {
    return existing;
  }

  // Refresh in background if stale, return existing while refreshing
  if (existing) {
    refreshBenchmarks(network).catch(err => {
      console.error('[GasBenchmark] Background refresh failed:', err);
    });
    return existing;
  }

  // First load - must wait for refresh
  return refreshBenchmarks(network);
}

/**
 * Get benchmark for a specific function
 */
export async function getBenchmark(
  network: MoveNetwork,
  functionPath: string
): Promise<GasBenchmark> {
  const cache = await getBenchmarkCache(network);

  // Try exact match first
  if (cache.benchmarks.has(functionPath)) {
    return cache.benchmarks.get(functionPath)!;
  }

  // Try partial match (module::function)
  const fnParts = functionPath.split('::');
  if (fnParts.length >= 2) {
    const shortKey = fnParts.slice(-2).join('::');
    for (const [key, benchmark] of cache.benchmarks) {
      if (key.includes(shortKey)) {
        return benchmark;
      }
    }
  }

  // Return default benchmark based on network stats
  return getDefaultBenchmarkFromNetworkStats(functionPath, cache.networkStats);
}

/**
 * Create a default benchmark scaled to network statistics
 */
function getDefaultBenchmarkFromNetworkStats(
  functionKey: string,
  stats: NetworkGasStats
): GasBenchmark {
  // Use network median as base, with scaling factor based on function type
  const base = getDefaultBenchmark(functionKey);

  // If we have real network data, scale accordingly
  if (stats.totalTransactions > 0) {
    const scaleFactor = stats.medianGasUsed / 1200; // 1200 is our baseline median
    return {
      ...base,
      avg: Math.round(base.avg * scaleFactor),
      median: Math.round(base.median * scaleFactor),
      p10: Math.round(base.p10 * scaleFactor),
      p90: Math.round(base.p90 * scaleFactor),
      min: Math.round(base.min * scaleFactor),
      max: Math.round(base.max * scaleFactor),
    };
  }

  return base;
}

/**
 * Get network gas statistics
 */
export async function getNetworkStats(network: MoveNetwork): Promise<NetworkGasStats> {
  const cache = await getBenchmarkCache(network);
  return cache.networkStats;
}

/**
 * Force refresh benchmarks for a network
 */
export async function forceRefreshBenchmarks(network: MoveNetwork): Promise<BenchmarkCache> {
  return refreshBenchmarks(network);
}

/**
 * Get all benchmarks for a network
 */
export async function getAllBenchmarks(network: MoveNetwork): Promise<GasBenchmark[]> {
  const cache = await getBenchmarkCache(network);
  return Array.from(cache.benchmarks.values());
}

/**
 * Calculate efficiency score using real benchmarks
 */
export async function calculateRealEfficiencyScore(
  network: MoveNetwork,
  functionPath: string,
  gasUsed: number
): Promise<{
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  percentile: number;
  benchmark: GasBenchmark;
  isRealData: boolean;
}> {
  const benchmark = await getBenchmark(network, functionPath);
  const isRealData = benchmark.sampleSize >= MIN_SAMPLE_SIZE;

  // Calculate percentile based on where gasUsed falls in the distribution
  let percentile: number;
  if (gasUsed <= benchmark.p10) {
    percentile = 90 + ((benchmark.p10 - gasUsed) / benchmark.p10) * 9;
  } else if (gasUsed <= benchmark.median) {
    percentile = 50 + ((benchmark.median - gasUsed) / (benchmark.median - benchmark.p10)) * 40;
  } else if (gasUsed <= benchmark.avg) {
    percentile = 30 + ((benchmark.avg - gasUsed) / (benchmark.avg - benchmark.median)) * 20;
  } else if (gasUsed <= benchmark.p90) {
    percentile = 10 + ((benchmark.p90 - gasUsed) / (benchmark.p90 - benchmark.avg)) * 20;
  } else {
    percentile = Math.max(1, 10 - ((gasUsed - benchmark.p90) / benchmark.p90) * 10);
  }
  percentile = Math.min(99, Math.max(1, Math.round(percentile)));

  // Score based on how close to median (lower is better)
  const efficiencyRatio = benchmark.median / Math.max(gasUsed, 1);
  const score = Math.min(100, Math.round(efficiencyRatio * 80 + 20));

  // Grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  return {
    score,
    grade,
    percentile,
    benchmark,
    isRealData,
  };
}
