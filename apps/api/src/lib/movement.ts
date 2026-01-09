import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { NETWORK_CONFIGS, type Network as MoveNetwork } from '@movewatch/shared';
import { withCircuitBreaker, CIRCUIT_CONFIGS, CircuitOpenError } from './circuitBreaker.js';

/**
 * Creates an Aptos client configured for Movement Network
 * Movement uses the Aptos SDK with custom RPC endpoints
 * We explicitly set both fullnode and indexer URLs to prevent SDK auto-discovery
 */
export function getMovementClient(network: MoveNetwork): Aptos {
  const { fullnode, indexer } = NETWORK_CONFIGS[network];

  const config = new AptosConfig({
    network: Network.CUSTOM,
    fullnode,
    indexer,
  });

  return new Aptos(config);
}

/**
 * Parse a function path into its components
 * @param path - e.g., "0x1::coin::transfer"
 * @returns [moduleAddress, moduleName, functionName]
 */
export function parseFunctionPath(path: string): [string, string, string] {
  const match = path.match(/^(0x[a-fA-F0-9]+)::(\w+)::(\w+)$/);
  if (!match) {
    throw new Error(`Invalid function path: ${path}. Expected format: 0x1::module::function`);
  }
  return [match[1], match[2], match[3]];
}

/**
 * Generate a dummy address for anonymous simulations
 * This is a valid-looking address that allows simulation without a real account
 */
export function generateDummyAddress(): string {
  return '0x' + '0'.repeat(64);
}

/**
 * Generate a dummy public key for simulation
 * The Aptos SDK requires a public key for simulation even though it's not used
 * This is a valid-format Ed25519 public key (32 bytes, non-zero)
 */
export function generateDummyPublicKey(): Uint8Array {
  // Use a deterministic but valid-looking public key
  // This is just for simulation - the signature won't be validated
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] = (i + 1) % 256;
  }
  return key;
}

/**
 * Execute a Movement Network call with circuit breaker protection
 * Prevents cascading failures when the network is unavailable
 *
 * @param network - The network to call (mainnet/testnet)
 * @param fn - The function to execute (receives the Aptos client)
 * @returns The result of the function
 * @throws CircuitOpenError if the circuit is open
 */
export async function withMovementClient<T>(
  network: MoveNetwork,
  fn: (client: Aptos) => Promise<T>
): Promise<T> {
  const circuitName = `movement_${network}`;
  const circuitConfig = CIRCUIT_CONFIGS[circuitName];

  if (!circuitConfig) {
    // No circuit config, just execute
    const client = getMovementClient(network);
    return fn(client);
  }

  return withCircuitBreaker(circuitConfig, async () => {
    const client = getMovementClient(network);
    return fn(client);
  });
}

/**
 * Check if Movement Network is available (circuit not open)
 */
export function isMovementAvailable(network: MoveNetwork): Promise<boolean> {
  // This is imported from circuitBreaker.ts
  const circuitName = `movement_${network}`;
  const circuitConfig = CIRCUIT_CONFIGS[circuitName];
  if (!circuitConfig) return Promise.resolve(true);

  // Re-export the check from circuitBreaker
  return import('./circuitBreaker.js').then((mod) => mod.isCircuitAvailable(circuitName));
}

// Re-export CircuitOpenError for callers to catch
export { CircuitOpenError };
export type { MoveNetwork };
