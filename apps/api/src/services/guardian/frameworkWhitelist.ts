/**
 * Framework Whitelist
 *
 * Known-safe framework modules and functions that should bypass most security checks.
 * These are audited, canonical implementations from the Move standard library.
 *
 * Flagging these as "Critical Risk" would be like flagging ERC20.transfer() in Ethereum.
 */

import type { RiskSeverity } from '@movewatch/shared';
import type { DetectedIssue } from './types.js';

/**
 * Known-safe framework addresses
 * These are the standard library addresses on Movement/Aptos
 */
export const FRAMEWORK_ADDRESSES = new Set([
  '0x1',      // Core framework (coin, account, aptos_coin, etc.)
  '0x2',      // Token standards
  '0x3',      // Token v1
  '0x4',      // Token v2 / Digital assets
]);

/**
 * Known-safe modules at 0x1 (core framework)
 * These are audited, standard implementations
 */
export const SAFE_CORE_MODULES = new Set([
  'coin',           // Standard coin operations
  'aptos_coin',     // Native APTOS/MOVE coin
  'account',        // Account management
  'aptos_account',  // Aptos account helpers
  'managed_coin',   // Managed coin standard
  'primary_fungible_store', // Fungible asset storage
  'fungible_asset', // Fungible asset standard
  'object',         // Object model
  'option',         // Option type
  'string',         // String utilities
  'vector',         // Vector utilities
  'signer',         // Signer utilities
  'timestamp',      // Timestamp utilities
  'block',          // Block info
  'transaction_context', // Transaction context
  'type_info',      // Type introspection
  'table',          // Table data structure
  'simple_map',     // Simple map
  'event',          // Event emission
  'guid',           // GUID generation
  'hash',           // Hash functions
  'bcs',            // BCS serialization
  'ed25519',        // Ed25519 signatures
  'multi_ed25519',  // Multi-sig Ed25519
  'secp256k1',      // Secp256k1 signatures
  'from_bcs',       // BCS deserialization
  'math64',         // Math utilities
  'math128',        // Math utilities
  'comparator',     // Comparator utilities
  'code',           // Code publication
  'resource_account', // Resource accounts
  'create_signer',  // Signer creation (internal)
]);

/**
 * Known-safe functions that are standard operations
 * Format: "module::function"
 */
export const SAFE_FUNCTIONS = new Set([
  // Coin operations
  'coin::transfer',
  'coin::deposit',
  'coin::withdraw',
  'coin::balance',
  'coin::is_account_registered',
  'coin::register',
  'coin::value',

  // Aptos coin
  'aptos_coin::transfer',
  'aptos_coin::mint',

  // Account operations
  'account::create_account',
  'account::exists_at',
  'account::get_sequence_number',
  'aptos_account::transfer',
  'aptos_account::create_account',
  'aptos_account::transfer_coins',

  // Managed coin
  'managed_coin::register',
  'managed_coin::mint',
  'managed_coin::burn',

  // Fungible assets
  'primary_fungible_store::transfer',
  'primary_fungible_store::deposit',
  'primary_fungible_store::withdraw',
  'fungible_asset::transfer',
  'fungible_asset::deposit',
  'fungible_asset::withdraw',

  // Object operations
  'object::transfer',
  'object::create_object',
]);

/**
 * Result of whitelist check
 */
export interface WhitelistCheckResult {
  isWhitelisted: boolean;
  isFrameworkAddress: boolean;
  isSafeModule: boolean;
  isSafeFunction: boolean;
  reason?: string;
}

/**
 * Check if a function is whitelisted as known-safe
 */
export function checkWhitelist(
  moduleAddress: string,
  moduleName: string,
  functionName: string
): WhitelistCheckResult {
  // Normalize address (handle both 0x1 and 0x0000...0001 formats)
  const normalizedAddress = normalizeAddress(moduleAddress);

  const isFrameworkAddress = FRAMEWORK_ADDRESSES.has(normalizedAddress);
  const isSafeModule = isFrameworkAddress && SAFE_CORE_MODULES.has(moduleName);
  const isSafeFunction = SAFE_FUNCTIONS.has(`${moduleName}::${functionName}`);

  const isWhitelisted = isFrameworkAddress && (isSafeModule || isSafeFunction);

  let reason: string | undefined;
  if (isWhitelisted) {
    if (isSafeFunction) {
      reason = `${normalizedAddress}::${moduleName}::${functionName} is a known-safe framework function`;
    } else if (isSafeModule) {
      reason = `${normalizedAddress}::${moduleName} is a known-safe framework module`;
    }
  }

  return {
    isWhitelisted,
    isFrameworkAddress,
    isSafeModule,
    isSafeFunction,
    reason,
  };
}

/**
 * Normalize address to short form (0x1 instead of 0x000...001)
 */
function normalizeAddress(address: string): string {
  if (!address.startsWith('0x')) return address;

  // Remove 0x prefix and leading zeros
  const hex = address.slice(2).replace(/^0+/, '');

  // Return normalized form
  return `0x${hex || '0'}`;
}

/**
 * Create a "safe" response for whitelisted functions
 * Still returns some informational data but with LOW risk
 */
export function createWhitelistedResponse(
  moduleAddress: string,
  moduleName: string,
  functionName: string,
  whitelistResult: WhitelistCheckResult
): {
  issues: DetectedIssue[];
  riskScore: number;
  overallRisk: RiskSeverity;
  skipAnalyzers: boolean;
} {
  const issues: DetectedIssue[] = [{
    patternId: 'info:framework_function',
    category: 'PERMISSION',
    severity: 'LOW',
    title: 'Standard Framework Function',
    description: `This transaction calls ${moduleAddress}::${moduleName}::${functionName}, which is a standard, audited framework function from the Move standard library.`,
    recommendation: 'This is a safe, canonical implementation. Verify the arguments match your intended operation.',
    confidence: 1.0,
    source: 'pattern',
    evidence: {
      whitelistReason: whitelistResult.reason,
      isFrameworkAddress: whitelistResult.isFrameworkAddress,
      isSafeModule: whitelistResult.isSafeModule,
      isSafeFunction: whitelistResult.isSafeFunction,
    },
  }];

  return {
    issues,
    riskScore: 0,
    overallRisk: 'LOW',
    skipAnalyzers: true,
  };
}

/**
 * Functions that should NEVER be whitelisted even at 0x1
 * These are administrative functions that could be dangerous
 */
export const NEVER_WHITELIST = new Set([
  'code::publish_package_txn',  // Code deployment
  'resource_account::create_resource_account', // Can be used in attacks
  'account::rotate_authentication_key', // Key rotation
]);

/**
 * Check if function should never be whitelisted
 */
export function isNeverWhitelisted(moduleName: string, functionName: string): boolean {
  return NEVER_WHITELIST.has(`${moduleName}::${functionName}`);
}
