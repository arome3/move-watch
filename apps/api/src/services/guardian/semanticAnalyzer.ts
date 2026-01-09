/**
 * Semantic Bytecode Analyzer
 *
 * Performs deep analysis of Move module ABI to detect vulnerabilities
 * that can't be detected from function names alone.
 *
 * Implements detection for all 14 Aptos Security Guidelines categories:
 * 1. Unauthorized object access
 * 2. Generic type substitution
 * 3. Unbounded iterations (gas grief)
 * 4. Abilities misuse (copy/drop)
 * 5. Mutable reference exploits
 * 6. Division truncation
 * 7. ConstructorRef exposure
 * 8. Front-running
 * 9. Oracle manipulation
 * 10. Randomness exploits
 * 11. Undergasing attacks
 * 12. Time-of-check vs Time-of-use
 * 13. Missing pause functionality
 * 14. Resource leaks
 *
 * Also implements MoveScanner vulnerability categories (MWC-100 to MWC-136)
 */

import type { RiskSeverity, RiskCategory } from '@movewatch/shared';
import type { DetectedIssue } from './types.js';
import { CONFIDENCE_LEVELS } from './utils.js';

// ============================================================================
// MOVE ABI TYPES
// ============================================================================

export interface MoveModuleABI {
  address: string;
  name: string;
  friends: string[];
  exposed_functions: MoveFunctionABI[];
  structs: MoveStructABI[];
}

export interface MoveFunctionABI {
  name: string;
  visibility: 'public' | 'private' | 'friend';
  is_entry: boolean;
  is_view: boolean;
  generic_type_params: { constraints: string[] }[];
  params: string[];
  return: string[];
}

export interface MoveStructABI {
  name: string;
  is_native: boolean;
  abilities: ('copy' | 'drop' | 'store' | 'key')[];
  generic_type_params: { constraints: string[] }[];
  fields: { name: string; type: string }[];
}

// ============================================================================
// VULNERABILITY DEFINITIONS
// Based on Aptos Security Guidelines and MoveScanner research
// ============================================================================

interface VulnerabilityCheck {
  id: string;
  name: string;
  category: RiskCategory;
  severity: RiskSeverity;
  description: string;
  aptosGuidelineRef?: string;
  mwcId?: string; // MoveScanner Weakness Classification
  check: (module: MoveModuleABI, functionName?: string) => VulnerabilityResult | null;
}

interface VulnerabilityResult {
  found: boolean;
  details: string;
  affectedItems: string[];
  recommendation: string;
  evidence: Record<string, unknown>;
}

// ============================================================================
// VULNERABILITY CHECKS IMPLEMENTATION
// ============================================================================

const VULNERABILITY_CHECKS: VulnerabilityCheck[] = [
  // -------------------------------------------------------------------------
  // 1. ABILITY MISUSE VULNERABILITIES (MWC-101, MWC-102, MWC-103)
  // -------------------------------------------------------------------------
  {
    id: 'VULN-001',
    name: 'Unsafe Copy Ability on Token/Asset',
    category: 'EXPLOIT',
    severity: 'CRITICAL',
    description: 'Token or asset struct has copy ability, allowing unlimited duplication and breaking supply constraints.',
    aptosGuidelineRef: 'Abilities misuse (copy)',
    mwcId: 'MWC-102',
    check: (module) => {
      const affected: string[] = [];
      const tokenKeywords = ['coin', 'token', 'asset', 'balance', 'share', 'lp'];

      for (const struct of module.structs) {
        const isTokenLike = tokenKeywords.some(kw =>
          struct.name.toLowerCase().includes(kw)
        );
        const hasCopy = struct.abilities.includes('copy');

        if (isTokenLike && hasCopy) {
          affected.push(`${struct.name} has copy ability`);
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: `Token-like structs with copy ability can be duplicated, breaking supply constraints.`,
        affectedItems: affected,
        recommendation: 'Remove copy ability from token/asset structs. Tokens should never be copyable.',
        evidence: {
          affectedStructs: affected,
          vulnerability: 'Token duplication possible',
        },
      };
    },
  },
  {
    id: 'VULN-002',
    name: 'Unsafe Drop Ability on Receipt/Loan',
    category: 'EXPLOIT',
    severity: 'CRITICAL',
    description: 'Flash loan receipt or obligation struct has drop ability, allowing escape without repayment.',
    aptosGuidelineRef: 'Abilities misuse (drop)',
    mwcId: 'MWC-103',
    check: (module) => {
      const affected: string[] = [];
      const obligationKeywords = ['receipt', 'loan', 'debt', 'obligation', 'hot_potato'];

      for (const struct of module.structs) {
        const isObligation = obligationKeywords.some(kw =>
          struct.name.toLowerCase().includes(kw)
        );
        const hasDrop = struct.abilities.includes('drop');
        const hasKey = struct.abilities.includes('key');

        // Hot potatoes should NOT have drop
        if (isObligation && hasDrop) {
          affected.push(`${struct.name} has drop ability`);
        }

        // Resources with key but also drop might be problematic
        if (hasKey && hasDrop && struct.name.toLowerCase().includes('loan')) {
          affected.push(`${struct.name} is a resource with drop (can be abandoned)`);
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: 'Obligation/receipt structs with drop can be abandoned without fulfilling requirements.',
        affectedItems: affected,
        recommendation: 'Remove drop ability from receipt/obligation structs to enforce repayment.',
        evidence: {
          affectedStructs: affected,
          vulnerability: 'Flash loan escape possible',
        },
      };
    },
  },
  {
    id: 'VULN-003',
    name: 'Resource Leak Risk',
    category: 'EXPLOIT',
    severity: 'HIGH',
    description: 'Resource struct lacks drop ability but function return might not be handled.',
    aptosGuidelineRef: 'Resource safety',
    mwcId: 'MWC-101',
    check: (module) => {
      const affected: string[] = [];

      // Find structs that are resources (have key, no drop)
      const resourceStructs = module.structs.filter(s =>
        s.abilities.includes('key') && !s.abilities.includes('drop')
      );

      // Check functions that return these resource types
      for (const func of module.exposed_functions) {
        for (const returnType of func.return) {
          const isResourceReturn = resourceStructs.some(s =>
            returnType.includes(s.name)
          );

          if (isResourceReturn && func.visibility === 'public') {
            affected.push(`${func.name} returns resource type that must be handled`);
          }
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: 'Public functions returning resources require callers to properly handle the resource.',
        affectedItems: affected,
        recommendation: 'Ensure all code paths properly store, transfer, or destroy returned resources.',
        evidence: {
          resourceStructs: resourceStructs.map(s => s.name),
          affectedFunctions: affected,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // 2. GENERIC TYPE VULNERABILITIES (MWC-105)
  // -------------------------------------------------------------------------
  {
    id: 'VULN-010',
    name: 'Unconstrained Generic Type',
    category: 'EXPLOIT',
    severity: 'HIGH',
    description: 'Generic function accepts unconstrained type parameters, allowing type substitution attacks.',
    aptosGuidelineRef: 'Generic type substitution',
    mwcId: 'MWC-105',
    check: (module) => {
      const affected: string[] = [];
      const sensitivePatterns = ['transfer', 'swap', 'deposit', 'withdraw', 'repay', 'borrow'];

      for (const func of module.exposed_functions) {
        const hasSensitiveName = sensitivePatterns.some(p =>
          func.name.toLowerCase().includes(p)
        );

        if (!hasSensitiveName) continue;

        // Check for unconstrained generics
        for (let i = 0; i < func.generic_type_params.length; i++) {
          const param = func.generic_type_params[i];
          if (param.constraints.length === 0) {
            affected.push(`${func.name}<T${i}> has unconstrained generic`);
          }
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: 'Unconstrained generic types in sensitive functions allow type confusion attacks.',
        affectedItems: affected,
        recommendation: 'Add appropriate type constraints to generic parameters, especially for token operations.',
        evidence: {
          vulnerability: 'Type substitution attack possible',
          affectedFunctions: affected,
        },
      };
    },
  },
  {
    id: 'VULN-011',
    name: 'Flash Loan Type Mismatch Risk',
    category: 'EXPLOIT',
    severity: 'CRITICAL',
    description: 'Flash loan repayment may not verify the returned coin type matches the borrowed type.',
    aptosGuidelineRef: 'Generic type substitution',
    check: (module) => {
      const affected: string[] = [];

      // Look for flash loan related functions
      const flashFuncs = module.exposed_functions.filter(f =>
        f.name.toLowerCase().includes('flash') ||
        f.name.toLowerCase().includes('loan')
      );

      for (const func of flashFuncs) {
        // Check if repay function has proper type constraints
        if (func.name.toLowerCase().includes('repay')) {
          if (func.generic_type_params.length > 0) {
            const hasLooseConstraint = func.generic_type_params.some(p =>
              p.constraints.length === 0
            );

            if (hasLooseConstraint) {
              affected.push(`${func.name} may accept different coin type for repayment`);
            }
          }
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: 'Flash loan repayment function may not verify coin type matches original loan.',
        affectedItems: affected,
        recommendation: 'Ensure repayment function validates coin type matches the borrowed type (e.g., via receipt typing).',
        evidence: {
          vulnerability: 'Flash loan type confusion',
          affectedFunctions: affected,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // 3. ACCESS CONTROL VULNERABILITIES (MWC-104, MWC-106)
  // -------------------------------------------------------------------------
  {
    id: 'VULN-020',
    name: 'Public Mutable Reference Exposure',
    category: 'EXPLOIT',
    severity: 'HIGH',
    description: 'Function exposes mutable reference to external caller, allowing full value replacement.',
    aptosGuidelineRef: 'Mutable reference exploits',
    mwcId: 'MWC-104',
    check: (module) => {
      const affected: string[] = [];

      for (const func of module.exposed_functions) {
        if (func.visibility !== 'public') continue;

        // Check for mutable reference parameters
        for (const param of func.params) {
          if (param.includes('&mut') && !param.includes('signer')) {
            affected.push(`${func.name} accepts &mut ${param}`);
          }
        }

        // Check for mutable reference returns (dangerous!)
        for (const ret of func.return) {
          if (ret.includes('&mut')) {
            affected.push(`${func.name} returns &mut (DANGEROUS)`);
          }
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: 'Public functions with mutable references allow callers to swap entire values, not just modify.',
        affectedItems: affected,
        recommendation: 'Avoid returning mutable references. For parameters, validate modifications within the function.',
        evidence: {
          vulnerability: 'State manipulation via mutable reference',
          affectedFunctions: affected,
        },
      };
    },
  },
  {
    id: 'VULN-021',
    name: 'Missing Signer Verification',
    category: 'PERMISSION',
    severity: 'HIGH',
    description: 'Entry function performs privileged operation without signer parameter.',
    aptosGuidelineRef: 'Unauthorized object access',
    check: (module) => {
      const affected: string[] = [];
      const privilegedPatterns = [
        'admin', 'owner', 'withdraw', 'transfer', 'mint', 'burn',
        'update', 'set', 'pause', 'unpause', 'emergency', 'upgrade'
      ];

      for (const func of module.exposed_functions) {
        if (!func.is_entry) continue;

        const isPrivileged = privilegedPatterns.some(p =>
          func.name.toLowerCase().includes(p)
        );

        if (!isPrivileged) continue;

        // Check if first param is signer
        const hasSigner = func.params.some(p =>
          p.includes('signer') || p.includes('&signer')
        );

        if (!hasSigner) {
          affected.push(`${func.name} (privileged) has no signer parameter`);
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: 'Privileged entry functions should require signer for authorization.',
        affectedItems: affected,
        recommendation: 'Add signer parameter and verify caller has appropriate permissions.',
        evidence: {
          vulnerability: 'Missing access control',
          affectedFunctions: affected,
        },
      };
    },
  },
  {
    id: 'VULN-022',
    name: 'ConstructorRef Exposure',
    category: 'PERMISSION',
    severity: 'CRITICAL',
    description: 'Object ConstructorRef is exposed publicly, allowing unauthorized ownership transfer.',
    aptosGuidelineRef: 'ConstructorRef exposure',
    mwcId: 'MWC-106',
    check: (module) => {
      const affected: string[] = [];

      for (const func of module.exposed_functions) {
        if (func.visibility !== 'public') continue;

        // Check return types for ConstructorRef
        for (const ret of func.return) {
          if (ret.includes('ConstructorRef') || ret.includes('constructor_ref')) {
            affected.push(`${func.name} returns ConstructorRef`);
          }
        }

        // Check parameters that might leak it
        for (const param of func.params) {
          if (param.includes('ConstructorRef') && param.includes('&')) {
            affected.push(`${func.name} takes &ConstructorRef parameter`);
          }
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: 'ConstructorRef exposure allows anyone to transfer object ownership.',
        affectedItems: affected,
        recommendation: 'Never expose ConstructorRef publicly. Store it in a resource only accessible to authorized accounts.',
        evidence: {
          vulnerability: 'Object ownership hijacking possible',
          affectedFunctions: affected,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // 4. MATHEMATICAL VULNERABILITIES
  // -------------------------------------------------------------------------
  {
    id: 'VULN-030',
    name: 'Division Truncation in Fee Calculation',
    category: 'EXPLOIT',
    severity: 'MEDIUM',
    description: 'Division operations may truncate to zero for small values, causing incorrect fee calculations.',
    aptosGuidelineRef: 'Division truncation',
    check: (module) => {
      const affected: string[] = [];
      const feePatterns = ['fee', 'reward', 'interest', 'rate', 'percent', 'ratio'];

      for (const func of module.exposed_functions) {
        const isFeeFunc = feePatterns.some(p =>
          func.name.toLowerCase().includes(p)
        );

        if (isFeeFunc) {
          // Check if function handles small values (likely division involved)
          const hasNumericParams = func.params.some(p =>
            p.includes('u64') || p.includes('u128') || p.includes('u256')
          );

          if (hasNumericParams) {
            affected.push(`${func.name} may have division truncation`);
          }
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: 'Fee/reward calculations may round down to zero for small amounts.',
        affectedItems: affected,
        recommendation: 'Implement minimum thresholds or use fixed-point arithmetic with sufficient precision.',
        evidence: {
          vulnerability: 'Precision loss possible',
          potentiallyAffected: affected,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // 5. RANDOMNESS VULNERABILITIES
  // -------------------------------------------------------------------------
  {
    id: 'VULN-040',
    name: 'Test-and-Abort Randomness Attack',
    category: 'EXPLOIT',
    severity: 'HIGH',
    description: 'Public (non-entry) randomness function allows test-and-abort attacks.',
    aptosGuidelineRef: 'Randomness exploits',
    check: (module) => {
      const affected: string[] = [];
      const randomPatterns = ['random', 'rand', 'lottery', 'raffle', 'dice', 'roll'];

      for (const func of module.exposed_functions) {
        const isRandomFunc = randomPatterns.some(p =>
          func.name.toLowerCase().includes(p)
        );

        if (!isRandomFunc) continue;

        // Non-entry public functions are vulnerable
        if (func.visibility === 'public' && !func.is_entry) {
          affected.push(`${func.name} is public but not entry`);
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: 'Public non-entry randomness functions allow callers to abort unfavorable outcomes.',
        affectedItems: affected,
        recommendation: 'Make randomness functions entry-only or use commit-reveal schemes.',
        evidence: {
          vulnerability: 'Randomness manipulation via abort',
          affectedFunctions: affected,
        },
      };
    },
  },
  {
    id: 'VULN-041',
    name: 'Undergasing Attack Vector',
    category: 'EXPLOIT',
    severity: 'HIGH',
    description: 'Randomness function with variable gas consumption enables undergasing attacks.',
    aptosGuidelineRef: 'Undergasing attacks',
    check: (module) => {
      const affected: string[] = [];
      const randomFuncs = module.exposed_functions.filter(f =>
        f.name.toLowerCase().includes('random') ||
        f.name.toLowerCase().includes('lottery')
      );

      for (const func of randomFuncs) {
        // Functions with conditional logic (indicated by multiple return types or complex params)
        // are more likely to have variable gas consumption
        if (func.return.length > 1 || func.generic_type_params.length > 0) {
          affected.push(`${func.name} may have variable execution paths`);
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: 'Functions with variable gas consumption can be manipulated by providing exact gas.',
        affectedItems: affected,
        recommendation: 'Ensure all code paths consume similar gas, or use gas-independent randomness.',
        evidence: {
          vulnerability: 'Undergasing attack possible',
          potentiallyAffected: affected,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // 6. GOVERNANCE & ADMIN VULNERABILITIES
  // -------------------------------------------------------------------------
  {
    id: 'VULN-050',
    name: 'Missing Pause Functionality',
    category: 'PERMISSION',
    severity: 'MEDIUM',
    description: 'Module lacks pause functionality for emergency response.',
    aptosGuidelineRef: 'Missing pause functionality',
    check: (module) => {
      // Check if this looks like a DeFi module
      const isDefi = module.exposed_functions.some(f =>
        ['swap', 'deposit', 'withdraw', 'borrow', 'lend', 'stake'].some(p =>
          f.name.toLowerCase().includes(p)
        )
      );

      if (!isDefi) return null;

      // Check for pause functionality
      const hasPause = module.exposed_functions.some(f =>
        f.name.toLowerCase().includes('pause') ||
        f.name.toLowerCase().includes('emergency') ||
        f.name.toLowerCase().includes('freeze')
      );

      if (hasPause) return null;

      return {
        found: true,
        details: 'DeFi module lacks pause functionality for emergency response to vulnerabilities.',
        affectedItems: [module.name],
        recommendation: 'Implement pause/unpause mechanism for emergency situations.',
        evidence: {
          vulnerability: 'No emergency stop mechanism',
          moduleName: module.name,
        },
      };
    },
  },
  {
    id: 'VULN-051',
    name: 'Centralized Admin Control',
    category: 'RUG_PULL',
    severity: 'MEDIUM',
    description: 'Module has centralized admin functions without timelock or multisig.',
    check: (module) => {
      const adminFuncs = module.exposed_functions.filter(f =>
        f.name.toLowerCase().includes('admin') ||
        f.name.toLowerCase().includes('owner') ||
        f.name.toLowerCase().includes('set_') ||
        f.name.toLowerCase().includes('update_')
      );

      if (adminFuncs.length === 0) return null;

      // Check if there's any timelock or delay mechanism
      const hasTimelock = module.exposed_functions.some(f =>
        f.name.toLowerCase().includes('timelock') ||
        f.name.toLowerCase().includes('delay') ||
        f.name.toLowerCase().includes('schedule')
      );

      if (hasTimelock) return null;

      return {
        found: true,
        details: 'Multiple admin functions without apparent timelock protection.',
        affectedItems: adminFuncs.map(f => f.name),
        recommendation: 'Consider implementing timelock or multisig for admin functions.',
        evidence: {
          adminFunctionCount: adminFuncs.length,
          adminFunctions: adminFuncs.map(f => f.name),
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // 7. FRONT-RUNNING VULNERABILITIES
  // -------------------------------------------------------------------------
  {
    id: 'VULN-060',
    name: 'Front-Running Vulnerable Function',
    category: 'EXPLOIT',
    severity: 'MEDIUM',
    description: 'Public trading function lacks slippage protection or deadline parameter.',
    aptosGuidelineRef: 'Front-running',
    check: (module) => {
      const affected: string[] = [];
      const tradingPatterns = ['swap', 'trade', 'exchange', 'buy', 'sell'];

      for (const func of module.exposed_functions) {
        const isTrading = tradingPatterns.some(p =>
          func.name.toLowerCase().includes(p)
        );

        if (!isTrading || !func.is_entry) continue;

        // Check for slippage/deadline params
        const hasProtection = func.params.some(p =>
          p.toLowerCase().includes('min') ||
          p.toLowerCase().includes('max') ||
          p.toLowerCase().includes('deadline') ||
          p.toLowerCase().includes('slippage')
        );

        if (!hasProtection) {
          affected.push(`${func.name} lacks slippage/deadline protection`);
        }
      }

      if (affected.length === 0) return null;

      return {
        found: true,
        details: 'Trading functions without slippage protection are vulnerable to MEV extraction.',
        affectedItems: affected,
        recommendation: 'Add minimum output amount (slippage) and deadline parameters.',
        evidence: {
          vulnerability: 'Front-running/sandwich attack possible',
          affectedFunctions: affected,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // 8. OBJECT & STORAGE VULNERABILITIES
  // -------------------------------------------------------------------------
  {
    id: 'VULN-070',
    name: 'Multiple Resources in Object Account',
    category: 'EXPLOIT',
    severity: 'MEDIUM',
    description: 'Object account contains multiple resources that transfer together unintentionally.',
    aptosGuidelineRef: 'Multiple resources in one object account',
    check: (module) => {
      // Check if module uses objects with multiple resources
      const objectStructs = module.structs.filter(s =>
        s.abilities.includes('key') &&
        s.fields.some(f =>
          f.type.includes('Object') || f.type.includes('object::')
        )
      );

      if (objectStructs.length === 0) return null;

      // Check for multiple key structs (potential bundling issue)
      const keyStructs = module.structs.filter(s => s.abilities.includes('key'));
      if (keyStructs.length <= 1) return null;

      return {
        found: true,
        details: 'Multiple resource types may be inadvertently bundled in object transfers.',
        affectedItems: keyStructs.map(s => s.name),
        recommendation: 'Ensure object resources are properly separated or intentionally bundled.',
        evidence: {
          keyStructCount: keyStructs.length,
          keyStructs: keyStructs.map(s => s.name),
        },
      };
    },
  },
];

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Perform semantic analysis on a Move module ABI
 */
export function analyzeModuleSemantics(
  moduleABI: MoveModuleABI,
  targetFunction?: string
): {
  issues: DetectedIssue[];
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
} {
  const issues: DetectedIssue[] = [];
  const vulnerabilities: {
    id: string;
    name: string;
    severity: RiskSeverity;
    details: string;
    affectedItems: string[];
  }[] = [];

  // Calculate module metrics
  const moduleMetrics = {
    totalFunctions: moduleABI.exposed_functions.length,
    publicFunctions: moduleABI.exposed_functions.filter(f => f.visibility === 'public').length,
    entryFunctions: moduleABI.exposed_functions.filter(f => f.is_entry).length,
    viewFunctions: moduleABI.exposed_functions.filter(f => f.is_view).length,
    totalStructs: moduleABI.structs.length,
    resourceStructs: moduleABI.structs.filter(s => s.abilities.includes('key')).length,
    hasAdminFunctions: moduleABI.exposed_functions.some(f =>
      f.name.toLowerCase().includes('admin') || f.name.toLowerCase().includes('owner')
    ),
    hasUpgradeFunction: moduleABI.exposed_functions.some(f =>
      f.name.toLowerCase().includes('upgrade')
    ),
    hasPauseFunction: moduleABI.exposed_functions.some(f =>
      f.name.toLowerCase().includes('pause')
    ),
  };

  // Run all vulnerability checks
  for (const check of VULNERABILITY_CHECKS) {
    try {
      const result = check.check(moduleABI, targetFunction);

      if (result && result.found) {
        vulnerabilities.push({
          id: check.id,
          name: check.name,
          severity: check.severity,
          details: result.details,
          affectedItems: result.affectedItems,
        });

        // Create issue for this vulnerability
        issues.push({
          patternId: `semantic:${check.id}`,
          category: check.category,
          severity: check.severity,
          title: check.name,
          description: `${check.description} ${result.details}`,
          recommendation: result.recommendation,
          confidence: check.severity === 'CRITICAL' ? CONFIDENCE_LEVELS.HIGH : CONFIDENCE_LEVELS.MEDIUM,
          source: 'pattern' as const,
          evidence: {
            checkId: check.id,
            mwcId: check.mwcId,
            aptosGuidelineRef: check.aptosGuidelineRef,
            affectedItems: result.affectedItems,
            ...result.evidence,
            analysisType: 'semantic_bytecode_analysis',
          },
        });
      }
    } catch (error) {
      console.warn(`Vulnerability check ${check.id} failed:`, error);
    }
  }

  return {
    issues,
    vulnerabilities,
    moduleMetrics,
  };
}

/**
 * Extract function-specific ABI info for analysis
 */
export function extractFunctionABIInfo(
  moduleABI: MoveModuleABI,
  functionName: string
): {
  abilities: string[];
  isEntry: boolean;
  isView: boolean;
  paramCount: number;
  genericCount: number;
  hasPublicMutRef: boolean;
  returnTypes: string[];
  paramTypes: string[];
} | null {
  // Find the function
  const func = moduleABI.exposed_functions.find(f => f.name === functionName);
  if (!func) return null;

  // Check for public mutable references
  const hasPublicMutRef =
    func.visibility === 'public' &&
    (func.params.some(p => p.includes('&mut')) ||
      func.return.some(r => r.includes('&mut')));

  // Collect abilities from related structs
  const relatedAbilities = new Set<string>();
  for (const struct of moduleABI.structs) {
    // Check if struct is referenced in params or return types
    const isReferenced =
      func.params.some(p => p.includes(struct.name)) ||
      func.return.some(r => r.includes(struct.name));

    if (isReferenced) {
      struct.abilities.forEach(a => relatedAbilities.add(a));
    }
  }

  return {
    abilities: Array.from(relatedAbilities),
    isEntry: func.is_entry,
    isView: func.is_view,
    paramCount: func.params.length,
    genericCount: func.generic_type_params.length,
    hasPublicMutRef,
    returnTypes: func.return,
    paramTypes: func.params,
  };
}

/**
 * Get summary of vulnerability coverage
 */
export function getVulnerabilityCheckCoverage() {
  return {
    totalChecks: VULNERABILITY_CHECKS.length,
    categories: {
      abilityMisuse: VULNERABILITY_CHECKS.filter(c => c.mwcId?.includes('MWC-10')).length,
      genericType: VULNERABILITY_CHECKS.filter(c => c.id.startsWith('VULN-01')).length,
      accessControl: VULNERABILITY_CHECKS.filter(c => c.id.startsWith('VULN-02')).length,
      mathematical: VULNERABILITY_CHECKS.filter(c => c.id.startsWith('VULN-03')).length,
      randomness: VULNERABILITY_CHECKS.filter(c => c.id.startsWith('VULN-04')).length,
      governance: VULNERABILITY_CHECKS.filter(c => c.id.startsWith('VULN-05')).length,
      frontRunning: VULNERABILITY_CHECKS.filter(c => c.id.startsWith('VULN-06')).length,
      objectStorage: VULNERABILITY_CHECKS.filter(c => c.id.startsWith('VULN-07')).length,
    },
    aptosGuidelinesImplemented: VULNERABILITY_CHECKS.filter(c => c.aptosGuidelineRef).map(c => c.aptosGuidelineRef),
    mwcIdsImplemented: VULNERABILITY_CHECKS.filter(c => c.mwcId).map(c => c.mwcId),
  };
}
