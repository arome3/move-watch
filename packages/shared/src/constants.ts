import type { Network } from './types';

// Network configurations
// Official Movement Network endpoints from https://docs.movementnetwork.xyz/devs/networkEndpoints
export const NETWORK_CONFIGS: Record<Network, { fullnode: string; indexer: string; name: string }> = {
  mainnet: {
    fullnode: 'https://mainnet.movementnetwork.xyz/v1',
    indexer: 'https://indexer.mainnet.movementnetwork.xyz/v1/graphql',
    name: 'Mainnet',
  },
  testnet: {
    fullnode: 'https://testnet.movementnetwork.xyz/v1',
    indexer: 'https://hasura.testnet.movementnetwork.xyz/v1/graphql',
    name: 'Testnet (Bardock)',
  },
  devnet: {
    fullnode: 'https://testnet.movementnetwork.xyz/v1',
    indexer: 'https://hasura.testnet.movementnetwork.xyz/v1/graphql',
    name: 'Devnet (Bardock)',
  },
} as const;

// Error code mappings for human-readable messages
export const ERROR_MAPPINGS: Record<string, { message: string; suggestion: string }> = {
  // Account and Resource Errors
  ACCOUNT_NOT_FOUND: {
    message: 'The sender account does not exist on this network',
    suggestion:
      'This account hasn\'t been created on-chain yet. To fix this: (1) Get testnet tokens from the Movement faucet at https://faucet.movementnetwork.xyz, (2) Leave the sender field empty to use a default address, or (3) Have someone send tokens to this address first.',
  },
  RESOURCE_DOES_NOT_EXIST: {
    message: 'The specified resource does not exist on this account',
    suggestion:
      'Ensure the account has been initialized with the required resource. You may need to call an initialization function first.',
  },
  RESOURCE_ALREADY_EXISTS: {
    message: 'The resource already exists on this account',
    suggestion:
      'This resource has already been created. You cannot create it again for the same account.',
  },

  // Balance and Amount Errors
  INSUFFICIENT_BALANCE: {
    message: 'The account does not have sufficient balance',
    suggestion:
      'Check that the sender has enough tokens to cover both the transfer amount and gas fees.',
  },
  INVALID_AMOUNT: {
    message: 'The amount specified is invalid',
    suggestion:
      'Ensure the amount is greater than zero and within valid limits. Check for overflow issues with large numbers.',
  },
  EXCEEDS_MAX_LIMIT: {
    message: 'The amount exceeds the maximum allowed limit',
    suggestion:
      'Reduce the amount to be within the contract\'s configured maximum limit.',
  },

  // Authorization Errors
  UNAUTHORIZED: {
    message: 'You are not authorized to perform this action',
    suggestion:
      'Only the owner or an authorized account can call this function. Verify you\'re using the correct sender address.',
  },
  NOT_OWNER: {
    message: 'Caller is not the owner of this resource',
    suggestion:
      'This action requires ownership. Check that the sender address matches the resource owner.',
  },
  PERMISSION_DENIED: {
    message: 'Permission denied for this operation',
    suggestion:
      'The sender does not have the required capability or permission. Contact the contract owner for access.',
  },

  // State Errors
  RESOURCE_LOCKED: {
    message: 'The resource is locked and cannot be modified',
    suggestion:
      'Unlock the resource first before attempting modifications. Check if there\'s an unlock function available.',
  },
  INVALID_STATE: {
    message: 'The resource is in an invalid state for this operation',
    suggestion:
      'Check the current state of the resource. Some operations require specific preconditions to be met.',
  },

  // Argument Errors
  INVALID_ARGUMENT: {
    message: 'One or more arguments are invalid',
    suggestion:
      'Verify that all arguments match the expected types. Check address formats and numeric values.',
  },
  INVALID_ADDRESS: {
    message: 'The provided address is malformed or invalid',
    suggestion:
      'Ensure the address is a valid hex string starting with 0x and is 64 characters long (32 bytes).',
  },

  // Module/Function Errors
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

  // Transaction Errors
  SEQUENCE_NUMBER_TOO_OLD: {
    message: 'Transaction sequence number is outdated',
    suggestion:
      'This usually means another transaction was processed. Try refreshing and submitting again.',
  },
  INVALID_AUTH_KEY: {
    message: 'Authentication key mismatch',
    suggestion:
      'The public key does not match the account\'s auth key. Ensure you\'re using the correct wallet.',
  },

  // Generic Errors
  SIMULATION_FAILED: {
    message: 'Transaction simulation failed',
    suggestion:
      'Check the transaction parameters and try again. If the issue persists, the contract may have specific requirements.',
  },
  ABORTED: {
    message: 'Transaction execution was aborted',
    suggestion:
      'The contract\'s assertion failed. Check the error code to understand which condition was not met.',
  },
  MOVE_ABORT: {
    message: 'Move abort with error code',
    suggestion:
      'The smart contract explicitly aborted. Check the error code in the VM status for details.',
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

// Rate limits (per day for general, per minute for webhooks/public endpoints)
export const RATE_LIMITS = {
  FREE: 10,
  PRO: 1000,
  TEAM: 10000,
  ENTERPRISE: 100000,
} as const;

// Rate limits for specific endpoints (per minute)
export const ENDPOINT_RATE_LIMITS = {
  WEBHOOK: { limit: 60, windowSeconds: 60 }, // 60 requests per minute per action
  CHANNEL_TEST: { limit: 5, windowSeconds: 60 }, // 5 tests per minute per user
  ALERT_CREATE: { limit: 10, windowSeconds: 60 }, // 10 creations per minute per user
  ACTION_EXECUTE: { limit: 30, windowSeconds: 60 }, // 30 manual executions per minute
  PUBLIC_API: { limit: 100, windowSeconds: 60 }, // 100 requests per minute for public APIs
} as const;
