import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { NETWORK_CONFIGS, type Network as MoveNetwork } from '@movewatch/shared';

/**
 * Creates an Aptos client configured for Movement Network
 * Movement uses the Aptos SDK with custom RPC endpoints
 */
export function getMovementClient(network: MoveNetwork): Aptos {
  const config = new AptosConfig({
    network: Network.CUSTOM,
    fullnode: NETWORK_CONFIGS[network].fullnode,
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
 */
export function generateDummyPublicKey(): Uint8Array {
  return new Uint8Array(32);
}

export type { MoveNetwork };
