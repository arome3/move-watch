/**
 * Metrics Service
 *
 * Tracks transaction success/failure rates and other metrics using Redis.
 * Provides failure rate analytics for monitoring dashboards.
 */

import { redis } from '../lib/redis.js';

// Redis key prefixes
const METRICS_PREFIX = 'metrics:';
const TX_COUNT_PREFIX = `${METRICS_PREFIX}tx:count:`;
const TX_FAIL_PREFIX = `${METRICS_PREFIX}tx:fail:`;
const GAS_SUM_PREFIX = `${METRICS_PREFIX}gas:sum:`;
const GAS_COUNT_PREFIX = `${METRICS_PREFIX}gas:count:`;

// Time bucket durations in seconds
const BUCKET_DURATIONS = {
  minute: 60,
  hour: 3600,
  day: 86400,
};

// How long to keep metrics data
const RETENTION_PERIODS = {
  minute: 60 * 60,        // Keep minute buckets for 1 hour
  hour: 24 * 60 * 60,     // Keep hour buckets for 24 hours
  day: 30 * 24 * 60 * 60, // Keep day buckets for 30 days
};

/**
 * Get the bucket key for a given timestamp and granularity
 */
function getBucketKey(
  prefix: string,
  moduleAddress: string,
  timestamp: number,
  granularity: 'minute' | 'hour' | 'day'
): string {
  const bucketSize = BUCKET_DURATIONS[granularity];
  const bucket = Math.floor(timestamp / 1000 / bucketSize) * bucketSize;
  return `${prefix}${moduleAddress}:${granularity}:${bucket}`;
}

/**
 * Record a transaction for metrics tracking
 */
export async function recordTransaction(
  moduleAddress: string,
  success: boolean,
  gasUsed: number,
  network: string
): Promise<void> {
  const now = Date.now();
  const normalizedAddress = moduleAddress.toLowerCase();
  const key = `${network}:${normalizedAddress}`;

  try {
    // Record in all granularities
    const granularities: Array<'minute' | 'hour' | 'day'> = ['minute', 'hour', 'day'];

    for (const granularity of granularities) {
      const countKey = getBucketKey(TX_COUNT_PREFIX, key, now, granularity);
      const failKey = getBucketKey(TX_FAIL_PREFIX, key, now, granularity);
      const gasSumKey = getBucketKey(GAS_SUM_PREFIX, key, now, granularity);
      const gasCountKey = getBucketKey(GAS_COUNT_PREFIX, key, now, granularity);

      const ttl = RETENTION_PERIODS[granularity];

      // Increment transaction count
      await redis.incr(countKey);
      await redis.expire(countKey, ttl);

      // Increment failure count if failed
      if (!success) {
        await redis.incr(failKey);
        await redis.expire(failKey, ttl);
      }

      // Track gas usage for averages
      await redis.incrbyfloat(gasSumKey, gasUsed);
      await redis.expire(gasSumKey, ttl);
      await redis.incr(gasCountKey);
      await redis.expire(gasCountKey, ttl);
    }

    // Also track global metrics (all modules)
    for (const granularity of granularities) {
      const globalKey = `${network}:_global`;
      const countKey = getBucketKey(TX_COUNT_PREFIX, globalKey, now, granularity);
      const failKey = getBucketKey(TX_FAIL_PREFIX, globalKey, now, granularity);

      const ttl = RETENTION_PERIODS[granularity];

      await redis.incr(countKey);
      await redis.expire(countKey, ttl);

      if (!success) {
        await redis.incr(failKey);
        await redis.expire(failKey, ttl);
      }
    }
  } catch (error) {
    console.error('Error recording transaction metrics:', error);
    // Don't throw - metrics are non-critical
  }
}

/**
 * Failure rate data point
 */
export interface FailureRateDataPoint {
  timestamp: number;
  totalTransactions: number;
  failedTransactions: number;
  failureRate: number; // 0-100 percentage
  avgGasUsed: number;
}

/**
 * Get failure rate metrics for a module over a time period
 */
export async function getFailureRateMetrics(
  moduleAddress: string | null,
  network: string,
  period: '1h' | '24h' | '7d' | '30d'
): Promise<{
  dataPoints: FailureRateDataPoint[];
  summary: {
    totalTransactions: number;
    failedTransactions: number;
    overallFailureRate: number;
    avgGasUsed: number;
  };
}> {
  const now = Date.now();
  const normalizedAddress = moduleAddress?.toLowerCase() || '_global';
  const key = `${network}:${normalizedAddress}`;

  // Determine granularity and range based on period
  let granularity: 'minute' | 'hour' | 'day';
  let numBuckets: number;
  let bucketDuration: number;

  switch (period) {
    case '1h':
      granularity = 'minute';
      numBuckets = 60;
      bucketDuration = BUCKET_DURATIONS.minute * 1000;
      break;
    case '24h':
      granularity = 'hour';
      numBuckets = 24;
      bucketDuration = BUCKET_DURATIONS.hour * 1000;
      break;
    case '7d':
      granularity = 'day';
      numBuckets = 7;
      bucketDuration = BUCKET_DURATIONS.day * 1000;
      break;
    case '30d':
      granularity = 'day';
      numBuckets = 30;
      bucketDuration = BUCKET_DURATIONS.day * 1000;
      break;
    default:
      granularity = 'hour';
      numBuckets = 24;
      bucketDuration = BUCKET_DURATIONS.hour * 1000;
  }

  const dataPoints: FailureRateDataPoint[] = [];
  let totalTransactions = 0;
  let totalFailed = 0;
  let totalGas = 0;
  let gasCount = 0;

  try {
    // Fetch data for each bucket
    for (let i = numBuckets - 1; i >= 0; i--) {
      const bucketTime = now - i * bucketDuration;

      const countKey = getBucketKey(TX_COUNT_PREFIX, key, bucketTime, granularity);
      const failKey = getBucketKey(TX_FAIL_PREFIX, key, bucketTime, granularity);
      const gasSumKey = getBucketKey(GAS_SUM_PREFIX, key, bucketTime, granularity);
      const gasCountKey = getBucketKey(GAS_COUNT_PREFIX, key, bucketTime, granularity);

      const [countStr, failStr, gasSumStr, gasCountStr] = await Promise.all([
        redis.get(countKey),
        redis.get(failKey),
        redis.get(gasSumKey),
        redis.get(gasCountKey),
      ]);

      const count = parseInt(countStr || '0', 10);
      const failed = parseInt(failStr || '0', 10);
      const gasSum = parseFloat(gasSumStr || '0');
      const bucketGasCount = parseInt(gasCountStr || '0', 10);

      const failureRate = count > 0 ? (failed / count) * 100 : 0;
      const avgGas = bucketGasCount > 0 ? gasSum / bucketGasCount : 0;

      dataPoints.push({
        timestamp: Math.floor(bucketTime / bucketDuration) * bucketDuration,
        totalTransactions: count,
        failedTransactions: failed,
        failureRate: Math.round(failureRate * 100) / 100,
        avgGasUsed: Math.round(avgGas),
      });

      totalTransactions += count;
      totalFailed += failed;
      totalGas += gasSum;
      gasCount += bucketGasCount;
    }
  } catch (error) {
    console.error('Error fetching failure rate metrics:', error);
  }

  const overallFailureRate = totalTransactions > 0
    ? Math.round((totalFailed / totalTransactions) * 10000) / 100
    : 0;

  const avgGasUsed = gasCount > 0 ? Math.round(totalGas / gasCount) : 0;

  return {
    dataPoints,
    summary: {
      totalTransactions,
      failedTransactions: totalFailed,
      overallFailureRate,
      avgGasUsed,
    },
  };
}

/**
 * Get real-time failure rate for the last N minutes
 */
export async function getRealtimeFailureRate(
  moduleAddress: string | null,
  network: string,
  minutes: number = 5
): Promise<{
  totalTransactions: number;
  failedTransactions: number;
  failureRate: number;
  trend: 'up' | 'down' | 'stable';
}> {
  const now = Date.now();
  const normalizedAddress = moduleAddress?.toLowerCase() || '_global';
  const key = `${network}:${normalizedAddress}`;

  let currentTotal = 0;
  let currentFailed = 0;
  let previousTotal = 0;
  let previousFailed = 0;

  try {
    // Get current period
    for (let i = 0; i < minutes; i++) {
      const bucketTime = now - i * 60 * 1000;
      const countKey = getBucketKey(TX_COUNT_PREFIX, key, bucketTime, 'minute');
      const failKey = getBucketKey(TX_FAIL_PREFIX, key, bucketTime, 'minute');

      const [countStr, failStr] = await Promise.all([
        redis.get(countKey),
        redis.get(failKey),
      ]);

      currentTotal += parseInt(countStr || '0', 10);
      currentFailed += parseInt(failStr || '0', 10);
    }

    // Get previous period for trend comparison
    for (let i = minutes; i < minutes * 2; i++) {
      const bucketTime = now - i * 60 * 1000;
      const countKey = getBucketKey(TX_COUNT_PREFIX, key, bucketTime, 'minute');
      const failKey = getBucketKey(TX_FAIL_PREFIX, key, bucketTime, 'minute');

      const [countStr, failStr] = await Promise.all([
        redis.get(countKey),
        redis.get(failKey),
      ]);

      previousTotal += parseInt(countStr || '0', 10);
      previousFailed += parseInt(failStr || '0', 10);
    }
  } catch (error) {
    console.error('Error fetching realtime failure rate:', error);
  }

  const currentRate = currentTotal > 0 ? (currentFailed / currentTotal) * 100 : 0;
  const previousRate = previousTotal > 0 ? (previousFailed / previousTotal) * 100 : 0;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (currentRate > previousRate + 5) {
    trend = 'up';
  } else if (currentRate < previousRate - 5) {
    trend = 'down';
  }

  return {
    totalTransactions: currentTotal,
    failedTransactions: currentFailed,
    failureRate: Math.round(currentRate * 100) / 100,
    trend,
  };
}

/**
 * Get top failing modules
 */
export async function getTopFailingModules(
  network: string,
  period: '1h' | '24h' | '7d',
  limit: number = 10
): Promise<Array<{
  moduleAddress: string;
  totalTransactions: number;
  failedTransactions: number;
  failureRate: number;
}>> {
  // This would require scanning Redis keys or maintaining a sorted set
  // For now, return empty - would need additional tracking for production
  console.log(`getTopFailingModules called for ${network}, ${period}, limit ${limit}`);
  return [];
}
