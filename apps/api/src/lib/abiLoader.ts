/**
 * ABI Loader Service
 * Fetches and caches module ABIs from Movement Network
 *
 * Provides:
 * - Module ABI fetching with caching
 * - Function signature extraction
 * - Type argument parsing
 * - Argument type inference for auto-complete
 */

import type { Network } from '@movewatch/shared';
import { getMovementClient } from './movement.js';
import { cacheGet, cacheSet } from './redis.js';

// Cache duration: 1 hour (modules rarely change)
const ABI_CACHE_TTL = 60 * 60;

// ============================================================================
// TYPES
// ============================================================================

export interface MoveFunctionABI {
  name: string;
  visibility: 'public' | 'private' | 'friend' | 'entry';
  is_entry: boolean;
  is_view: boolean;
  generic_type_params: Array<{
    constraints: string[];
  }>;
  params: string[];
  return: string[];
}

export interface MoveStructABI {
  name: string;
  is_native: boolean;
  abilities: string[];
  generic_type_params: Array<{
    constraints: string[];
    is_phantom: boolean;
  }>;
  fields: Array<{
    name: string;
    type: string;
  }>;
}

export interface MoveModuleABI {
  address: string;
  name: string;
  friends: string[];
  exposed_functions: MoveFunctionABI[];
  structs: MoveStructABI[];
}

export interface ModuleInfo {
  address: string;
  name: string;
  abi: MoveModuleABI | null;
  bytecodeSize: number;
  hasBytecode: boolean;
}

export interface FunctionInfo {
  name: string;
  fullPath: string;
  visibility: string;
  isEntry: boolean;
  isView: boolean;
  typeParameters: number;
  typeParameterConstraints: string[][];
  parameters: ParsedParameter[];
  returnTypes: string[];
  signature: string;
  description?: string;
}

export interface ParsedParameter {
  index: number;
  type: string;
  baseType: string;
  isGeneric: boolean;
  isReference: boolean;
  isMutable: boolean;
  isSigner: boolean;
  genericIndex?: number;
  innerTypes?: string[];
  description?: string;
}

// ============================================================================
// ABI FETCHING
// ============================================================================

/**
 * Get module ABI from cache or fetch from network
 */
export async function getModuleABI(
  network: Network,
  moduleAddress: string,
  moduleName: string
): Promise<ModuleInfo | null> {
  const cacheKey = `abi:${network}:${moduleAddress}:${moduleName}`;

  // Try cache first
  const cached = await cacheGet<ModuleInfo>(cacheKey);
  if (cached) {
    console.log(`[ABI] Cache hit for ${moduleAddress}::${moduleName}`);
    return cached;
  }

  // Fetch from network
  try {
    const client = getMovementClient(network);
    const module = await client.getAccountModule({
      accountAddress: moduleAddress,
      moduleName: moduleName,
    });

    if (!module) {
      return null;
    }

    const moduleInfo: ModuleInfo = {
      address: moduleAddress,
      name: moduleName,
      abi: module.abi as unknown as MoveModuleABI | null,
      bytecodeSize: module.bytecode ? module.bytecode.length / 2 : 0,
      hasBytecode: !!module.bytecode,
    };

    // Cache the result
    await cacheSet(cacheKey, moduleInfo, ABI_CACHE_TTL);
    console.log(`[ABI] Cached ${moduleAddress}::${moduleName}`);

    return moduleInfo;
  } catch (error) {
    console.error(`[ABI] Failed to fetch ${moduleAddress}::${moduleName}:`, error);
    return null;
  }
}

/**
 * List all modules for an account
 */
export async function listAccountModules(
  network: Network,
  accountAddress: string
): Promise<string[]> {
  const cacheKey = `modules:${network}:${accountAddress}`;

  // Try cache first
  const cached = await cacheGet<string[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const client = getMovementClient(network);
    const modules = await client.getAccountModules({
      accountAddress: accountAddress,
    });

    const moduleNames = modules
      .map((m) => (m.abi as unknown as MoveModuleABI | null)?.name)
      .filter((name): name is string => !!name);

    // Cache for 5 minutes (modules list changes more often than individual ABIs)
    await cacheSet(cacheKey, moduleNames, 300);

    return moduleNames;
  } catch (error) {
    console.error(`[ABI] Failed to list modules for ${accountAddress}:`, error);
    return [];
  }
}

// ============================================================================
// FUNCTION EXTRACTION
// ============================================================================

/**
 * Get all entry functions from a module
 */
export function getEntryFunctions(abi: MoveModuleABI): FunctionInfo[] {
  if (!abi.exposed_functions) {
    return [];
  }

  return abi.exposed_functions
    .filter((fn) => fn.is_entry)
    .map((fn) => parseFunctionABI(abi.address, abi.name, fn));
}

/**
 * Get all view functions from a module
 */
export function getViewFunctions(abi: MoveModuleABI): FunctionInfo[] {
  if (!abi.exposed_functions) {
    return [];
  }

  return abi.exposed_functions
    .filter((fn) => fn.is_view)
    .map((fn) => parseFunctionABI(abi.address, abi.name, fn));
}

/**
 * Get all public functions from a module
 */
export function getPublicFunctions(abi: MoveModuleABI): FunctionInfo[] {
  if (!abi.exposed_functions) {
    return [];
  }

  return abi.exposed_functions
    .filter((fn) => fn.visibility === 'public' || fn.is_entry)
    .map((fn) => parseFunctionABI(abi.address, abi.name, fn));
}

/**
 * Get a specific function by name
 */
export function getFunction(abi: MoveModuleABI, functionName: string): FunctionInfo | null {
  if (!abi.exposed_functions) {
    return null;
  }

  const fn = abi.exposed_functions.find((f) => f.name === functionName);
  if (!fn) {
    return null;
  }

  return parseFunctionABI(abi.address, abi.name, fn);
}

/**
 * Parse function ABI into structured FunctionInfo
 */
function parseFunctionABI(
  moduleAddress: string,
  moduleName: string,
  fn: MoveFunctionABI
): FunctionInfo {
  const fullPath = `${moduleAddress}::${moduleName}::${fn.name}`;

  // Parse parameters (skip signer params for entry functions)
  const parameters = fn.params.map((param, index) => parseParameter(param, index));

  // Build human-readable signature
  const typeParams =
    fn.generic_type_params.length > 0
      ? `<${fn.generic_type_params.map((_, i) => `T${i}`).join(', ')}>`
      : '';

  const paramStr = parameters
    .filter((p) => !p.isSigner) // Don't show signer in signature
    .map((p) => `${p.type}`)
    .join(', ');

  const returnStr = fn.return.length > 0 ? ` -> ${fn.return.join(', ')}` : '';

  const signature = `${fn.name}${typeParams}(${paramStr})${returnStr}`;

  return {
    name: fn.name,
    fullPath,
    visibility: fn.visibility,
    isEntry: fn.is_entry,
    isView: fn.is_view,
    typeParameters: fn.generic_type_params.length,
    typeParameterConstraints: fn.generic_type_params.map((tp) => tp.constraints),
    parameters,
    returnTypes: fn.return,
    signature,
    description: generateFunctionDescription(fn),
  };
}

/**
 * Parse a parameter type string into structured info
 */
function parseParameter(typeStr: string, index: number): ParsedParameter {
  let type = typeStr;
  let isReference = false;
  let isMutable = false;
  let isSigner = false;
  let isGeneric = false;
  let genericIndex: number | undefined;
  let innerTypes: string[] | undefined;

  // Check for reference types
  if (type.startsWith('&mut ')) {
    isReference = true;
    isMutable = true;
    type = type.slice(5);
  } else if (type.startsWith('&')) {
    isReference = true;
    type = type.slice(1);
  }

  // Check for signer
  if (type === 'signer' || type === '&signer') {
    isSigner = true;
  }

  // Check for generic type parameter (T0, T1, etc.)
  const genericMatch = type.match(/^T(\d+)$/);
  if (genericMatch) {
    isGeneric = true;
    genericIndex = parseInt(genericMatch[1], 10);
  }

  // Extract base type (without generics)
  const baseType = type.split('<')[0];

  // Extract inner types for generics like vector<T> or CoinStore<T>
  const innerMatch = type.match(/<(.+)>/);
  if (innerMatch) {
    innerTypes = splitTypeArgs(innerMatch[1]);
  }

  return {
    index,
    type: typeStr,
    baseType,
    isGeneric,
    isReference,
    isMutable,
    isSigner,
    genericIndex,
    innerTypes,
    description: getParameterDescription(baseType, isSigner),
  };
}

/**
 * Split type arguments handling nested generics
 */
function splitTypeArgs(typeArgsStr: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of typeArgsStr) {
    if (char === '<') {
      depth++;
      current += char;
    } else if (char === '>') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Generate a human-readable description for a function
 */
function generateFunctionDescription(fn: MoveFunctionABI): string {
  const parts: string[] = [];

  if (fn.is_entry) {
    parts.push('Entry function');
  } else if (fn.is_view) {
    parts.push('View function');
  } else {
    parts.push('Public function');
  }

  if (fn.generic_type_params.length > 0) {
    parts.push(`with ${fn.generic_type_params.length} type parameter(s)`);
  }

  const nonSignerParams = fn.params.filter((p) => !p.includes('signer'));
  if (nonSignerParams.length > 0) {
    parts.push(`taking ${nonSignerParams.length} argument(s)`);
  }

  if (fn.return.length > 0) {
    parts.push(`returning ${fn.return.length} value(s)`);
  }

  return parts.join(', ');
}

/**
 * Get description for common parameter types
 */
function getParameterDescription(baseType: string, isSigner: boolean): string {
  if (isSigner) {
    return 'Transaction signer (automatically provided)';
  }

  const descriptions: Record<string, string> = {
    'address': 'Account address (0x...)',
    'u8': 'Unsigned 8-bit integer (0-255)',
    'u16': 'Unsigned 16-bit integer',
    'u32': 'Unsigned 32-bit integer',
    'u64': 'Unsigned 64-bit integer',
    'u128': 'Unsigned 128-bit integer',
    'u256': 'Unsigned 256-bit integer',
    'bool': 'Boolean (true/false)',
    'vector': 'Array/list of values',
    '0x1::string::String': 'UTF-8 string',
    '0x1::option::Option': 'Optional value (can be null)',
  };

  return descriptions[baseType] || `${baseType} value`;
}

// ============================================================================
// TYPE INFERENCE FOR FORM GENERATION
// ============================================================================

export interface ArgumentField {
  index: number;
  name: string;
  type: string;
  inputType: 'text' | 'number' | 'boolean' | 'address' | 'array' | 'object';
  placeholder: string;
  description: string;
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

/**
 * Generate form fields from function parameters
 */
export function generateArgumentFields(fn: FunctionInfo): ArgumentField[] {
  return fn.parameters
    .filter((p) => !p.isSigner) // Skip signer params
    .map((param, idx) => {
      const field: ArgumentField = {
        index: idx,
        name: `arg${idx}`,
        type: param.type,
        inputType: inferInputType(param),
        placeholder: inferPlaceholder(param),
        description: param.description || '',
        required: true,
      };

      // Add validation rules
      field.validation = inferValidation(param);

      return field;
    });
}

/**
 * Infer HTML input type from parameter type
 */
function inferInputType(param: ParsedParameter): ArgumentField['inputType'] {
  const { baseType } = param;

  if (baseType === 'address') {
    return 'address';
  }

  if (baseType === 'bool') {
    return 'boolean';
  }

  if (['u8', 'u16', 'u32', 'u64', 'u128', 'u256'].includes(baseType)) {
    return 'number';
  }

  if (baseType === 'vector') {
    return 'array';
  }

  if (baseType.includes('::')) {
    // Struct type
    return 'object';
  }

  return 'text';
}

/**
 * Generate placeholder text for a parameter
 */
function inferPlaceholder(param: ParsedParameter): string {
  const { baseType, innerTypes } = param;

  if (baseType === 'address') {
    return '0x1234...';
  }

  if (baseType === 'bool') {
    return 'true or false';
  }

  if (['u8', 'u16', 'u32', 'u64', 'u128', 'u256'].includes(baseType)) {
    return '0';
  }

  if (baseType === 'vector') {
    const inner = innerTypes?.[0] || 'value';
    if (inner === 'u8') {
      return '0x... (hex bytes)';
    }
    return `["${inner}", ...]`;
  }

  if (baseType === '0x1::string::String') {
    return 'Enter text...';
  }

  return `Enter ${baseType}...`;
}

/**
 * Infer validation rules for a parameter
 */
function inferValidation(param: ParsedParameter): ArgumentField['validation'] {
  const { baseType } = param;

  if (baseType === 'address') {
    return {
      pattern: '^0x[a-fA-F0-9]{1,64}$',
    };
  }

  if (baseType === 'u8') {
    return { min: 0, max: 255 };
  }

  if (baseType === 'u16') {
    return { min: 0, max: 65535 };
  }

  if (baseType === 'u32') {
    return { min: 0, max: 4294967295 };
  }

  // For u64/u128/u256, we use string input due to JS number limits
  if (['u64', 'u128', 'u256'].includes(baseType)) {
    return {
      pattern: '^[0-9]+$',
    };
  }

  return undefined;
}

// ============================================================================
// POPULAR MODULES
// ============================================================================

/**
 * List of popular/common modules for quick access
 */
export const POPULAR_MODULES = [
  { address: '0x1', name: 'coin', description: 'Token operations (transfer, balance)' },
  { address: '0x1', name: 'aptos_account', description: 'Account management' },
  { address: '0x1', name: 'aptos_coin', description: 'Native APT/MOVE token' },
  { address: '0x1', name: 'managed_coin', description: 'Managed token operations' },
  { address: '0x1', name: 'object', description: 'Object model operations' },
  { address: '0x3', name: 'token', description: 'NFT/token standard (legacy)' },
  { address: '0x4', name: 'collection', description: 'NFT collection (v2)' },
  { address: '0x4', name: 'token', description: 'NFT token (v2)' },
];

/**
 * Search modules by name (for autocomplete)
 */
export async function searchModules(
  network: Network,
  query: string,
  limit: number = 10
): Promise<Array<{ address: string; name: string; description?: string }>> {
  const results: Array<{ address: string; name: string; description?: string }> = [];

  // First, add matching popular modules
  const queryLower = query.toLowerCase();
  for (const mod of POPULAR_MODULES) {
    if (mod.name.toLowerCase().includes(queryLower) || mod.address.includes(queryLower)) {
      results.push(mod);
    }
  }

  // If query looks like an address, fetch its modules
  if (query.startsWith('0x') && query.length > 4) {
    try {
      const modules = await listAccountModules(network, query);
      for (const name of modules) {
        if (!results.find((r) => r.address === query && r.name === name)) {
          results.push({ address: query, name });
        }
      }
    } catch {
      // Ignore errors for autocomplete
    }
  }

  return results.slice(0, limit);
}
