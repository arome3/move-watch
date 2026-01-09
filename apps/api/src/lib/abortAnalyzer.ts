/**
 * Abort Analyzer
 * Parses Move VM abort codes into human-readable error messages
 */

// Known Move stdlib abort codes
const MOVE_STDLIB_ABORT_CODES: Record<string, Record<number, string>> = {
  '0x1::coin': {
    1: 'ECOIN_INFO_ADDRESS_MISMATCH - Coin info address does not match',
    2: 'ECOIN_INFO_ALREADY_PUBLISHED - Coin info already exists',
    3: 'ECOIN_INFO_NOT_PUBLISHED - Coin info does not exist',
    4: 'ECOIN_STORE_ALREADY_PUBLISHED - Coin store already exists',
    5: 'ECOIN_STORE_NOT_PUBLISHED - Coin store does not exist for this account',
    6: 'EINSUFFICIENT_BALANCE - Insufficient balance to complete transfer',
    7: 'EDESTRUCTION_OF_NONZERO_TOKEN - Cannot destroy non-zero coin value',
    8: 'ETOTAL_SUPPLY_OVERFLOW - Total supply would overflow',
    10: 'EFROZEN - Coin store is frozen',
    11: 'ECOIN_SUPPLY_UPGRADE_NOT_SUPPORTED - Coin supply upgrade not supported',
    12: 'ECOIN_NAME_TOO_LONG - Coin name exceeds maximum length',
    13: 'ECOIN_SYMBOL_TOO_LONG - Coin symbol exceeds maximum length',
  },
  '0x1::account': {
    1: 'EACCOUNT_ALREADY_EXISTS - Account already exists',
    2: 'EACCOUNT_DOES_NOT_EXIST - Account does not exist',
    3: 'ESEQUENCE_NUMBER_TOO_OLD - Sequence number too old',
    4: 'EMALFORMED_AUTHENTICATION_KEY - Authentication key is malformed',
    5: 'ECANNOT_RESERVED_ADDRESS - Cannot use reserved address',
    6: 'EOUT_OF_GAS - Transaction ran out of gas',
    7: 'EWRONG_CURRENT_PUBLIC_KEY - Wrong current public key',
    8: 'EINVALID_PROOF_OF_KNOWLEDGE - Invalid proof of knowledge',
    9: 'ENO_CAPABILITY - Account does not have required capability',
    10: 'EINVALID_ACCEPT_ROTATION_CAPABILITY - Invalid rotation capability',
    11: 'ENO_VALID_FRAMEWORK_RESERVED_ADDRESS - Not a valid framework reserved address',
    12: 'EINVALID_SCHEME - Invalid authentication scheme',
    13: 'EINVALID_ORIGINATING_ADDRESS - Invalid originating address',
    14: 'ENO_SUCH_SIGNER_CAPABILITY - No such signer capability',
    15: 'EOFFERED_SIGNER_CAPABILITY - Signer capability already offered',
  },
  '0x1::aptos_account': {
    1: 'EACCOUNT_NOT_FOUND - Account not found',
    2: 'EACCOUNT_NOT_REGISTERED_FOR_APT - Account not registered for APT',
    3: 'EINSUFFICIENT_BALANCE - Insufficient APT balance',
  },
  '0x1::object': {
    1: 'ENOT_OBJECT_OWNER - Caller is not the object owner',
    2: 'ENOT_OBJECT - Address is not an object',
    3: 'ECANNOT_DELETE - Object cannot be deleted',
    4: 'EMAXIMUM_NESTING - Maximum object nesting depth exceeded',
    5: 'EOBJECT_EXISTS - Object already exists',
    6: 'EOBJECT_NOT_TRANSFERRABLE - Object is not transferrable',
    7: 'ECANNOT_GENERATE_LINEAR_TRANSFER_REF - Cannot generate linear transfer ref',
  },
  '0x1::fungible_asset': {
    1: 'EINSUFFICIENT_BALANCE - Insufficient fungible asset balance',
    2: 'EMAX_SUPPLY_EXCEEDED - Maximum supply exceeded',
    3: 'EDEPOSIT_NOT_ALLOWED - Deposit not allowed',
    4: 'EWITHDRAW_NOT_ALLOWED - Withdrawal not allowed',
    5: 'ENOT_STORE_OWNER - Caller is not the store owner',
    6: 'EBALANCE_IS_NOT_ZERO - Balance must be zero',
    7: 'EFROZEN - Fungible store is frozen',
    8: 'EAMOUNT_IS_NOT_ZERO - Amount must be zero',
  },
  '0x1::primary_fungible_store': {
    1: 'ESTORE_NOT_FOUND - Primary fungible store not found',
    2: 'ENOT_DISPATCHABLE_FUNGIBLE_ASSET - Not a dispatchable fungible asset',
  },
  '0x1::vector': {
    1: 'EINDEX_OUT_OF_BOUNDS - Vector index out of bounds',
    2: 'EINVALID_RANGE - Invalid range specified',
    3: 'EVECTORS_LENGTH_MISMATCH - Vector lengths do not match',
  },
  '0x1::string': {
    1: 'EINVALID_UTF8 - String contains invalid UTF-8 bytes',
    2: 'EINVALID_INDEX - Invalid string index',
  },
  '0x1::option': {
    1: 'EOPTION_IS_SET - Option already has a value',
    2: 'EOPTION_NOT_SET - Option does not have a value',
  },
  '0x1::signer': {
    1: 'ENOT_SIGNER - Address is not a signer',
  },
  '0x1::table': {
    1: 'EALREADY_EXISTS - Key already exists in table',
    2: 'ENOT_FOUND - Key not found in table',
  },
  '0x1::smart_table': {
    1: 'ENOT_FOUND - Key not found in smart table',
    2: 'EALREADY_EXIST - Key already exists in smart table',
    3: 'EINVALID_BUCKET_INDEX - Invalid bucket index',
    4: 'EINVALID_TARGET_BUCKET_SIZE - Invalid target bucket size',
  },
};

// Generic abort code patterns
const GENERIC_ABORT_PATTERNS = [
  { code: 0, message: 'Generic error - check transaction parameters' },
  { code: 1, message: 'Invalid state or precondition failed' },
  { code: 2, message: 'Resource not found or does not exist' },
  { code: 3, message: 'Permission denied or unauthorized' },
  { code: 4, message: 'Invalid argument or parameter' },
  { code: 5, message: 'Resource already exists' },
  { code: 6, message: 'Insufficient balance or funds' },
  { code: 7, message: 'Operation not allowed in current state' },
  { code: 255, message: 'Assertion failed' },
  { code: 65537, message: 'E_INVALID_ARGUMENT - Invalid function argument' },
  { code: 65538, message: 'E_OUT_OF_RANGE - Value out of valid range' },
  { code: 65539, message: 'E_INVALID_STATE - Invalid state for operation' },
  { code: 65540, message: 'E_UNAUTHENTICATED - Authentication required' },
  { code: 65541, message: 'E_PERMISSION_DENIED - Permission denied' },
  { code: 65542, message: 'E_NOT_FOUND - Resource not found' },
  { code: 65543, message: 'E_ABORTED - Operation aborted' },
  { code: 65544, message: 'E_ALREADY_EXISTS - Resource already exists' },
  { code: 65545, message: 'E_RESOURCE_EXHAUSTED - Resource exhausted' },
  { code: 65546, message: 'E_CANCELLED - Operation cancelled' },
];

export interface AbortAnalysis {
  code: number;
  module: string;
  function?: string;
  humanReadable: string;
  suggestion: string;
  severity: 'error' | 'warning';
  possibleCauses: string[];
  documentation?: string;
}

/**
 * Parse VM error message to extract abort details
 */
export function parseVMError(errorMessage: string): {
  code: number;
  module: string;
  function?: string;
  location?: string;
} | null {
  // Pattern: "Move abort in 0x1::coin::transfer: EINSUFFICIENT_BALANCE(code: 6)"
  const abortMatch = errorMessage.match(
    /(?:Move abort|ABORT_CODE|abort code)[^\d]*(\d+)/i
  );

  // Pattern: "0x1::module::function"
  const locationMatch = errorMessage.match(
    /(0x[a-fA-F0-9]+)::([\w]+)(?:::([\w]+))?/
  );

  if (!abortMatch && !locationMatch) {
    return null;
  }

  return {
    code: abortMatch ? parseInt(abortMatch[1], 10) : 0,
    module: locationMatch ? `${locationMatch[1]}::${locationMatch[2]}` : 'unknown',
    function: locationMatch?.[3],
    location: locationMatch?.[0],
  };
}

/**
 * Analyze an abort code and return human-readable information
 */
export function analyzeAbort(
  code: number,
  module: string,
  functionName?: string
): AbortAnalysis {
  // Check module-specific codes first
  const moduleKey = module.toLowerCase();
  const moduleAborts = Object.entries(MOVE_STDLIB_ABORT_CODES).find(
    ([key]) => moduleKey.includes(key.toLowerCase().replace('0x1::', ''))
  );

  let humanReadable = `Abort code ${code}`;
  let suggestion = 'Check the transaction parameters and account state';
  const possibleCauses: string[] = [];

  if (moduleAborts) {
    const [, codes] = moduleAborts;
    if (codes[code]) {
      const [errorName, description] = codes[code].split(' - ');
      humanReadable = `${errorName}: ${description}`;

      // Generate specific suggestions based on error type
      if (errorName.includes('INSUFFICIENT_BALANCE')) {
        suggestion = 'Ensure the sender account has enough balance to cover the transfer amount plus gas fees';
        possibleCauses.push(
          'Account balance is lower than the transfer amount',
          'Gas fees would exceed remaining balance',
          'Token is locked or staked'
        );
      } else if (errorName.includes('NOT_PUBLISHED') || errorName.includes('NOT_FOUND')) {
        suggestion = 'The required resource does not exist. Initialize the account or resource first';
        possibleCauses.push(
          'Account has not been initialized',
          'Coin store not registered for this token type',
          'Resource was deleted or never created'
        );
      } else if (errorName.includes('ALREADY') || errorName.includes('EXISTS')) {
        suggestion = 'The resource already exists. Use update functions instead of create';
        possibleCauses.push(
          'Trying to create a resource that already exists',
          'Account or coin store already initialized'
        );
      } else if (errorName.includes('FROZEN')) {
        suggestion = 'The account or coin store is frozen. Contact the asset issuer';
        possibleCauses.push(
          'Account has been frozen by administrator',
          'Compliance hold on the account'
        );
      } else if (errorName.includes('OWNER') || errorName.includes('PERMISSION')) {
        suggestion = 'Only the owner or authorized accounts can perform this operation';
        possibleCauses.push(
          'Caller is not the object/resource owner',
          'Missing required capability or permission'
        );
      }
    }
  }

  // Check generic patterns if no specific match
  if (humanReadable === `Abort code ${code}`) {
    const genericMatch = GENERIC_ABORT_PATTERNS.find(p => p.code === code);
    if (genericMatch) {
      humanReadable = genericMatch.message;
    }
  }

  // Add default possible causes if empty
  if (possibleCauses.length === 0) {
    possibleCauses.push(
      'Invalid transaction parameters',
      'Account state has changed since simulation',
      'Missing required resources or permissions'
    );
  }

  return {
    code,
    module,
    function: functionName,
    humanReadable,
    suggestion,
    severity: 'error',
    possibleCauses,
    documentation: `https://aptos.dev/concepts/error-codes#${code}`,
  };
}

/**
 * Analyze a failed simulation and return detailed abort information
 */
export function analyzeFailedSimulation(
  vmStatus: string,
  errorMessage?: string
): AbortAnalysis | null {
  // Parse the VM status/error message
  const parsed = parseVMError(vmStatus) || (errorMessage ? parseVMError(errorMessage) : null);

  if (!parsed) {
    // Try to extract any useful information
    if (vmStatus.includes('OUT_OF_GAS') || errorMessage?.includes('OUT_OF_GAS')) {
      return {
        code: 6,
        module: 'vm',
        humanReadable: 'OUT_OF_GAS: Transaction ran out of gas',
        suggestion: 'Increase the max_gas_amount parameter',
        severity: 'error',
        possibleCauses: [
          'Transaction is more complex than estimated',
          'Max gas amount is set too low',
          'Infinite loop or unbounded computation'
        ],
      };
    }

    if (vmStatus.includes('SEQUENCE_NUMBER') || errorMessage?.includes('SEQUENCE_NUMBER')) {
      return {
        code: 3,
        module: '0x1::account',
        humanReadable: 'SEQUENCE_NUMBER_MISMATCH: Transaction sequence number is incorrect',
        suggestion: 'Fetch the latest sequence number from the account',
        severity: 'error',
        possibleCauses: [
          'Another transaction was submitted with the same sequence number',
          'Cached sequence number is stale',
          'Concurrent transactions from the same account'
        ],
      };
    }

    return null;
  }

  return analyzeAbort(parsed.code, parsed.module, parsed.function);
}

/**
 * Format abort analysis for display
 */
export function formatAbortForDisplay(analysis: AbortAnalysis): string {
  const lines = [
    `Error: ${analysis.humanReadable}`,
    `Module: ${analysis.module}${analysis.function ? `::${analysis.function}` : ''}`,
    `Code: ${analysis.code}`,
    '',
    `Suggestion: ${analysis.suggestion}`,
    '',
    'Possible causes:',
    ...analysis.possibleCauses.map(c => `  - ${c}`),
  ];

  return lines.join('\n');
}
