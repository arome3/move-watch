/**
 * Signature & Approval Analyzer
 *
 * Detects dangerous signature patterns that lead to wallet drains:
 * - Permit/Permit2 signatures (56.7% of 2024 thefts)
 * - setOwner calls (31.9% of 2024 thefts)
 * - Unlimited approvals
 * - setApprovalForAll for NFT collections
 *
 * This module analyzes WHAT the transaction will DO, not just
 * what the function is NAMED.
 */

import type { RiskSeverity, StateChange, SimulationEvent } from '@movewatch/shared';
import type { DetectedIssue } from './types.js';
import { CONFIDENCE_LEVELS } from './utils.js';
import {
  THREAT_SIGNATURES,
  ATTACK_PATTERNS,
  type ThreatSignature,
  type AttackPattern,
} from './threatIntelligence.js';

// ============================================================================
// ANALYSIS RESULT TYPES
// ============================================================================

export interface SignatureAnalysisResult {
  issues: DetectedIssue[];
  approvalAnalysis: {
    hasApproval: boolean;
    isUnlimited: boolean;
    approvedAddress?: string;
    approvedAmount?: string;
    tokenType?: string;
  };
  ownershipAnalysis: {
    hasOwnershipChange: boolean;
    currentOwner?: string;
    newOwner?: string;
  };
  permissionAnalysis: {
    grantsPermissions: boolean;
    permissionTypes: string[];
    riskLevel: RiskSeverity;
  };
  matchedSignatures: ThreatSignature[];
  matchedAttackPatterns: AttackPattern[];
}

// ============================================================================
// VALUE CONSTANTS FOR DETECTION
// ============================================================================

// Maximum values that indicate unlimited approval
const MAX_VALUES = {
  u64: '18446744073709551615',
  u128: '340282366920938463463374607431768211455',
  u256: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
  // Hex variants
  u64Hex: /^0x[fF]{16}$/,
  u128Hex: /^0x[fF]{32}$/,
  u256Hex: /^0x[fF]{64}$/,
};

// High value thresholds (in base units)
const HIGH_VALUE_THRESHOLDS = {
  // 1 billion units (typical for 8 decimal tokens)
  standard: BigInt('100000000000000000'),
  // 10 APT equivalent
  apt: BigInt('1000000000'),
};

// ============================================================================
// APPROVAL DETECTION
// ============================================================================

/**
 * Analyze if transaction involves token approval
 */
function analyzeApproval(
  functionName: string,
  args: unknown[],
  typeArgs: string[]
): SignatureAnalysisResult['approvalAnalysis'] {
  const result: SignatureAnalysisResult['approvalAnalysis'] = {
    hasApproval: false,
    isUnlimited: false,
  };

  // Check if function is an approval function
  const approvalPatterns = [
    /approve/i,
    /set_allowance/i,
    /increase_allowance/i,
    /permit/i,
    /set_approval_for_all/i,
    /setApprovalForAll/i,
  ];

  const isApprovalFunction = approvalPatterns.some((p) => p.test(functionName));
  if (!isApprovalFunction) {
    return result;
  }

  result.hasApproval = true;

  // Extract approval details from arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const argStr = String(arg);

    // Check for unlimited approval amount
    if (
      argStr === MAX_VALUES.u64 ||
      argStr === MAX_VALUES.u128 ||
      argStr === MAX_VALUES.u256 ||
      MAX_VALUES.u64Hex.test(argStr) ||
      MAX_VALUES.u128Hex.test(argStr) ||
      MAX_VALUES.u256Hex.test(argStr)
    ) {
      result.isUnlimited = true;
      result.approvedAmount = 'UNLIMITED (MAX_UINT)';
    }

    // Check for address arguments (spender)
    if (typeof arg === 'string' && /^0x[a-fA-F0-9]{1,64}$/.test(arg)) {
      if (!result.approvedAddress) {
        result.approvedAddress = arg;
      }
    }

    // Check for large numeric values
    try {
      const numValue = BigInt(argStr);
      if (numValue > HIGH_VALUE_THRESHOLDS.standard) {
        result.approvedAmount = argStr;
      }
    } catch {
      // Not a number, continue
    }
  }

  // Get token type from type arguments
  if (typeArgs.length > 0) {
    result.tokenType = typeArgs[0];
  }

  return result;
}

/**
 * Analyze ownership changes
 */
function analyzeOwnership(
  functionName: string,
  args: unknown[],
  stateChanges?: StateChange[]
): SignatureAnalysisResult['ownershipAnalysis'] {
  const result: SignatureAnalysisResult['ownershipAnalysis'] = {
    hasOwnershipChange: false,
  };

  // Check function name patterns
  const ownershipPatterns = [
    /set_owner/i,
    /transfer_owner/i,
    /change_owner/i,
    /change_admin/i,
    /set_admin/i,
    /transfer_admin/i,
    /renounce_owner/i,
    /accept_owner/i,
    /nominate_owner/i,
  ];

  const isOwnershipFunction = ownershipPatterns.some((p) => p.test(functionName));
  if (!isOwnershipFunction) {
    return result;
  }

  result.hasOwnershipChange = true;

  // Extract new owner from arguments
  for (const arg of args) {
    if (typeof arg === 'string' && /^0x[a-fA-F0-9]{1,64}$/.test(arg)) {
      result.newOwner = arg;
      break;
    }
  }

  // Check state changes for ownership modifications
  if (stateChanges) {
    for (const change of stateChanges) {
      if (
        change.resource.toLowerCase().includes('owner') ||
        change.resource.toLowerCase().includes('admin')
      ) {
        if (change.before && typeof change.before === 'object') {
          const before = change.before as Record<string, unknown>;
          if (before.owner) result.currentOwner = String(before.owner);
          if (before.admin) result.currentOwner = String(before.admin);
        }
        if (change.after && typeof change.after === 'object') {
          const after = change.after as Record<string, unknown>;
          if (after.owner) result.newOwner = String(after.owner);
          if (after.admin) result.newOwner = String(after.admin);
        }
      }
    }
  }

  return result;
}

/**
 * Analyze permissions being granted
 */
function analyzePermissions(
  functionName: string,
  args: unknown[],
  typeArgs: string[]
): SignatureAnalysisResult['permissionAnalysis'] {
  const result: SignatureAnalysisResult['permissionAnalysis'] = {
    grantsPermissions: false,
    permissionTypes: [],
    riskLevel: 'LOW',
  };

  // Permission patterns and their risk levels
  const permissionPatterns: { pattern: RegExp; permission: string; risk: RiskSeverity }[] = [
    { pattern: /set_approval_for_all/i, permission: 'COLLECTION_APPROVAL', risk: 'CRITICAL' },
    { pattern: /approve.*unlimited/i, permission: 'UNLIMITED_APPROVAL', risk: 'CRITICAL' },
    { pattern: /permit2/i, permission: 'PERMIT2_UNIVERSAL', risk: 'CRITICAL' },
    { pattern: /delegate/i, permission: 'DELEGATION', risk: 'HIGH' },
    { pattern: /grant.*role/i, permission: 'ROLE_GRANT', risk: 'HIGH' },
    { pattern: /set.*operator/i, permission: 'OPERATOR_SET', risk: 'HIGH' },
    { pattern: /approve/i, permission: 'TOKEN_APPROVAL', risk: 'MEDIUM' },
    { pattern: /allow/i, permission: 'ALLOWANCE', risk: 'MEDIUM' },
  ];

  for (const { pattern, permission, risk } of permissionPatterns) {
    if (pattern.test(functionName)) {
      result.grantsPermissions = true;
      result.permissionTypes.push(permission);
      // Use highest risk level
      if (
        risk === 'CRITICAL' ||
        (risk === 'HIGH' && result.riskLevel !== 'CRITICAL') ||
        (risk === 'MEDIUM' && result.riskLevel === 'LOW')
      ) {
        result.riskLevel = risk;
      }
    }
  }

  return result;
}

// ============================================================================
// THREAT SIGNATURE MATCHING
// ============================================================================

/**
 * Match transaction against threat signatures
 */
function matchThreatSignatures(data: {
  functionName: string;
  moduleAddress: string;
  moduleName: string;
  typeArgs: string[];
  args: unknown[];
  events?: SimulationEvent[];
  stateChanges?: StateChange[];
  abiInfo?: {
    abilities?: string[];
    isEntry?: boolean;
    isView?: boolean;
    paramCount?: number;
    genericCount?: number;
    hasPublicMutRef?: boolean;
  };
}): { matched: ThreatSignature[]; issues: DetectedIssue[] } {
  const matched: ThreatSignature[] = [];
  const issues: DetectedIssue[] = [];

  for (const sig of THREAT_SIGNATURES) {
    let isMatch = false;
    const matchReasons: string[] = [];

    // Check function patterns
    if (sig.detection.functionPatterns) {
      for (const pattern of sig.detection.functionPatterns) {
        if (pattern.test(data.functionName)) {
          isMatch = true;
          matchReasons.push(`Function matches pattern: ${pattern.source}`);
          break;
        }
      }
    }

    // Check module patterns
    if (sig.detection.modulePatterns) {
      const fullModule = `${data.moduleAddress}::${data.moduleName}`;
      for (const pattern of sig.detection.modulePatterns) {
        if (pattern.test(fullModule) || pattern.test(data.moduleName)) {
          isMatch = true;
          matchReasons.push(`Module matches pattern: ${pattern.source}`);
          break;
        }
      }
    }

    // Check type argument patterns
    if (sig.detection.typeArgPatterns && data.typeArgs.length > 0) {
      for (const pattern of sig.detection.typeArgPatterns) {
        for (const typeArg of data.typeArgs) {
          if (pattern.test(typeArg)) {
            isMatch = true;
            matchReasons.push(`Type argument matches: ${typeArg}`);
            break;
          }
        }
      }
    }

    // Check argument patterns
    if (sig.detection.argPatterns && data.args.length > 0) {
      for (const pattern of sig.detection.argPatterns) {
        for (const arg of data.args) {
          const argStr = String(arg);
          if (pattern.test(argStr)) {
            isMatch = true;
            matchReasons.push(`Argument matches pattern: ${argStr.substring(0, 20)}...`);
            break;
          }
        }
      }
    }

    // Check event patterns
    if (sig.detection.eventPatterns && data.events) {
      for (const pattern of sig.detection.eventPatterns) {
        for (const event of data.events) {
          if (pattern.test(event.type)) {
            isMatch = true;
            matchReasons.push(`Event matches: ${event.type}`);
            break;
          }
        }
      }
    }

    // Check ABI features
    if (sig.detection.abiChecks && data.abiInfo) {
      const abi = data.abiInfo;
      const checks = sig.detection.abiChecks;

      // Check required abilities
      if (checks.hasAbility && abi.abilities) {
        const hasAll = checks.hasAbility.every((a) => abi.abilities!.includes(a));
        if (hasAll) {
          isMatch = true;
          matchReasons.push(`Has abilities: ${checks.hasAbility.join(', ')}`);
        }
      }

      // Check prohibited abilities
      if (checks.lacksAbility && abi.abilities) {
        const lacksAll = checks.lacksAbility.every((a) => !abi.abilities!.includes(a));
        if (lacksAll && checks.hasAbility) {
          // Only match if also has required abilities
          isMatch = true;
          matchReasons.push(`Lacks abilities: ${checks.lacksAbility.join(', ')}`);
        }
      }

      // Check entry function
      if (checks.isEntry !== undefined && abi.isEntry === checks.isEntry) {
        // Entry check alone doesn't trigger match, but strengthens confidence
        if (isMatch) {
          matchReasons.push(`isEntry: ${abi.isEntry}`);
        }
      }

      // Check param count
      if (checks.paramCount && abi.paramCount !== undefined) {
        const { min, max } = checks.paramCount;
        if (
          (min === undefined || abi.paramCount >= min) &&
          (max === undefined || abi.paramCount <= max)
        ) {
          if (isMatch) {
            matchReasons.push(`Param count: ${abi.paramCount}`);
          }
        }
      }

      // Check generic count
      if (checks.genericCount && abi.genericCount !== undefined) {
        const { min, max } = checks.genericCount;
        if (
          (min === undefined || abi.genericCount >= min) &&
          (max === undefined || abi.genericCount <= max)
        ) {
          if (isMatch) {
            matchReasons.push(`Generic count: ${abi.genericCount}`);
          }
        }
      }

      // Check public mutable reference
      if (checks.hasPublicMutRef && abi.hasPublicMutRef) {
        isMatch = true;
        matchReasons.push('Exposes public mutable reference');
      }
    }

    // If matched, add to results
    if (isMatch) {
      matched.push(sig);

      // Create issue
      issues.push({
        patternId: `threat:${sig.id}`,
        category: sig.category,
        severity: sig.severity,
        title: sig.name,
        description: sig.description,
        recommendation: getRecommendation(sig),
        confidence: sig.confidence,
        source: 'pattern' as const,
        evidence: {
          signatureId: sig.id,
          matchReasons,
          attackVector: sig.attackVector,
          realWorldExamples: sig.realWorldExamples,
          tags: sig.tags,
          falsePositiveRisk: sig.falsePositiveRisk,
        },
      });
    }
  }

  return { matched, issues };
}

/**
 * Get recommendation based on threat signature
 */
function getRecommendation(sig: ThreatSignature): string {
  switch (sig.category) {
    case 'EXPLOIT':
      return `This pattern matches known exploit techniques. ${sig.falsePositiveRisk === 'high' ? 'This could be a false positive - verify the contract source.' : 'Proceed with extreme caution.'} ${sig.references?.length ? `Reference: ${sig.references[0]}` : ''}`;

    case 'RUG_PULL':
      return `This pattern is associated with scams and rug pulls. DO NOT proceed unless you fully trust the contract and have verified its source code.`;

    case 'PERMISSION':
      return `This transaction grants significant permissions. Ensure you trust the recipient and understand exactly what access you are granting.`;

    case 'EXCESSIVE_COST':
      return `This transaction may have unusually high costs or gas consumption. Review the expected costs before proceeding.`;

    default:
      return `Review this transaction carefully before signing. ${sig.attackVector}`;
  }
}

// ============================================================================
// ATTACK PATTERN MATCHING
// ============================================================================

/**
 * Match transaction against multi-stage attack patterns
 */
function matchAttackPatterns(data: {
  functionName: string;
  events?: SimulationEvent[];
  stateChanges?: StateChange[];
}): { matched: AttackPattern[]; issues: DetectedIssue[] } {
  const matched: AttackPattern[] = [];
  const issues: DetectedIssue[] = [];

  for (const pattern of ATTACK_PATTERNS) {
    let stagesMatched = 0;
    const matchedStages: string[] = [];

    for (const stage of pattern.stages) {
      let stageMatched = false;

      // Check function pattern
      if (stage.detection.functionPattern) {
        if (stage.detection.functionPattern.test(data.functionName)) {
          stageMatched = true;
        }
      }

      // Check event pattern
      if (stage.detection.eventPattern && data.events) {
        for (const event of data.events) {
          if (stage.detection.eventPattern.test(event.type)) {
            stageMatched = true;
            break;
          }
        }
      }

      // Check state pattern
      if (stage.detection.statePattern && data.stateChanges) {
        for (const change of data.stateChanges) {
          if (stage.detection.statePattern.test(change.resource)) {
            stageMatched = true;
            break;
          }
        }
      }

      if (stageMatched) {
        stagesMatched++;
        matchedStages.push(stage.name);
      } else if (stage.required) {
        // Required stage not matched, pattern doesn't match
        break;
      }
    }

    // Check if enough stages matched
    if (stagesMatched >= pattern.minStagesRequired) {
      matched.push(pattern);

      issues.push({
        patternId: `attack:${pattern.id}`,
        category: pattern.category,
        severity: pattern.severity,
        title: `Multi-Stage Attack Pattern: ${pattern.name}`,
        description: `${pattern.description} Matched stages: ${matchedStages.join(' → ')}`,
        recommendation: `This transaction matches a known multi-stage attack pattern. Historical losses: ${pattern.historicalLoss || 'Significant'}. ${pattern.affectedProtocols?.length ? `Previously affected: ${pattern.affectedProtocols.join(', ')}` : ''}`,
        confidence: Math.min(0.7 + stagesMatched * 0.1, 0.95),
        source: 'pattern' as const,
        evidence: {
          patternId: pattern.id,
          matchedStages,
          totalStages: pattern.stages.length,
          characteristics: pattern.characteristics,
          references: pattern.references,
          tags: pattern.tags,
        },
      });
    }
  }

  return { matched, issues };
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Comprehensive signature and approval analysis
 */
export function analyzeSignatures(data: {
  functionName: string;
  moduleAddress: string;
  moduleName: string;
  typeArgs: string[];
  args: unknown[];
  sender?: string;
  events?: SimulationEvent[];
  stateChanges?: StateChange[];
  abiInfo?: {
    abilities?: string[];
    isEntry?: boolean;
    isView?: boolean;
    paramCount?: number;
    genericCount?: number;
    hasPublicMutRef?: boolean;
  };
}): SignatureAnalysisResult {
  const issues: DetectedIssue[] = [];

  // 1. Analyze approvals
  const approvalAnalysis = analyzeApproval(data.functionName, data.args, data.typeArgs);

  // 2. Analyze ownership changes
  const ownershipAnalysis = analyzeOwnership(data.functionName, data.args, data.stateChanges);

  // 3. Analyze permissions
  const permissionAnalysis = analyzePermissions(data.functionName, data.args, data.typeArgs);

  // 4. Match threat signatures
  const { matched: matchedSignatures, issues: signatureIssues } = matchThreatSignatures(data);
  issues.push(...signatureIssues);

  // 5. Match attack patterns
  const { matched: matchedAttackPatterns, issues: attackIssues } = matchAttackPatterns({
    functionName: data.functionName,
    events: data.events,
    stateChanges: data.stateChanges,
  });
  issues.push(...attackIssues);

  // 6. Generate approval-specific issues
  if (approvalAnalysis.hasApproval) {
    if (approvalAnalysis.isUnlimited) {
      issues.push({
        patternId: 'sig:unlimited_approval',
        category: 'EXPLOIT',
        severity: 'CRITICAL',
        title: 'Unlimited Token Approval Detected',
        description: `This transaction grants UNLIMITED approval${approvalAnalysis.approvedAddress ? ` to ${approvalAnalysis.approvedAddress}` : ''}${approvalAnalysis.tokenType ? ` for ${approvalAnalysis.tokenType}` : ''}. Once approved, this address can drain ALL tokens of this type from your wallet at any time, even years later.`,
        recommendation: 'NEVER approve unlimited amounts unless absolutely necessary. Use exact amounts needed for the transaction. You can revoke approvals at revoke.cash or similar services.',
        confidence: CONFIDENCE_LEVELS.VERY_HIGH,
        source: 'pattern' as const,
        evidence: {
          ...approvalAnalysis,
          statistic: '56.7% of 2024 wallet drainer thefts used approval/permit signatures',
        },
      });
    } else if (approvalAnalysis.approvedAmount) {
      issues.push({
        patternId: 'sig:large_approval',
        category: 'PERMISSION',
        severity: 'HIGH',
        title: 'Large Token Approval',
        description: `This transaction approves ${approvalAnalysis.approvedAmount} tokens${approvalAnalysis.approvedAddress ? ` to ${approvalAnalysis.approvedAddress}` : ''}. Verify this is the intended amount.`,
        recommendation: 'Only approve the exact amount needed. Revoke approvals after the transaction if not needed.',
        confidence: CONFIDENCE_LEVELS.HIGH,
        source: 'pattern' as const,
        evidence: approvalAnalysis,
      });
    }
  }

  // 7. Generate ownership-specific issues
  if (ownershipAnalysis.hasOwnershipChange) {
    issues.push({
      patternId: 'sig:ownership_change',
      category: 'RUG_PULL',
      severity: 'CRITICAL',
      title: 'Ownership Transfer Detected',
      description: `This transaction changes contract ownership${ownershipAnalysis.newOwner ? ` to ${ownershipAnalysis.newOwner}` : ''}. ${ownershipAnalysis.currentOwner ? `Current owner: ${ownershipAnalysis.currentOwner}` : ''} 31.9% of 2024 thefts used setOwner calls.`,
      recommendation: 'Verify you intend to transfer ownership. This action may be irreversible and gives the new owner full control.',
      confidence: CONFIDENCE_LEVELS.VERY_HIGH,
      source: 'pattern' as const,
      evidence: {
        ...ownershipAnalysis,
        statistic: '31.9% of 2024 wallet drainer thefts used setOwner calls',
      },
    });
  }

  // 8. Generate permission-specific issues
  if (permissionAnalysis.grantsPermissions && permissionAnalysis.riskLevel !== 'LOW') {
    issues.push({
      patternId: 'sig:permission_grant',
      category: 'PERMISSION',
      severity: permissionAnalysis.riskLevel,
      title: `Permission Grant: ${permissionAnalysis.permissionTypes.join(', ')}`,
      description: `This transaction grants the following permissions: ${permissionAnalysis.permissionTypes.join(', ')}. These permissions allow the recipient to perform privileged actions on your behalf.`,
      recommendation: 'Only grant permissions to contracts and addresses you fully trust. Review what each permission allows.',
      confidence: CONFIDENCE_LEVELS.HIGH,
      source: 'pattern' as const,
      evidence: permissionAnalysis,
    });
  }

  return {
    issues,
    approvalAnalysis,
    ownershipAnalysis,
    permissionAnalysis,
    matchedSignatures,
    matchedAttackPatterns,
  };
}

/**
 * Quick check if function is high-risk (for UI warnings)
 */
export function isHighRiskFunction(functionName: string): {
  isHighRisk: boolean;
  riskType?: string;
  severity?: RiskSeverity;
} {
  // Critical patterns that should always warn
  const criticalPatterns: { pattern: RegExp; type: string }[] = [
    { pattern: /approve|permit/i, type: 'APPROVAL' },
    { pattern: /set_approval_for_all/i, type: 'COLLECTION_APPROVAL' },
    { pattern: /set_owner|transfer_owner|change_admin/i, type: 'OWNERSHIP' },
    { pattern: /upgrade|migrate/i, type: 'UPGRADE' },
    { pattern: /emergency_withdraw|admin_withdraw/i, type: 'EMERGENCY' },
    { pattern: /claim.*airdrop|free.*mint/i, type: 'PHISHING_RISK' },
  ];

  for (const { pattern, type } of criticalPatterns) {
    if (pattern.test(functionName)) {
      return {
        isHighRisk: true,
        riskType: type,
        severity: type === 'PHISHING_RISK' ? 'CRITICAL' : 'HIGH',
      };
    }
  }

  return { isHighRisk: false };
}

/**
 * Get approval statistics for educational display
 */
export function getApprovalStatistics() {
  return {
    permitThefts2024: '56.7%',
    setOwnerThefts2024: '31.9%',
    totalStolen2024: '$494 million',
    victimCount2024: '332,000 addresses',
    avgTheftSize: '$1,488',
    largestTheft2024: '$55.48 million',
    commonAttackVectors: [
      'Permit signature phishing',
      'setApprovalForAll on NFT collections',
      'Unlimited token approvals',
      'Fake airdrop claims',
    ],
    protectionTips: [
      'Never approve unlimited amounts',
      'Verify contract addresses on official sources',
      'Use revoke.cash to manage approvals',
      'Be suspicious of unsolicited claims/airdrops',
    ],
  };
}
