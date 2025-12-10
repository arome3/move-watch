import type { Network } from './types';

// Network configurations
export const NETWORK_CONFIGS: Record<Network, { fullnode: string; name: string }> = {
  mainnet: {
    fullnode: 'https://mainnet.movementnetwork.xyz/v1',
    name: 'Mainnet',
  },
  testnet: {
    fullnode: 'https://aptos.testnet.bardock.movementlabs.xyz/v1',
    name: 'Testnet (Bardock)',
  },
  devnet: {
    fullnode: 'https://aptos.testnet.bardock.movementlabs.xyz/v1',
    name: 'Devnet',
  },
} as const;

// Error code mappings for human-readable messages
export const ERROR_MAPPINGS: Record<string, { message: string; suggestion: string }> = {
  RESOURCE_DOES_NOT_EXIST: {
    message: 'The specified resource does not exist on this account',
    suggestion:
      'Ensure the account has been initialized with the required resource. You may need to call an initialization function first.',
  },
  INSUFFICIENT_BALANCE: {
    message: 'The account does not have sufficient balance',
    suggestion:
      'Check that the sender has enough tokens to cover both the transfer amount and gas fees.',
  },
  INVALID_ARGUMENT: {
    message: 'One or more arguments are invalid',
    suggestion:
      'Verify that all arguments match the expected types. Check address formats and numeric values.',
  },
  SEQUENCE_NUMBER_TOO_OLD: {
    message: 'Transaction sequence number is outdated',
    suggestion:
      'This usually means another transaction was processed. Try refreshing and submitting again.',
  },
  FUNCTION_NOT_FOUND: {
    message: 'The specified function does not exist',
    suggestion:
      'Check the module address, module name, and function name. Ensure the module is deployed on this network.',
  },
  MODULE_NOT_FOUND: {
    message: 'The specified module does not exist',
    suggestion:
      'Verify the module address is correct and the module is deployed on the selected network.',
  },
  TYPE_MISMATCH: {
    message: 'Type argument mismatch',
    suggestion:
      'Ensure the type arguments match what the function expects. Check the module documentation.',
  },
  SIMULATION_FAILED: {
    message: 'Transaction simulation failed',
    suggestion:
      'Check the transaction parameters and try again. If the issue persists, the contract may have specific requirements.',
  },
};

// Default gas settings
export const DEFAULT_GAS_SETTINGS = {
  maxGasAmount: 100000,
  gasUnitPrice: 100,
} as const;

// Simulation TTL
export const SIMULATION_TTL_DAYS = 30;
export const REDIS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Rate limits
export const RATE_LIMITS = {
  FREE: 10,
  PRO: 1000,
  TEAM: 10000,
  ENTERPRISE: 100000,
} as const;
