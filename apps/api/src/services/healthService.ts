/**
 * Health Check Service
 *
 * Provides health and readiness endpoints for container orchestration.
 * Includes metrics for monitoring system state.
 */

import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { getMovementClient } from '../lib/movement.js';
import { getQueueStats, getBackpressureStatus, type BackpressureStatus } from './notificationQueue.js';
import { getAllCircuitStatus, type CircuitState } from '../lib/circuitBreaker.js';

// Health check cache to prevent hammering dependencies
const HEALTH_CACHE_TTL_MS = 5000;
let lastHealthCheck: { result: HealthCheckResult; timestamp: number } | null = null;

/**
 * Health status for a dependency
 */
export interface DependencyHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs?: number;
  message?: string;
  lastError?: string;
}

/**
 * Overall health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  dependencies: {
    database: DependencyHealth;
    redis: DependencyHealth;
    movementNetwork: DependencyHealth;
  };
  queues?: {
    notifications: { pending: number; processing: number; deadLetter: number };
  };
  circuitBreakers?: Record<string, {
    state: CircuitState;
    failureCount: number;
    lastStateChange: string;
  }>;
  backpressure?: {
    notifications: BackpressureStatus;
  };
}

/**
 * System metrics for monitoring
 */
export interface SystemMetrics {
  timestamp: string;
  process: {
    memoryUsageMb: number;
    cpuUsagePercent: number;
    uptime: number;
    pid: number;
  };
  queues: {
    notificationsPending: number;
    notificationsProcessing: number;
    notificationsDeadLetter: number;
  };
  database: {
    activeConnections?: number;
    maxConnections?: number;
  };
}

// Track process start time
const processStartTime = Date.now();

/**
 * Get application version from package.json
 */
function getVersion(): string {
  return process.env.npm_package_version || '1.0.0';
}

/**
 * Check database health
 */
async function checkDatabase(): Promise<DependencyHealth> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: 'Database connection failed',
      lastError: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis health
 */
async function checkRedis(): Promise<DependencyHealth> {
  const start = Date.now();
  try {
    const pong = await redis.ping();
    if (pong === 'PONG') {
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
      };
    }
    return {
      status: 'degraded',
      latencyMs: Date.now() - start,
      message: `Unexpected ping response: ${pong}`,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: 'Redis connection failed',
      lastError: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Movement Network health (light check using ledger info)
 */
async function checkMovementNetwork(): Promise<DependencyHealth> {
  const start = Date.now();
  try {
    const client = getMovementClient('mainnet');
    await client.getLedgerInfo();
    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    // Network issues are degraded, not unhealthy (external dependency)
    return {
      status: 'degraded',
      latencyMs: Date.now() - start,
      message: 'Movement Network unreachable',
      lastError: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Determine overall status from dependency statuses
 */
function determineOverallStatus(
  dependencies: HealthCheckResult['dependencies']
): 'healthy' | 'unhealthy' | 'degraded' {
  const statuses = Object.values(dependencies).map((d) => d.status);

  // If any critical dependency is unhealthy, system is unhealthy
  if (dependencies.database.status === 'unhealthy') {
    return 'unhealthy';
  }

  // If Redis is unhealthy, system is degraded (can still process requests)
  if (dependencies.redis.status === 'unhealthy') {
    return 'degraded';
  }

  // If any dependency is unhealthy/degraded, system is degraded
  if (statuses.includes('unhealthy') || statuses.includes('degraded')) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * Perform full health check
 */
export async function performHealthCheck(
  includeQueues = true
): Promise<HealthCheckResult> {
  // Check cache
  if (lastHealthCheck && Date.now() - lastHealthCheck.timestamp < HEALTH_CACHE_TTL_MS) {
    return lastHealthCheck.result;
  }

  // Run dependency checks in parallel
  const [database, redisHealth, movementNetwork] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkMovementNetwork(),
  ]);

  const dependencies = {
    database,
    redis: redisHealth,
    movementNetwork,
  };

  let queues: HealthCheckResult['queues'] | undefined;
  if (includeQueues && redisHealth.status !== 'unhealthy') {
    try {
      const notificationStats = await getQueueStats();
      queues = {
        notifications: notificationStats,
      };
    } catch {
      // Ignore queue stat errors
    }
  }

  // Get circuit breaker status
  let circuitBreakers: HealthCheckResult['circuitBreakers'] | undefined;
  if (redisHealth.status !== 'unhealthy') {
    try {
      circuitBreakers = await getAllCircuitStatus();
    } catch {
      // Ignore circuit status errors
    }
  }

  // Get backpressure status
  let backpressure: HealthCheckResult['backpressure'] | undefined;
  if (redisHealth.status !== 'unhealthy') {
    try {
      const notificationBackpressure = await getBackpressureStatus();
      backpressure = {
        notifications: notificationBackpressure,
      };
    } catch {
      // Ignore backpressure status errors
    }
  }

  const result: HealthCheckResult = {
    status: determineOverallStatus(dependencies),
    timestamp: new Date().toISOString(),
    version: getVersion(),
    uptime: Math.floor((Date.now() - processStartTime) / 1000),
    dependencies,
    queues,
    circuitBreakers,
    backpressure,
  };

  // Cache result
  lastHealthCheck = { result, timestamp: Date.now() };

  return result;
}

/**
 * Simple liveness check (is the process alive?)
 */
export function livenessCheck(): { status: 'ok'; timestamp: string } {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Readiness check (can the service handle requests?)
 */
export async function readinessCheck(): Promise<{
  ready: boolean;
  reason?: string;
}> {
  try {
    // Check database is available
    await prisma.$queryRaw`SELECT 1`;
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      reason: 'Database unavailable',
    };
  }
}

/**
 * Get system metrics for monitoring
 */
export async function getSystemMetrics(): Promise<SystemMetrics> {
  const memUsage = process.memoryUsage();

  let queueStats = { pending: 0, processing: 0, deadLetter: 0 };
  try {
    queueStats = await getQueueStats();
  } catch {
    // Ignore errors
  }

  return {
    timestamp: new Date().toISOString(),
    process: {
      memoryUsageMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      cpuUsagePercent: 0, // Would need more sophisticated tracking
      uptime: Math.floor((Date.now() - processStartTime) / 1000),
      pid: process.pid,
    },
    queues: {
      notificationsPending: queueStats.pending,
      notificationsProcessing: queueStats.processing,
      notificationsDeadLetter: queueStats.deadLetter,
    },
    database: {},
  };
}
