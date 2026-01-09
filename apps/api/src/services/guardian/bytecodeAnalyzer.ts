/**
 * Bytecode Analyzer Service
 *
 * Fetches and analyzes Move module bytecode from on-chain data.
 * This provides ACTUAL security analysis by examining the deployed code,
 * not just function names provided by the user.
 *
 * Key capabilities:
 * 1. Fetch module ABI/bytecode from Aptos REST API
 * 2. Analyze exposed functions, visibility, and capabilities
 * 3. Detect dangerous patterns in actual code
 * 4. Compare claimed function with actual module behavior
 *
 * References:
 * - Aptos Module API: https://aptos.dev/rest-api/operations/get_account_module
 * - Revela Decompiler: https://github.com/verichains/revela
 * - MoveScanner research: https://arxiv.org/html/2508.17964
 */

import type { Network, RiskSeverity } from '@movewatch/shared';
import { NETWORK_CONFIGS } from '@movewatch/shared';
import type { DetectedIssue } from './types.js';
import { CONFIDENCE_LEVELS } from './utils.js';
import {
  analyzeModuleSemantics,
  extractFunctionABIInfo,
  type MoveModuleABI as SemanticMoveModuleABI,
} from './semanticAnalyzer.js';

// Types for Aptos module API response
interface MoveFunction {
  name: string;
  visibility: 'public' | 'private' | 'friend' | 'script';
  is_entry: boolean;
  is_view: boolean;
  generic_type_params: Array<{ constraints: string[] }>;
  params: string[];
  return: string[];
}

interface MoveStruct {
  name: string;
  is_native: boolean;
  abilities: string[]; // 'copy', 'drop', 'store', 'key'
  generic_type_params: Array<{ constraints: string[] }>;
  fields: Array<{ name: string; type: string }>;
}

interface MoveModuleABI {
  address: string;
  name: string;
  friends: string[];
  exposed_functions: MoveFunction[];
  structs: MoveStruct[];
}

interface MoveModule {
  bytecode: string;
  abi: MoveModuleABI;
}

export interface BytecodeAnalysisResult {
  moduleExists: boolean;
  moduleVerified: boolean;
  functionExists: boolean;
  functionInfo?: MoveFunction;
  issues: DetectedIssue[];
  metadata: {
    moduleAddress: string;
    moduleName: string;
    totalFunctions: number;
    entryFunctions: number;
    hasResourceAbilities: boolean;
    friendModules: string[];
  };
  rawAbi?: MoveModuleABI;
  // Semantic analysis results
  semanticAnalysis?: {
    vulnerabilities: {
      id: string;
      name: string;
      severity: RiskSeverity;
      details: string;
      affectedItems: string[];
    }[];
    moduleMetrics: {
      totalFunctions: number;
      publicFunctions: number;
      entryFunctions: number;
      viewFunctions: number;
      totalStructs: number;
      resourceStructs: number;
      hasAdminFunctions: boolean;
      hasUpgradeFunction: boolean;
      hasPauseFunction: boolean;
    };
  };
  // Function-specific ABI info for signature analysis
  functionAbiInfo?: {
    abilities: string[];
    isEntry: boolean;
    isView: boolean;
    paramCount: number;
    genericCount: number;
    hasPublicMutRef: boolean;
    returnTypes: string[];
    paramTypes: string[];
  };
}

// Dangerous function patterns at the bytecode/ABI level
const DANGEROUS_FUNCTION_PATTERNS = {
  // Functions that can modify critical state
  criticalMutators: [
    /^set_owner$/i,
    /^transfer_ownership$/i,
    /^set_admin$/i,
    /^upgrade/i,
    /^migrate/i,
    /^emergency/i,
    /^pause$/i,
    /^unpause$/i,
    /^freeze$/i,
    /^blacklist/i,
    /^set_fee/i,
    /^withdraw_all/i,
    /^drain/i,
  ],
  // Functions that handle funds
  fundHandlers: [
    /^withdraw/i,
    /^transfer/i,
    /^mint$/i,
    /^burn$/i,
    /^deposit/i,
    /^claim/i,
  ],
  // Functions with unlimited access patterns
  unlimitedAccess: [
    /^approve/i,
    /^set_allowance/i,
    /^grant/i,
    /^authorize/i,
  ],
};

// Dangerous struct abilities
const DANGEROUS_ABILITIES = {
  // Structs that can be freely copied might leak resources
  copyWithoutDrop: (abilities: string[]) =>
    abilities.includes('copy') && !abilities.includes('drop'),
  // Structs with 'key' ability are resources - check if they have proper controls
  keyWithoutStore: (abilities: string[]) =>
    abilities.includes('key') && !abilities.includes('store'),
};

/**
 * Get the RPC URL for a network
 */
function getRpcUrl(network: Network): string {
  const config = NETWORK_CONFIGS[network];
  return config?.fullnode || 'https://fullnode.testnet.aptoslabs.com/v1';
}

/**
 * Fetch module ABI and bytecode from Aptos REST API
 */
export async function fetchModuleABI(
  network: Network,
  moduleAddress: string,
  moduleName: string
): Promise<MoveModule | null> {
  const rpcUrl = getRpcUrl(network);
  // Remove /v1 if present at the end and add it back consistently
  const baseUrl = rpcUrl.replace(/\/v1\/?$/, '');
  const url = `${baseUrl}/v1/accounts/${moduleAddress}/module/${moduleName}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Module not found: ${moduleAddress}::${moduleName}`);
        return null;
      }
      throw new Error(`Failed to fetch module: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as MoveModule;
    return data;
  } catch (error) {
    console.error(`Error fetching module ABI:`, error);
    return null;
  }
}

/**
 * Analyze a module's ABI for security issues
 */
export function analyzeModuleABI(abi: MoveModuleABI): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  // 1. Analyze exposed functions
  for (const func of abi.exposed_functions) {
    // Check for dangerous function patterns
    for (const [category, patterns] of Object.entries(DANGEROUS_FUNCTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(func.name)) {
          const severity = getSeverityForPattern(category, func);
          issues.push({
            patternId: `bytecode:function:${category}`,
            category: getCategoryForPattern(category),
            severity,
            title: `Dangerous Function: ${func.name}`,
            description: `The module exposes a ${func.visibility} function "${func.name}" that matches dangerous pattern category "${category}". This is verified from on-chain bytecode, not user input.`,
            recommendation: getRecommendationForPattern(category),
            confidence: CONFIDENCE_LEVELS.VERY_HIGH, // High confidence because we verified on-chain
            source: 'pattern' as const,
            evidence: {
              functionName: func.name,
              visibility: func.visibility,
              isEntry: func.is_entry,
              params: func.params,
              verifiedOnChain: true,
            },
          });
          break; // Only one issue per function
        }
      }
    }

    // Check for entry functions with no parameters (potential DoS vector)
    if (func.is_entry && func.params.length === 0 && func.visibility === 'public') {
      issues.push({
        patternId: 'bytecode:function:no_params_entry',
        category: 'PERMISSION',
        severity: 'LOW',
        title: `Public Entry Function Without Parameters`,
        description: `The function "${func.name}" is a public entry function with no parameters. Anyone can call this function, which may be intentional but could also be a DoS vector.`,
        recommendation: 'Verify this function should be callable by anyone without restrictions.',
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        source: 'pattern' as const,
        evidence: {
          functionName: func.name,
          verifiedOnChain: true,
        },
      });
    }

    // Check for functions that return signers or capabilities
    if (func.return.some(r => r.includes('signer') || r.includes('Capability'))) {
      issues.push({
        patternId: 'bytecode:function:returns_capability',
        category: 'PERMISSION',
        severity: 'HIGH',
        title: `Function Returns Signer/Capability`,
        description: `The function "${func.name}" returns a signer or capability, which could be used to escalate privileges.`,
        recommendation: 'Ensure capability/signer returns are properly controlled and not exposable to unauthorized callers.',
        confidence: CONFIDENCE_LEVELS.HIGH,
        source: 'pattern' as const,
        evidence: {
          functionName: func.name,
          returnTypes: func.return,
          verifiedOnChain: true,
        },
      });
    }
  }

  // 2. Analyze structs for resource safety
  for (const struct of abi.structs) {
    // Check for potentially unsafe ability combinations
    if (DANGEROUS_ABILITIES.copyWithoutDrop(struct.abilities)) {
      issues.push({
        patternId: 'bytecode:struct:copy_without_drop',
        category: 'EXPLOIT',
        severity: 'MEDIUM',
        title: `Resource with Copy but No Drop`,
        description: `The struct "${struct.name}" has 'copy' ability but not 'drop'. This could lead to resource duplication issues.`,
        recommendation: 'Review if this struct needs copy ability. Consider adding drop if appropriate.',
        confidence: CONFIDENCE_LEVELS.HIGH,
        source: 'pattern' as const,
        evidence: {
          structName: struct.name,
          abilities: struct.abilities,
          verifiedOnChain: true,
        },
      });
    }
  }

  // 3. Check for friend modules (potential privilege escalation paths)
  if (abi.friends.length > 0) {
    issues.push({
      patternId: 'bytecode:module:has_friends',
      category: 'PERMISSION',
      severity: 'LOW',
      title: `Module Has Friend Declarations`,
      description: `This module declares ${abi.friends.length} friend module(s): ${abi.friends.join(', ')}. Friend modules can access private functions.`,
      recommendation: 'Review friend modules to ensure they are trusted and their access is necessary.',
      confidence: CONFIDENCE_LEVELS.VERY_HIGH,
      source: 'pattern' as const,
      evidence: {
        friends: abi.friends,
        verifiedOnChain: true,
      },
    });
  }

  return issues;
}

/**
 * Get severity based on pattern category and function properties
 */
function getSeverityForPattern(category: string, func: MoveFunction): RiskSeverity {
  // Critical mutators are always high severity
  if (category === 'criticalMutators') {
    return func.is_entry ? 'CRITICAL' : 'HIGH';
  }
  // Fund handlers depend on visibility
  if (category === 'fundHandlers') {
    return func.visibility === 'public' && func.is_entry ? 'HIGH' : 'MEDIUM';
  }
  // Unlimited access is always high
  if (category === 'unlimitedAccess') {
    return 'HIGH';
  }
  return 'MEDIUM';
}

/**
 * Get risk category for pattern
 */
function getCategoryForPattern(category: string): 'EXPLOIT' | 'RUG_PULL' | 'PERMISSION' | 'EXCESSIVE_COST' {
  switch (category) {
    case 'criticalMutators':
      return 'PERMISSION';
    case 'fundHandlers':
      return 'RUG_PULL';
    case 'unlimitedAccess':
      return 'EXPLOIT';
    default:
      return 'PERMISSION';
  }
}

/**
 * Get recommendation for pattern
 */
function getRecommendationForPattern(category: string): string {
  switch (category) {
    case 'criticalMutators':
      return 'Verify the caller is authorized. Check for proper access controls and governance mechanisms.';
    case 'fundHandlers':
      return 'Review fund flow logic. Ensure proper balance checks and access controls are in place.';
    case 'unlimitedAccess':
      return 'Check for unlimited approvals or grants. Set appropriate limits and consider time-based expirations.';
    default:
      return 'Review this function carefully before interacting.';
  }
}

/**
 * Compare user-provided function with actual on-chain module
 * This detects if user is trying to call a function that doesn't exist
 * or has different properties than expected
 */
export function verifyFunctionExists(
  abi: MoveModuleABI,
  functionName: string
): { exists: boolean; function?: MoveFunction; mismatch?: string } {
  const func = abi.exposed_functions.find(f => f.name === functionName);

  if (!func) {
    return {
      exists: false,
      mismatch: `Function "${functionName}" does not exist in module ${abi.address}::${abi.name}`,
    };
  }

  return {
    exists: true,
    function: func,
  };
}

/**
 * Main bytecode analysis function
 * Fetches module from chain and performs comprehensive analysis
 */
export async function analyzeModuleBytecode(
  network: Network,
  moduleAddress: string,
  moduleName: string,
  functionName: string
): Promise<BytecodeAnalysisResult> {
  // Fetch module from chain
  const module = await fetchModuleABI(network, moduleAddress, moduleName);

  if (!module || !module.abi) {
    return {
      moduleExists: false,
      moduleVerified: false,
      functionExists: false,
      issues: [{
        patternId: 'bytecode:module:not_found',
        category: 'EXPLOIT',
        severity: 'HIGH',
        title: 'Module Not Found On-Chain',
        description: `The module ${moduleAddress}::${moduleName} could not be found on ${network}. This could indicate a non-existent contract, wrong network, or potential scam.`,
        recommendation: 'Verify the module address and name are correct. Check you are on the right network.',
        confidence: CONFIDENCE_LEVELS.VERY_HIGH,
        source: 'pattern' as const,
        evidence: {
          moduleAddress,
          moduleName,
          network,
        },
      }],
      metadata: {
        moduleAddress,
        moduleName,
        totalFunctions: 0,
        entryFunctions: 0,
        hasResourceAbilities: false,
        friendModules: [],
      },
    };
  }

  const abi = module.abi;

  // Verify function exists
  const functionVerification = verifyFunctionExists(abi, functionName);

  // Analyze module ABI (basic patterns)
  const abiIssues = analyzeModuleABI(abi);

  // Run semantic analysis for deep vulnerability detection
  // Convert ABI to semantic analyzer format
  const semanticAbi: SemanticMoveModuleABI = {
    address: abi.address,
    name: abi.name,
    friends: abi.friends,
    exposed_functions: abi.exposed_functions.map(f => ({
      name: f.name,
      visibility: f.visibility as 'public' | 'private' | 'friend',
      is_entry: f.is_entry,
      is_view: f.is_view,
      generic_type_params: f.generic_type_params,
      params: f.params,
      return: f.return,
    })),
    structs: abi.structs.map(s => ({
      name: s.name,
      is_native: s.is_native,
      abilities: s.abilities as ('copy' | 'drop' | 'store' | 'key')[],
      generic_type_params: s.generic_type_params,
      fields: s.fields,
    })),
  };

  const semanticResult = analyzeModuleSemantics(semanticAbi, functionName);

  // Extract function-specific ABI info for signature analysis
  const functionAbiInfo = extractFunctionABIInfo(semanticAbi, functionName);

  // Combine all issues
  const issues = [...abiIssues, ...semanticResult.issues];
  if (!functionVerification.exists) {
    issues.unshift({
      patternId: 'bytecode:function:not_found',
      category: 'EXPLOIT',
      severity: 'CRITICAL',
      title: 'Function Not Found In Module',
      description: functionVerification.mismatch || `The function "${functionName}" does not exist in this module.`,
      recommendation: 'Verify you are calling the correct function. This could be an attempt to trick you into signing a malicious transaction.',
      confidence: CONFIDENCE_LEVELS.VERY_HIGH,
      source: 'pattern' as const,
      evidence: {
        claimedFunction: functionName,
        availableFunctions: abi.exposed_functions.map(f => f.name),
      },
    });
  }

  // Calculate metadata
  const entryFunctions = abi.exposed_functions.filter(f => f.is_entry).length;
  const hasResourceAbilities = abi.structs.some(s =>
    s.abilities.includes('key') || s.abilities.includes('store')
  );

  return {
    moduleExists: true,
    moduleVerified: true,
    functionExists: functionVerification.exists,
    functionInfo: functionVerification.function,
    issues,
    metadata: {
      moduleAddress: abi.address,
      moduleName: abi.name,
      totalFunctions: abi.exposed_functions.length,
      entryFunctions,
      hasResourceAbilities,
      friendModules: abi.friends,
    },
    rawAbi: abi,
    // Include semantic analysis results for deeper vulnerability detection
    semanticAnalysis: {
      vulnerabilities: semanticResult.vulnerabilities,
      moduleMetrics: semanticResult.moduleMetrics,
    },
    // Include function ABI info for signature analysis
    functionAbiInfo: functionAbiInfo || undefined,
  };
}

/**
 * Lightweight check - just verify module and function exist
 * Use this when you don't need full analysis
 */
export async function quickVerifyModule(
  network: Network,
  moduleAddress: string,
  moduleName: string,
  functionName: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const module = await fetchModuleABI(network, moduleAddress, moduleName);

    if (!module) {
      return { valid: false, error: 'Module not found on-chain' };
    }

    const func = module.abi.exposed_functions.find(f => f.name === functionName);
    if (!func) {
      return {
        valid: false,
        error: `Function "${functionName}" not found in module`
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
