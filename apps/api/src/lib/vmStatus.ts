/**
 * Move VM Status Code Parser
 *
 * Translates cryptic VM status codes into human-readable error messages
 * with actionable suggestions for developers.
 *
 * Reference: https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/move-stdlib/sources/error.move
 */

// Major status categories
const MAJOR_STATUS_CODES: Record<string, { name: string; description: string }> = {
  // Validation errors (1-999)
  '1': { name: 'INVALID_SIGNATURE', description: 'Transaction signature is invalid' },
  '2': { name: 'INVALID_AUTH_KEY', description: 'Authentication key does not match' },
  '3': { name: 'SEQUENCE_NUMBER_TOO_OLD', description: 'Sequence number is outdated' },
  '4': { name: 'SEQUENCE_NUMBER_TOO_NEW', description: 'Sequence number is too far ahead' },
  '5': { name: 'INSUFFICIENT_BALANCE_FOR_FEE', description: 'Not enough balance to pay gas fees' },
  '6': { name: 'TRANSACTION_EXPIRED', description: 'Transaction timestamp has expired' },
  '7': { name: 'SENDING_ACCOUNT_DOES_NOT_EXIST', description: 'Sender account not found on chain' },

  // Execution errors (1000+)
  '1000': { name: 'EXECUTED', description: 'Transaction executed successfully' },
  '1001': { name: 'OUT_OF_GAS', description: 'Ran out of gas during execution' },
  '1002': { name: 'RESOURCE_DOES_NOT_EXIST', description: 'Required resource not found' },
  '1003': { name: 'RESOURCE_ALREADY_EXISTS', description: 'Resource already exists at address' },
  '1004': { name: 'MISSING_DATA', description: 'Required data is missing' },
  '1005': { name: 'DATA_FORMAT_ERROR', description: 'Data format is incorrect' },
  '1006': { name: 'ABORTED', description: 'Execution was aborted by the Move code' },
  '1007': { name: 'ARITHMETIC_ERROR', description: 'Arithmetic operation failed (overflow/underflow)' },
  '1008': { name: 'EXECUTION_STACK_OVERFLOW', description: 'Too many nested function calls' },
  '1009': { name: 'CALL_STACK_OVERFLOW', description: 'Call stack exceeded limit' },
  '1010': { name: 'VM_MAX_TYPE_DEPTH_REACHED', description: 'Type nesting too deep' },
  '1011': { name: 'VM_MAX_VALUE_DEPTH_REACHED', description: 'Value nesting too deep' },
};

// Move abort codes (from error.move standard library)
const MOVE_ABORT_CODES: Record<number, { category: string; reason: string }> = {
  // Standard categories (0x01 - 0x0A in upper bits)
  0x10001: { category: 'INVALID_ARGUMENT', reason: 'An argument was invalid' },
  0x10002: { category: 'OUT_OF_RANGE', reason: 'A value was out of valid range' },
  0x10003: { category: 'INVALID_STATE', reason: 'Operation not valid in current state' },
  0x10004: { category: 'UNAUTHENTICATED', reason: 'Caller is not authenticated' },
  0x10005: { category: 'PERMISSION_DENIED', reason: 'Caller lacks required permission' },
  0x10006: { category: 'NOT_FOUND', reason: 'Requested resource was not found' },
  0x10007: { category: 'ABORTED', reason: 'Operation was aborted' },
  0x10008: { category: 'ALREADY_EXISTS', reason: 'Resource already exists' },
  0x10009: { category: 'RESOURCE_EXHAUSTED', reason: 'Resource limit exceeded' },
  0x1000A: { category: 'INTERNAL', reason: 'Internal error occurred' },
  0x1000B: { category: 'NOT_IMPLEMENTED', reason: 'Feature not implemented' },
  0x1000C: { category: 'UNAVAILABLE', reason: 'Service temporarily unavailable' },
};

// Common aptos-framework specific errors
const FRAMEWORK_ERRORS: Record<string, { module: string; error: string; suggestion: string }> = {
  'EINSUFFICIENT_BALANCE': {
    module: 'coin',
    error: 'Insufficient token balance',
    suggestion: 'Ensure the account has enough tokens before the transfer',
  },
  'ECOIN_STORE_NOT_PUBLISHED': {
    module: 'coin',
    error: 'Coin store not registered',
    suggestion: 'Register the coin store with 0x1::coin::register before receiving tokens',
  },
  'EACCOUNT_NOT_FOUND': {
    module: 'account',
    error: 'Account does not exist',
    suggestion: 'Create the account first or use aptos_account::transfer which auto-creates',
  },
  'ESEQUENCE_NUMBER_TOO_OLD': {
    module: 'account',
    error: 'Sequence number already used',
    suggestion: 'Fetch the latest sequence number and retry',
  },
  'ENOT_AUTHORIZED': {
    module: 'various',
    error: 'Caller not authorized',
    suggestion: 'Check that the signer has the required permissions',
  },
  'EALREADY_REGISTERED': {
    module: 'coin',
    error: 'Coin type already registered',
    suggestion: 'The coin store already exists, no need to register again',
  },
};

/**
 * Parsed VM status result
 */
export interface ParsedVMStatus {
  success: boolean;
  code: string;
  name: string;
  description: string;
  category: string;
  suggestion: string;
  rawStatus: string;
}

/**
 * Parse a VM status string into a human-readable format
 *
 * @param vmStatus - Raw VM status string (e.g., "Move abort: 0x10006", "Executed successfully")
 * @returns Parsed status with human-readable information
 */
export function parseVMStatus(vmStatus: string): ParsedVMStatus {
  const rawStatus = vmStatus || 'Unknown';

  // Check for success
  if (vmStatus.toLowerCase().includes('executed successfully') || vmStatus === 'Executed') {
    return {
      success: true,
      code: '1000',
      name: 'EXECUTED',
      description: 'Transaction executed successfully',
      category: 'Success',
      suggestion: 'No action needed',
      rawStatus,
    };
  }

  // Parse "Move abort" errors
  const abortMatch = vmStatus.match(/Move abort(?: in [^:]+)?:?\s*(?:code\s*)?(?:0x)?([0-9a-fA-F]+)/i);
  if (abortMatch) {
    const abortCode = parseInt(abortMatch[1], 16);
    return parseAbortCode(abortCode, rawStatus);
  }

  // Parse "ABORTED" with code
  const abortedMatch = vmStatus.match(/ABORTED.*?(?:code\s*)?(?:0x)?([0-9a-fA-F]+)/i);
  if (abortedMatch) {
    const abortCode = parseInt(abortedMatch[1], 16);
    return parseAbortCode(abortCode, rawStatus);
  }

  // Parse major status codes
  const statusMatch = vmStatus.match(/status(?:\s*code)?:?\s*(\d+)/i);
  if (statusMatch) {
    const statusCode = statusMatch[1];
    const known = MAJOR_STATUS_CODES[statusCode];
    if (known) {
      return {
        success: false,
        code: statusCode,
        name: known.name,
        description: known.description,
        category: 'VM Error',
        suggestion: getSuggestionForStatus(known.name),
        rawStatus,
      };
    }
  }

  // Check for common error patterns in the string
  for (const [errorName, errorInfo] of Object.entries(FRAMEWORK_ERRORS)) {
    if (vmStatus.toUpperCase().includes(errorName)) {
      return {
        success: false,
        code: errorName,
        name: errorName,
        description: errorInfo.error,
        category: `${errorInfo.module} module`,
        suggestion: errorInfo.suggestion,
        rawStatus,
      };
    }
  }

  // Check for out of gas
  if (vmStatus.toLowerCase().includes('out of gas')) {
    return {
      success: false,
      code: 'OUT_OF_GAS',
      name: 'OUT_OF_GAS',
      description: 'Transaction ran out of gas during execution',
      category: 'Resource Limit',
      suggestion: 'Increase max_gas_amount or optimize the transaction to use less gas',
      rawStatus,
    };
  }

  // Check for timeout
  if (vmStatus.toLowerCase().includes('timeout')) {
    return {
      success: false,
      code: 'TIMEOUT',
      name: 'EXECUTION_TIMEOUT',
      description: 'Transaction execution timed out',
      category: 'Resource Limit',
      suggestion: 'Simplify the transaction or break it into smaller operations',
      rawStatus,
    };
  }

  // Unknown error
  return {
    success: false,
    code: 'UNKNOWN',
    name: 'UNKNOWN_ERROR',
    description: 'An unknown error occurred',
    category: 'Unknown',
    suggestion: 'Check the raw VM status for more details',
    rawStatus,
  };
}

/**
 * Parse a Move abort code
 */
function parseAbortCode(abortCode: number, rawStatus: string): ParsedVMStatus {
  // Check known abort codes
  const known = MOVE_ABORT_CODES[abortCode];
  if (known) {
    return {
      success: false,
      code: `0x${abortCode.toString(16)}`,
      name: known.category,
      description: known.reason,
      category: 'Move Abort',
      suggestion: getSuggestionForAbort(known.category),
      rawStatus,
    };
  }

  // Parse abort code structure
  // Upper 8 bits = category, lower bits = reason
  const category = (abortCode >> 16) & 0xFF;
  const reason = abortCode & 0xFFFF;

  const categoryName = getCategoryName(category);

  return {
    success: false,
    code: `0x${abortCode.toString(16)}`,
    name: `${categoryName}_${reason}`,
    description: `${categoryName} error (reason code: ${reason})`,
    category: 'Move Abort',
    suggestion: getSuggestionForCategory(category),
    rawStatus,
  };
}

/**
 * Get category name from category code
 */
function getCategoryName(category: number): string {
  const categories: Record<number, string> = {
    1: 'INVALID_ARGUMENT',
    2: 'OUT_OF_RANGE',
    3: 'INVALID_STATE',
    4: 'UNAUTHENTICATED',
    5: 'PERMISSION_DENIED',
    6: 'NOT_FOUND',
    7: 'ABORTED',
    8: 'ALREADY_EXISTS',
    9: 'RESOURCE_EXHAUSTED',
    10: 'INTERNAL',
    11: 'NOT_IMPLEMENTED',
    12: 'UNAVAILABLE',
  };
  return categories[category] || `CATEGORY_${category}`;
}

/**
 * Get suggestion for a category
 */
function getSuggestionForCategory(category: number): string {
  const suggestions: Record<number, string> = {
    1: 'Check the function arguments match expected types and values',
    2: 'Verify numeric values are within valid bounds',
    3: 'Ensure the contract is in the correct state for this operation',
    4: 'Verify the transaction is signed by the correct account',
    5: 'Check that the signer has the required permissions or roles',
    6: 'Ensure the resource or account exists before accessing it',
    7: 'Review the contract logic for abort conditions',
    8: 'The resource already exists - check for duplicate initialization',
    9: 'Resource limits exceeded - consider cleanup or pagination',
    10: 'Internal error - check contract implementation',
    11: 'This feature is not yet implemented in the contract',
    12: 'Service is temporarily unavailable - retry later',
  };
  return suggestions[category] || 'Review the contract code and transaction parameters';
}

/**
 * Get suggestion for abort category name
 */
function getSuggestionForAbort(categoryName: string): string {
  const suggestions: Record<string, string> = {
    'INVALID_ARGUMENT': 'Check the function arguments match expected types and values',
    'OUT_OF_RANGE': 'Verify numeric values are within valid bounds',
    'INVALID_STATE': 'Ensure the contract is in the correct state for this operation',
    'UNAUTHENTICATED': 'Verify the transaction is signed by the correct account',
    'PERMISSION_DENIED': 'Check that the signer has the required permissions or roles',
    'NOT_FOUND': 'Ensure the resource or account exists before accessing it',
    'ABORTED': 'Review the contract logic for abort conditions',
    'ALREADY_EXISTS': 'The resource already exists - check for duplicate initialization',
    'RESOURCE_EXHAUSTED': 'Resource limits exceeded - consider cleanup or pagination',
    'INTERNAL': 'Internal error - check contract implementation',
    'NOT_IMPLEMENTED': 'This feature is not yet implemented in the contract',
    'UNAVAILABLE': 'Service is temporarily unavailable - retry later',
  };
  return suggestions[categoryName] || 'Review the contract code and transaction parameters';
}

/**
 * Get suggestion for major status code
 */
function getSuggestionForStatus(statusName: string): string {
  const suggestions: Record<string, string> = {
    'INVALID_SIGNATURE': 'Ensure the transaction is signed with the correct private key',
    'INVALID_AUTH_KEY': 'The authentication key has been rotated - use the current key',
    'SEQUENCE_NUMBER_TOO_OLD': 'Fetch the latest sequence number and retry the transaction',
    'SEQUENCE_NUMBER_TOO_NEW': 'Wait for pending transactions to complete or check sequence number',
    'INSUFFICIENT_BALANCE_FOR_FEE': 'Add more MOVE tokens to cover gas fees',
    'TRANSACTION_EXPIRED': 'Increase transaction expiration time or submit faster',
    'SENDING_ACCOUNT_DOES_NOT_EXIST': 'Create and fund the sender account first',
    'OUT_OF_GAS': 'Increase max_gas_amount or optimize the transaction',
    'RESOURCE_DOES_NOT_EXIST': 'Initialize the required resource before accessing it',
    'RESOURCE_ALREADY_EXISTS': 'Check if the resource was already created',
    'ABORTED': 'Review the Move code abort conditions',
    'ARITHMETIC_ERROR': 'Check for integer overflow/underflow in calculations',
  };
  return suggestions[statusName] || 'Review the transaction parameters and contract state';
}

/**
 * Format a parsed status for display in notifications
 */
export function formatStatusForNotification(parsed: ParsedVMStatus): string {
  if (parsed.success) {
    return '✅ Transaction executed successfully';
  }

  return `❌ **${parsed.name}**
${parsed.description}

💡 **Suggestion:** ${parsed.suggestion}`;
}

/**
 * Get a short summary of the error
 */
export function getErrorSummary(parsed: ParsedVMStatus): string {
  if (parsed.success) return 'Success';
  return `${parsed.name}: ${parsed.description}`;
}
