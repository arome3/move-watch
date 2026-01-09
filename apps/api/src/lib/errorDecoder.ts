/**
 * Enhanced Error Decoder for Move VM Errors
 * Decodes Move abort codes and VM status into human-readable format
 */
import type {
  DecodedError,
  ErrorCategory,
  StackFrame,
  FailurePoint,
} from '@movewatch/shared';

// Known Move framework error codes (from aptos-core)
const FRAMEWORK_ERROR_CODES: Record<number, { name: string; description: string; module?: string }> = {
  // 0x1::error codes (standard library)
  1: { name: 'INVALID_ARGUMENT', description: 'An invalid argument was provided' },
  2: { name: 'OUT_OF_RANGE', description: 'A value is out of the valid range' },
  3: { name: 'INVALID_STATE', description: 'The resource is in an invalid state for this operation' },
  4: { name: 'UNAUTHENTICATED', description: 'The caller is not authenticated' },
  5: { name: 'PERMISSION_DENIED', description: 'The caller does not have permission' },
  6: { name: 'NOT_FOUND', description: 'The requested resource was not found' },
  7: { name: 'ABORTED', description: 'The operation was aborted' },
  8: { name: 'ALREADY_EXISTS', description: 'The resource already exists' },
  9: { name: 'RESOURCE_EXHAUSTED', description: 'A resource limit has been exceeded' },
  10: { name: 'INTERNAL', description: 'An internal error occurred' },

  // 0x1::coin error codes
  65537: { name: 'ECOIN_STORE_NOT_PUBLISHED', description: 'CoinStore resource not found for this account', module: 'coin' },
  65538: { name: 'ECOIN_STORE_ALREADY_PUBLISHED', description: 'CoinStore already exists for this account', module: 'coin' },
  65539: { name: 'EINSUFFICIENT_BALANCE', description: 'Insufficient balance to complete the transfer', module: 'coin' },
  65540: { name: 'ECOIN_SUPPLY_UPGRADE_NOT_SUPPORTED', description: 'Coin supply upgrade not supported', module: 'coin' },
  65541: { name: 'EZERO_COIN_AMOUNT', description: 'Cannot transfer zero coins', module: 'coin' },
  65542: { name: 'EFROZEN', description: 'CoinStore is frozen and cannot be used', module: 'coin' },
  65543: { name: 'ECOIN_STORE_NOT_FOUND', description: 'CoinStore not found', module: 'coin' },
  65544: { name: 'ECOIN_NAME_TOO_LONG', description: 'Coin name exceeds maximum length', module: 'coin' },
  65545: { name: 'ECOIN_SYMBOL_TOO_LONG', description: 'Coin symbol exceeds maximum length', module: 'coin' },

  // 0x1::account error codes
  131073: { name: 'EACCOUNT_ALREADY_EXISTS', description: 'Account already exists at this address', module: 'account' },
  131074: { name: 'EACCOUNT_DOES_NOT_EXIST', description: 'Account does not exist at this address', module: 'account' },
  131075: { name: 'ESEQUENCE_NUMBER_TOO_BIG', description: 'Sequence number exceeds maximum', module: 'account' },
  131076: { name: 'EMALFORMED_AUTHENTICATION_KEY', description: 'Authentication key is malformed', module: 'account' },
  131077: { name: 'ECANNOT_RESERVED_ADDRESS', description: 'Cannot use reserved address', module: 'account' },
  131078: { name: 'EOUT_OF_GAS', description: 'Transaction ran out of gas', module: 'account' },
  131079: { name: 'EWRITESET_NOT_ALLOWED', description: 'WriteSet not allowed', module: 'account' },
  131080: { name: 'EWRONG_CURRENT_PUBLIC_KEY', description: 'Current public key does not match', module: 'account' },
  131081: { name: 'EINVALID_PROOF_OF_KNOWLEDGE', description: 'Invalid proof of knowledge', module: 'account' },
  131082: { name: 'ENO_CAPABILITY', description: 'Account does not have required capability', module: 'account' },
  131083: { name: 'EINVALID_ACCEPT_ROTATION_CAPABILITY', description: 'Invalid rotation capability', module: 'account' },
  131084: { name: 'ENO_VALID_FRAMEWORK_RESERVED_ADDRESS', description: 'Not a valid framework reserved address', module: 'account' },

  // 0x1::aptos_account error codes
  196609: { name: 'EACCOUNT_NOT_FOUND', description: 'Account not found', module: 'aptos_account' },
  196610: { name: 'EACCOUNT_NOT_REGISTERED_FOR_APT', description: 'Account not registered for APT', module: 'aptos_account' },

  // 0x1::staking_contract error codes
  262145: { name: 'EOPERATOR_ALREADY_SET', description: 'Operator is already set', module: 'staking_contract' },
  262146: { name: 'EINVALID_COMMISSION', description: 'Invalid commission percentage', module: 'staking_contract' },
  262147: { name: 'ECONTRACT_NOT_FOUND', description: 'Staking contract not found', module: 'staking_contract' },
};

// VM status code mappings
const VM_STATUS_CODES: Record<string, { category: ErrorCategory; message: string }> = {
  'EXECUTED': { category: 'UNKNOWN', message: 'Transaction executed successfully' },
  'OUT_OF_GAS': { category: 'GAS', message: 'Transaction ran out of gas before completion' },
  'MOVE_ABORT': { category: 'ABORT', message: 'Move code aborted execution' },
  'EXECUTION_FAILURE': { category: 'UNKNOWN', message: 'Execution failed' },
  'VERIFICATION_ERROR': { category: 'MODULE', message: 'Bytecode verification failed' },
  'DESERIALIZATION_ERROR': { category: 'ARGUMENT', message: 'Failed to deserialize transaction' },
  'PUBLISHING_FAILURE': { category: 'MODULE', message: 'Module publishing failed' },
  'LINKER_ERROR': { category: 'MODULE', message: 'Module linking failed' },
  'TYPE_RESOLUTION_FAILURE': { category: 'ARGUMENT', message: 'Type resolution failed' },
  'TYPE_MISMATCH': { category: 'ARGUMENT', message: 'Type mismatch in arguments' },
  'STORAGE_ERROR': { category: 'STATE', message: 'Storage operation failed' },
  'INTERNAL_TYPE_ERROR': { category: 'UNKNOWN', message: 'Internal type error' },
  'EVENT_KEY_MISMATCH': { category: 'STATE', message: 'Event key mismatch' },
  'UNEXPECTED_ERROR_FROM_KNOWN_MOVE_FUNCTION': { category: 'ABORT', message: 'Unexpected error from known Move function' },
  'INVALID_MAIN_FUNCTION_SIGNATURE': { category: 'MODULE', message: 'Invalid main function signature' },
  'DUPLICATE_MODULE_NAME': { category: 'MODULE', message: 'Duplicate module name' },
  'UNKNOWN_INVARIANT_VIOLATION_ERROR': { category: 'UNKNOWN', message: 'Unknown invariant violation' },
  'EMPTY_VALUE_STACK': { category: 'UNKNOWN', message: 'Empty value stack' },
  'PC_OVERFLOW': { category: 'UNKNOWN', message: 'Program counter overflow' },
  'VERIFICATION_ERROR_INNER': { category: 'MODULE', message: 'Verification error' },
  'BAD_TRANSACTION_FEE_CURRENCY': { category: 'ARGUMENT', message: 'Bad transaction fee currency' },
  'FEATURE_UNDER_GATING': { category: 'STATE', message: 'Feature is under gating' },
  'FIELD_MISSING_TYPE_ABILITY': { category: 'MODULE', message: 'Field missing type ability' },
  'POP_RESOURCE_ERROR': { category: 'RESOURCE', message: 'Pop resource error' },
  'ARITHMETIC_ERROR': { category: 'ARGUMENT', message: 'Arithmetic error (overflow/underflow)' },
  'MEMORY_LIMIT_EXCEEDED': { category: 'LIMIT', message: 'Memory limit exceeded' },
  'EXECUTION_STACK_OVERFLOW': { category: 'LIMIT', message: 'Execution stack overflow' },
  'CALL_STACK_OVERFLOW': { category: 'LIMIT', message: 'Call stack overflow' },
  'MAX_VALUE_DEPTH_REACHED': { category: 'LIMIT', message: 'Max value depth reached' },
  'INVALID_TRANSACTION_ARGUMENT': { category: 'ARGUMENT', message: 'Invalid transaction argument' },
  'INVALID_GAS_SPECIFIER': { category: 'GAS', message: 'Invalid gas specifier' },
  'SEQUENCE_NUMBER_TOO_OLD': { category: 'STATE', message: 'Sequence number is too old' },
  'SEQUENCE_NUMBER_TOO_NEW': { category: 'STATE', message: 'Sequence number is too new' },
  'ACCOUNT_DOES_NOT_EXIST': { category: 'RESOURCE', message: 'Account does not exist' },
  'INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE': { category: 'BALANCE', message: 'Insufficient balance for gas fees' },
  'SENDING_ACCOUNT_DOES_NOT_EXIST': { category: 'RESOURCE', message: 'Sending account does not exist' },
  'REJECTED_WRITE_SET': { category: 'AUTHORIZATION', message: 'Write set rejected' },
  'INVALID_WRITE_SET': { category: 'AUTHORIZATION', message: 'Invalid write set' },
  'EXCEEDED_MAX_TRANSACTION_SIZE': { category: 'LIMIT', message: 'Transaction exceeds max size' },
  'UNKNOWN_SCRIPT': { category: 'MODULE', message: 'Unknown script' },
  'UNKNOWN_MODULE': { category: 'MODULE', message: 'Unknown module' },
  'MAX_GAS_UNITS_EXCEEDS_MAX_GAS_UNITS_BOUND': { category: 'GAS', message: 'Max gas exceeds limit' },
  'MAX_GAS_UNITS_BELOW_MIN_TRANSACTION_GAS_UNITS': { category: 'GAS', message: 'Max gas below minimum' },
  'GAS_UNIT_PRICE_BELOW_MIN_BOUND': { category: 'GAS', message: 'Gas unit price below minimum' },
  'GAS_UNIT_PRICE_ABOVE_MAX_BOUND': { category: 'GAS', message: 'Gas unit price above maximum' },
  'INVALID_AUTH_KEY': { category: 'AUTHENTICATION', message: 'Invalid authentication key' },
  'SECONDARY_KEYS_ADDRESSES_COUNT_MISMATCH': { category: 'AUTHENTICATION', message: 'Secondary keys count mismatch' },
  'SIGNERS_CONTAIN_DUPLICATES': { category: 'AUTHENTICATION', message: 'Signers contain duplicates' },
  'SEQUENCE_NONCE_INVALID': { category: 'STATE', message: 'Sequence nonce invalid' },
  'CHAIN_ACCOUNT_INFO_DOES_NOT_MATCH': { category: 'STATE', message: 'Chain account info mismatch' },
  'MODULE_ADDRESS_DOES_NOT_MATCH_SENDER': { category: 'AUTHORIZATION', message: 'Module address does not match sender' },
  'ZERO_SIZED_STRUCT': { category: 'ARGUMENT', message: 'Zero sized struct not allowed' },
};

/**
 * Extract module address and name from function path
 */
function parseModulePath(functionPath: string): { moduleAddress: string; moduleName: string; functionName: string } | null {
  const match = functionPath.match(/^(0x[a-fA-F0-9]+)::(\w+)::(\w+)$/);
  if (!match) return null;
  return {
    moduleAddress: match[1],
    moduleName: match[2],
    functionName: match[3],
  };
}

/**
 * Extract abort code from VM status string
 * Formats: "Move abort in 0x1::coin: EINSUFFICIENT_BALANCE(0x10004)"
 *          "Move abort: 65539"
 *          "MOVE_ABORT with code 65539 in module 0x1::coin"
 */
function extractAbortCode(vmStatus: string): { abortCode?: number; moduleAddress?: string; moduleName?: string } {
  // Pattern 1: "Move abort in 0x1::module: ERROR_NAME(0xcode)"
  let match = vmStatus.match(/Move abort in (0x[a-fA-F0-9]+)::(\w+):\s*(\w+)\((0x[a-fA-F0-9]+)\)/i);
  if (match) {
    return {
      abortCode: parseInt(match[4], 16),
      moduleAddress: match[1],
      moduleName: match[2],
    };
  }

  // Pattern 2: "MOVE_ABORT with code N in module 0x1::module"
  match = vmStatus.match(/MOVE_ABORT.*?code\s+(\d+).*?module\s+(0x[a-fA-F0-9]+)::(\w+)/i);
  if (match) {
    return {
      abortCode: parseInt(match[1], 10),
      moduleAddress: match[2],
      moduleName: match[3],
    };
  }

  // Pattern 3: "Move abort: N" or similar with just a number
  match = vmStatus.match(/(?:abort|ABORT).*?(\d+)/);
  if (match) {
    return { abortCode: parseInt(match[1], 10) };
  }

  // Pattern 4: Hex code in the string
  match = vmStatus.match(/0x([a-fA-F0-9]{4,})/);
  if (match) {
    return { abortCode: parseInt(match[1], 16) };
  }

  return {};
}

/**
 * Determine error category from error code or VM status
 */
function categorizeError(vmStatus: string, abortCode?: number): ErrorCategory {
  const upperStatus = vmStatus.toUpperCase();

  // Check for known VM status codes
  for (const [code, info] of Object.entries(VM_STATUS_CODES)) {
    if (upperStatus.includes(code)) {
      return info.category;
    }
  }

  // Categorize by abort code ranges
  if (abortCode !== undefined) {
    // Framework error codes have specific ranges per module
    // General pattern: module_index << 16 | error_code
    const moduleIndex = abortCode >> 16;
    const errorCode = abortCode & 0xFFFF;

    // Standard error module (index 0)
    if (moduleIndex === 0) {
      switch (errorCode) {
        case 1: return 'ARGUMENT';
        case 2: return 'LIMIT';
        case 3: return 'STATE';
        case 4: return 'AUTHENTICATION';
        case 5: return 'AUTHORIZATION';
        case 6: return 'RESOURCE';
        case 7: return 'ABORT';
        case 8: return 'RESOURCE';
        case 9: return 'LIMIT';
        default: return 'UNKNOWN';
      }
    }

    // Coin module (index 1)
    if (moduleIndex === 1) {
      if ([3, 5].includes(errorCode)) return 'BALANCE';
      if (errorCode === 6) return 'STATE';
      return 'RESOURCE';
    }

    // Account module (index 2)
    if (moduleIndex === 2) {
      if ([4, 10, 11].includes(errorCode)) return 'AUTHENTICATION';
      if (errorCode === 6) return 'GAS';
      return 'RESOURCE';
    }
  }

  // Keyword-based categorization
  if (upperStatus.includes('BALANCE') || upperStatus.includes('INSUFFICIENT')) return 'BALANCE';
  if (upperStatus.includes('AUTH') || upperStatus.includes('KEY') || upperStatus.includes('SIGNATURE')) return 'AUTHENTICATION';
  if (upperStatus.includes('PERMISSION') || upperStatus.includes('UNAUTHORIZED') || upperStatus.includes('OWNER')) return 'AUTHORIZATION';
  if (upperStatus.includes('RESOURCE') || upperStatus.includes('ACCOUNT') || upperStatus.includes('NOT_FOUND')) return 'RESOURCE';
  if (upperStatus.includes('ARGUMENT') || upperStatus.includes('TYPE') || upperStatus.includes('INVALID')) return 'ARGUMENT';
  if (upperStatus.includes('STATE') || upperStatus.includes('SEQUENCE')) return 'STATE';
  if (upperStatus.includes('LIMIT') || upperStatus.includes('EXCEED') || upperStatus.includes('OVERFLOW')) return 'LIMIT';
  if (upperStatus.includes('MODULE') || upperStatus.includes('FUNCTION') || upperStatus.includes('LINKER')) return 'MODULE';
  if (upperStatus.includes('GAS')) return 'GAS';
  if (upperStatus.includes('ABORT')) return 'ABORT';

  return 'UNKNOWN';
}

/**
 * Get human-readable error name and description
 */
function getErrorInfo(abortCode?: number, vmStatus?: string): { name: string; description: string } {
  // Check framework error codes first
  if (abortCode !== undefined && FRAMEWORK_ERROR_CODES[abortCode]) {
    return FRAMEWORK_ERROR_CODES[abortCode];
  }

  // Check VM status codes
  if (vmStatus) {
    const upperStatus = vmStatus.toUpperCase();
    for (const [code, info] of Object.entries(VM_STATUS_CODES)) {
      if (upperStatus.includes(code)) {
        return { name: code, description: info.message };
      }
    }
  }

  // Default
  return {
    name: abortCode !== undefined ? `ABORT_${abortCode}` : 'UNKNOWN_ERROR',
    description: vmStatus || 'An unknown error occurred',
  };
}

/**
 * Generate actionable suggestion based on error
 */
function generateSuggestion(category: ErrorCategory, errorName: string, vmStatus: string): string {
  const suggestions: Record<ErrorCategory, string[]> = {
    AUTHENTICATION: [
      'Verify the sender address matches the account\'s authentication key.',
      'Ensure you\'re using the correct wallet and private key.',
      'Check if the account\'s key has been rotated.',
    ],
    AUTHORIZATION: [
      'Only the owner or authorized accounts can perform this action.',
      'Check if the sender has the required capability or permission.',
      'Verify you\'re calling from the correct address.',
    ],
    RESOURCE: [
      'The required resource does not exist on this account.',
      'Initialize the account with the required resource first.',
      'Check if the account exists on-chain.',
    ],
    BALANCE: [
      'The account does not have sufficient balance.',
      'Ensure you have enough tokens to cover both the amount and gas fees.',
      'Check your balance using a block explorer.',
    ],
    ARGUMENT: [
      'One or more arguments are invalid.',
      'Verify argument types match the function signature.',
      'Check address formats are correct (0x followed by 64 hex characters).',
    ],
    STATE: [
      'The resource is in an invalid state for this operation.',
      'Check preconditions are met before calling this function.',
      'Verify sequence numbers are correct.',
    ],
    LIMIT: [
      'A limit has been exceeded.',
      'Reduce the amount or size of the operation.',
      'Check gas limits and adjust if needed.',
    ],
    MODULE: [
      'The module or function does not exist.',
      'Verify the module address and name are correct.',
      'Ensure the module is deployed on this network.',
    ],
    GAS: [
      'The transaction ran out of gas.',
      'Increase the max_gas_amount parameter.',
      'Simplify the transaction or break it into smaller operations.',
    ],
    ABORT: [
      'The smart contract explicitly aborted.',
      'Check the error code for specific failure reason.',
      'Review the contract\'s documentation for this error.',
    ],
    UNKNOWN: [
      'An unexpected error occurred.',
      'Review the transaction parameters.',
      'Contact support if the issue persists.',
    ],
  };

  const baseSuggestions = suggestions[category] || suggestions.UNKNOWN;

  // Add error-specific suggestions
  if (errorName.includes('INSUFFICIENT_BALANCE')) {
    return 'Ensure the sender has enough tokens. ' + baseSuggestions[0];
  }
  if (errorName.includes('NOT_FOUND') || errorName.includes('DOES_NOT_EXIST')) {
    return 'The account or resource does not exist. ' + baseSuggestions[1];
  }
  if (errorName.includes('FROZEN')) {
    return 'The coin store is frozen. Contact the coin issuer to unfreeze.';
  }

  return baseSuggestions.join(' ');
}

/**
 * Main function to decode a simulation error
 */
export function decodeError(
  vmStatus: string,
  functionPath?: string
): DecodedError {
  // Parse module info from function path
  const parsedModule = functionPath ? parseModulePath(functionPath) : null;

  // Extract abort code and module from VM status
  const { abortCode, moduleAddress, moduleName } = extractAbortCode(vmStatus);

  // Get final module info (prefer from VM status, fallback to function path)
  const finalModuleAddress = moduleAddress || parsedModule?.moduleAddress || '0x0';
  const finalModuleName = moduleName || parsedModule?.moduleName || 'unknown';

  // Determine category
  const category = categorizeError(vmStatus, abortCode);

  // Get error name and description
  const { name: errorName, description: errorDescription } = getErrorInfo(abortCode, vmStatus);

  return {
    moduleAddress: finalModuleAddress,
    moduleName: finalModuleName,
    abortCode,
    errorName,
    errorDescription,
    category,
    sourceLocation: parsedModule ? {
      module: `${parsedModule.moduleAddress}::${parsedModule.moduleName}`,
      function: parsedModule.functionName,
    } : undefined,
  };
}

/**
 * Generate a comprehensive suggestion based on decoded error
 */
export function generateErrorSuggestion(decoded: DecodedError): string {
  return generateSuggestion(decoded.category, decoded.errorName || '', decoded.errorDescription || '');
}

/**
 * Build a basic stack trace from function path (limited without full trace)
 */
export function buildBasicStackTrace(
  functionPath: string,
  success: boolean,
  gasUsed?: number
): StackFrame[] {
  const parsed = parseModulePath(functionPath);
  if (!parsed) return [];

  return [{
    depth: 0,
    moduleAddress: parsed.moduleAddress,
    moduleName: parsed.moduleName,
    functionName: parsed.functionName,
    gasAtEntry: 0,
    gasAtExit: gasUsed,
    status: success ? 'completed' : 'aborted',
  }];
}

/**
 * Extract failure point from error info
 */
export function extractFailurePoint(
  vmStatus: string,
  functionPath?: string,
  gasUsed?: number
): FailurePoint | undefined {
  const parsed = functionPath ? parseModulePath(functionPath) : null;
  const { moduleAddress, moduleName } = extractAbortCode(vmStatus);

  if (!parsed && !moduleAddress) return undefined;

  return {
    moduleAddress: moduleAddress || parsed?.moduleAddress || '0x0',
    moduleName: moduleName || parsed?.moduleName || 'unknown',
    functionName: parsed?.functionName || 'unknown',
    gasConsumedBeforeFailure: gasUsed || 0,
  };
}

export {
  FRAMEWORK_ERROR_CODES,
  VM_STATUS_CODES,
};
