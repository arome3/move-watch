/**
 * Circuit Breaker Implementation
 *
 * Prevents cascading failures by temporarily disabling calls to failing services.
 * Uses the standard circuit breaker pattern with three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 */

import { redis } from './redis.js';

// Circuit breaker states
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Successes in half-open to close
  resetTimeoutMs: number; // Time before trying half-open
  halfOpenMaxAttempts?: number; // Max concurrent attempts in half-open
}

// Circuit state stored in Redis
interface CircuitStateData {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastStateChange: number;
}

// Redis key prefix for circuit state
const CIRCUIT_STATE_PREFIX = 'circuit:';

// Default configurations for different services
export const CIRCUIT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  movement_mainnet: {
    name: 'movement_mainnet',
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 30000, // 30 seconds
    halfOpenMaxAttempts: 1,
  },
  movement_testnet: {
    name: 'movement_testnet',
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 1,
  },
  discord: {
    name: 'discord',
    failureThreshold: 3,
    successThreshold: 1,
    resetTimeoutMs: 60000, // 1 minute
    halfOpenMaxAttempts: 1,
  },
  slack: {
    name: 'slack',
    failureThreshold: 3,
    successThreshold: 1,
    resetTimeoutMs: 60000,
    halfOpenMaxAttempts: 1,
  },
  telegram: {
    name: 'telegram',
    failureThreshold: 3,
    successThreshold: 1,
    resetTimeoutMs: 60000,
    halfOpenMaxAttempts: 1,
  },
  webhook: {
    name: 'webhook',
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 120000, // 2 minutes
    halfOpenMaxAttempts: 1,
  },
  email: {
    name: 'email',
    failureThreshold: 3,
    successThreshold: 1,
    resetTimeoutMs: 60000,
    halfOpenMaxAttempts: 1,
  },
};

/**
 * Get the current state of a circuit
 */
async function getCircuitState(name: string): Promise<CircuitStateData> {
  const key = `${CIRCUIT_STATE_PREFIX}${name}`;
  try {
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Redis error, default to closed
  }

  // Default state: closed
  return {
    state: 'CLOSED',
    failureCount: 0,
    successCount: 0,
    lastFailureTime: 0,
    lastStateChange: Date.now(),
  };
}

/**
 * Update circuit state in Redis
 */
async function setCircuitState(name: string, state: CircuitStateData): Promise<void> {
  const key = `${CIRCUIT_STATE_PREFIX}${name}`;
  try {
    // Keep state for 1 hour (will reset if not accessed)
    await redis.setex(key, 3600, JSON.stringify(state));
  } catch (error) {
    console.warn(`[CircuitBreaker] Failed to persist state for ${name}:`, error);
  }
}

/**
 * Circuit Breaker Error
 */
export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly retryAfterMs: number
  ) {
    super(`Circuit ${circuitName} is OPEN. Retry after ${retryAfterMs}ms`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Execute a function with circuit breaker protection
 *
 * @param config - Circuit breaker configuration
 * @param fn - The function to execute
 * @returns The result of the function
 * @throws CircuitOpenError if circuit is open
 */
export async function withCircuitBreaker<T>(
  config: CircuitBreakerConfig,
  fn: () => Promise<T>
): Promise<T> {
  const state = await getCircuitState(config.name);
  const now = Date.now();

  // Check if we should transition from OPEN to HALF_OPEN
  if (state.state === 'OPEN') {
    const timeSinceFailure = now - state.lastFailureTime;
    if (timeSinceFailure >= config.resetTimeoutMs) {
      // Transition to half-open
      state.state = 'HALF_OPEN';
      state.successCount = 0;
      state.lastStateChange = now;
      await setCircuitState(config.name, state);
      console.log(`[CircuitBreaker] ${config.name}: OPEN -> HALF_OPEN`);
    } else {
      // Still open, reject immediately
      const retryAfter = config.resetTimeoutMs - timeSinceFailure;
      throw new CircuitOpenError(config.name, retryAfter);
    }
  }

  // Execute the function
  try {
    const result = await fn();

    // Success - update state
    if (state.state === 'HALF_OPEN') {
      state.successCount++;
      if (state.successCount >= config.successThreshold) {
        // Transition to closed
        state.state = 'CLOSED';
        state.failureCount = 0;
        state.successCount = 0;
        state.lastStateChange = now;
        console.log(`[CircuitBreaker] ${config.name}: HALF_OPEN -> CLOSED`);
      }
    } else if (state.state === 'CLOSED') {
      // Reset failure count on success
      if (state.failureCount > 0) {
        state.failureCount = 0;
      }
    }

    await setCircuitState(config.name, state);
    return result;
  } catch (error) {
    // Failure - update state
    state.failureCount++;
    state.lastFailureTime = now;

    if (state.state === 'HALF_OPEN') {
      // Any failure in half-open returns to open
      state.state = 'OPEN';
      state.lastStateChange = now;
      console.log(`[CircuitBreaker] ${config.name}: HALF_OPEN -> OPEN (failure in recovery)`);
    } else if (state.state === 'CLOSED' && state.failureCount >= config.failureThreshold) {
      // Too many failures, open the circuit
      state.state = 'OPEN';
      state.lastStateChange = now;
      console.log(
        `[CircuitBreaker] ${config.name}: CLOSED -> OPEN ` +
          `(${state.failureCount} failures >= ${config.failureThreshold})`
      );
    }

    await setCircuitState(config.name, state);
    throw error;
  }
}

/**
 * Get all circuit breaker statuses (for health checks/monitoring)
 */
export async function getAllCircuitStatus(): Promise<
  Record<string, { state: CircuitState; failureCount: number; lastStateChange: string }>
> {
  const result: Record<string, { state: CircuitState; failureCount: number; lastStateChange: string }> = {};

  for (const name of Object.keys(CIRCUIT_CONFIGS)) {
    try {
      const state = await getCircuitState(name);
      result[name] = {
        state: state.state,
        failureCount: state.failureCount,
        lastStateChange: new Date(state.lastStateChange).toISOString(),
      };
    } catch {
      result[name] = {
        state: 'CLOSED',
        failureCount: 0,
        lastStateChange: new Date().toISOString(),
      };
    }
  }

  return result;
}

/**
 * Reset a specific circuit breaker (for admin/testing)
 */
export async function resetCircuit(name: string): Promise<void> {
  const key = `${CIRCUIT_STATE_PREFIX}${name}`;
  await redis.del(key);
  console.log(`[CircuitBreaker] ${name}: Reset to CLOSED`);
}

/**
 * Check if a circuit is available (not OPEN)
 */
export async function isCircuitAvailable(name: string): Promise<boolean> {
  const config = CIRCUIT_CONFIGS[name];
  if (!config) return true;

  const state = await getCircuitState(name);

  if (state.state === 'OPEN') {
    const timeSinceFailure = Date.now() - state.lastFailureTime;
    return timeSinceFailure >= config.resetTimeoutMs;
  }

  return true;
}
