/**
 * Integer Overflow Detector
 *
 * Specifically designed to catch Cetus-type vulnerabilities ($223M hack, May 2025).
 *
 * The Cetus Protocol hack was caused by:
 * 1. Integer overflow in `checked_shlw` function of integer-mate library
 * 2. Attacker manipulated liquidity value to overflow during shift operation
 * 3. Result: Protocol thought attacker had massive liquidity entitlement
 *
 * This analyzer detects:
 * - Unchecked arithmetic operations
 * - Shift operations without bounds checking
 * - Downcasts that can truncate values
 * - Arithmetic in loops (multiplication of risk)
 * - Known vulnerable library patterns
 *
 * Reference: https://x.com/paboricke/status/1925620046653083814
 */

import type { Network, RiskSeverity, RiskCategory } from '@movewatch/shared';
import type { DetectedIssue } from './types.js';
import { CONFIDENCE_LEVELS } from './utils.js';
import {
  analyzeModuleBytecode,
  type ModuleAnalysis,
  type FunctionAnalysis,
  type OverflowRisk,
  MoveOpcode,
} from './moveBytecodeParser.js';

// Known vulnerable libraries and patterns
export interface VulnerableLibrary {
  name: string;
  address?: string;
  vulnerableFunctions: string[];
  vulnerability: string;
  severity: RiskSeverity;
  cve?: string;
  incident?: {
    name: string;
    date: string;
    lossAmount: string;
    description: string;
  };
}

// Arithmetic pattern that could overflow
export interface ArithmeticPattern {
  operation: string;
  operandTypes: string[];
  resultType: string;
  inLoop: boolean;
  hasCheck: boolean;
  riskScore: number;
}

// Integer overflow analysis result
export interface IntegerOverflowResult {
  hasOverflowRisk: boolean;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';

  // Detailed findings
  shiftOperations: ShiftOperationRisk[];
  arithmeticPatterns: ArithmeticPattern[];
  downcastOperations: DowncastRisk[];
  loopArithmetic: LoopArithmeticRisk[];
  vulnerableLibraryUsage: VulnerableLibraryUsage[];

  // Issues for integration
  issues: DetectedIssue[];

  // Summary
  summary: string;
}

// Shift operation risk (Cetus-type)
export interface ShiftOperationRisk {
  functionName: string;
  instructionOffset: number;
  direction: 'left' | 'right';
  hasAmountCheck: boolean;
  inLoop: boolean;
  riskLevel: 'critical' | 'high' | 'medium';
  description: string;
}

// Downcast risk
export interface DowncastRisk {
  functionName: string;
  fromType: string;
  toType: string;
  hasRangeCheck: boolean;
  riskLevel: 'critical' | 'high' | 'medium';
}

// Loop arithmetic risk
export interface LoopArithmeticRisk {
  functionName: string;
  operation: string;
  iterationCount: 'bounded' | 'unbounded' | 'user_controlled';
  riskLevel: 'critical' | 'high' | 'medium';
}

// Vulnerable library usage
export interface VulnerableLibraryUsage {
  libraryName: string;
  functionName: string;
  callerFunction: string;
  vulnerability: string;
  severity: RiskSeverity;
  incident?: string;
}

// Known vulnerable Move libraries
const VULNERABLE_LIBRARIES: VulnerableLibrary[] = [
  {
    name: 'integer-mate',
    vulnerableFunctions: ['checked_shlw', 'checked_shl', 'full_mul', 'mul_shr'],
    vulnerability: 'Unchecked shift operations can overflow with malicious input',
    severity: 'CRITICAL',
    incident: {
      name: 'Cetus Protocol Hack',
      date: '2025-05-22',
      lossAmount: '$223,000,000',
      description: 'Attacker exploited integer overflow in checked_shlw to claim massive liquidity',
    },
  },
  {
    name: 'u256',
    address: '0x1',
    vulnerableFunctions: ['mul', 'shl', 'pow'],
    vulnerability: 'Large number arithmetic without overflow protection',
    severity: 'HIGH',
  },
  {
    name: 'fixed_point32',
    address: '0x1',
    vulnerableFunctions: ['multiply_u64', 'divide_u64'],
    vulnerability: 'Fixed-point arithmetic can lose precision or overflow',
    severity: 'MEDIUM',
  },
  {
    name: 'fixed_point64',
    address: '0x1',
    vulnerableFunctions: ['multiply_u128', 'divide_u128'],
    vulnerability: 'Fixed-point arithmetic can lose precision or overflow',
    severity: 'MEDIUM',
  },
  {
    name: 'math64',
    vulnerableFunctions: ['pow', 'mul_div'],
    vulnerability: 'Exponentiation and combined operations can overflow',
    severity: 'HIGH',
  },
  {
    name: 'math128',
    vulnerableFunctions: ['pow', 'mul_div', 'sqrt'],
    vulnerability: 'Large number math without overflow protection',
    severity: 'HIGH',
  },
];

// Dangerous function name patterns
const DANGEROUS_ARITHMETIC_PATTERNS = [
  { pattern: /^(mul|multiply|mult)_/i, operation: 'multiplication', risk: 'high' },
  { pattern: /^(shl|shift_left|left_shift)/i, operation: 'left shift', risk: 'critical' },
  { pattern: /^(pow|power|exp)/i, operation: 'exponentiation', risk: 'critical' },
  { pattern: /^(full_mul|wide_mul)/i, operation: 'wide multiplication', risk: 'high' },
  { pattern: /_unchecked$/i, operation: 'unchecked operation', risk: 'critical' },
  { pattern: /^unsafe_/i, operation: 'unsafe operation', risk: 'high' },
];

// Safe patterns (functions with overflow protection)
const SAFE_PATTERNS = [
  /^checked_/i,      // Explicitly checked
  /^safe_/i,         // Safe variants
  /_overflow$/i,     // Overflow-aware
  /_saturating$/i,   // Saturating arithmetic
  /^try_/i,          // Try/option-returning variants
];

/**
 * Analyze shift operations for Cetus-type vulnerabilities
 */
function analyzeShiftOperations(
  func: FunctionAnalysis
): ShiftOperationRisk[] {
  const risks: ShiftOperationRisk[] = [];

  // Check from bytecode analysis
  for (const risk of func.overflowRisks) {
    if (risk.opcode === 'Shl' || risk.opcode === 'Shr') {
      risks.push({
        functionName: func.name,
        instructionOffset: risk.instructionOffset,
        direction: risk.opcode === 'Shl' ? 'left' : 'right',
        hasAmountCheck: risk.hasChecks,
        inLoop: risk.inLoop,
        riskLevel: risk.inLoop && !risk.hasChecks ? 'critical' :
                   !risk.hasChecks ? 'high' : 'medium',
        description: risk.inLoop ?
          `Shift operation in loop without bounds checking - HIGH RISK for Cetus-type overflow` :
          `Shift operation without visible bounds checking on shift amount`,
      });
    }
  }

  // Check function name patterns
  const nameMatchesShl = /shl|shift.*left|left.*shift/i.test(func.name);
  const nameMatchesShr = /shr|shift.*right|right.*shift/i.test(func.name);

  if ((nameMatchesShl || nameMatchesShr) && risks.length === 0) {
    risks.push({
      functionName: func.name,
      instructionOffset: 0,
      direction: nameMatchesShl ? 'left' : 'right',
      hasAmountCheck: false,
      inLoop: func.hasLoops,
      riskLevel: func.hasLoops ? 'critical' : 'high',
      description: `Function name suggests shift operation - verify bounds checking`,
    });
  }

  return risks;
}

/**
 * Analyze downcast operations
 */
function analyzeDowncasts(func: FunctionAnalysis): DowncastRisk[] {
  const risks: DowncastRisk[] = [];

  // Map of type sizes for downcast detection
  const typeSizes: Record<string, number> = {
    'u8': 8,
    'u16': 16,
    'u32': 32,
    'u64': 64,
    'u128': 128,
    'u256': 256,
  };

  for (const risk of func.overflowRisks) {
    if (risk.opcode.startsWith('CastU')) {
      const toType = `u${risk.opcode.slice(5).toLowerCase()}`;
      // Assume casting from larger type
      const possibleFromTypes = Object.keys(typeSizes)
        .filter(t => typeSizes[t] > (typeSizes[toType] || 0));

      if (possibleFromTypes.length > 0) {
        risks.push({
          functionName: func.name,
          fromType: 'u256 or larger', // Conservative assumption
          toType,
          hasRangeCheck: risk.hasChecks,
          riskLevel: !risk.hasChecks && toType === 'u8' ? 'critical' :
                     !risk.hasChecks ? 'high' : 'medium',
        });
      }
    }
  }

  return risks;
}

/**
 * Analyze arithmetic operations in loops
 */
function analyzeLoopArithmetic(func: FunctionAnalysis): LoopArithmeticRisk[] {
  const risks: LoopArithmeticRisk[] = [];

  if (!func.hasLoops) return risks;

  const arithmeticInLoop = func.overflowRisks.filter(r => r.inLoop);

  for (const arith of arithmeticInLoop) {
    risks.push({
      functionName: func.name,
      operation: arith.opcode,
      iterationCount: arith.userControlled ? 'user_controlled' : 'unbounded',
      riskLevel: arith.userControlled ? 'critical' :
                 arith.riskLevel === 'high' ? 'high' : 'medium',
    });
  }

  return risks;
}

/**
 * Check for usage of known vulnerable libraries
 */
function checkVulnerableLibraries(
  moduleAnalysis: ModuleAnalysis
): VulnerableLibraryUsage[] {
  const usages: VulnerableLibraryUsage[] = [];

  for (const lib of VULNERABLE_LIBRARIES) {
    // Check if any function calls vulnerable library functions
    for (const func of moduleAnalysis.functions) {
      // Check function name for patterns that suggest library usage
      for (const vulnFunc of lib.vulnerableFunctions) {
        if (func.name.includes(vulnFunc) || func.calledFunctions.includes(vulnFunc)) {
          usages.push({
            libraryName: lib.name,
            functionName: vulnFunc,
            callerFunction: func.name,
            vulnerability: lib.vulnerability,
            severity: lib.severity,
            incident: lib.incident?.name,
          });
        }
      }
    }
  }

  return usages;
}

/**
 * Calculate overall risk level from findings
 */
function calculateOverallRisk(
  shiftOps: ShiftOperationRisk[],
  downcasts: DowncastRisk[],
  loopArith: LoopArithmeticRisk[],
  vulnLibs: VulnerableLibraryUsage[]
): IntegerOverflowResult['riskLevel'] {
  // Critical if any critical finding
  if (shiftOps.some(s => s.riskLevel === 'critical') ||
      downcasts.some(d => d.riskLevel === 'critical') ||
      loopArith.some(l => l.riskLevel === 'critical') ||
      vulnLibs.some(v => v.severity === 'CRITICAL')) {
    return 'critical';
  }

  // High if any high finding
  if (shiftOps.some(s => s.riskLevel === 'high') ||
      downcasts.some(d => d.riskLevel === 'high') ||
      loopArith.some(l => l.riskLevel === 'high') ||
      vulnLibs.some(v => v.severity === 'HIGH')) {
    return 'high';
  }

  // Medium if any medium finding
  if (shiftOps.length > 0 || downcasts.length > 0 ||
      loopArith.length > 0 || vulnLibs.length > 0) {
    return 'medium';
  }

  return 'none';
}

/**
 * Generate issues from overflow analysis
 */
function generateIssues(
  shiftOps: ShiftOperationRisk[],
  downcasts: DowncastRisk[],
  loopArith: LoopArithmeticRisk[],
  vulnLibs: VulnerableLibraryUsage[]
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  // Shift operation issues
  for (const shift of shiftOps.filter(s => s.riskLevel === 'critical' || s.riskLevel === 'high')) {
    issues.push({
      patternId: 'overflow:shift_operation',
      category: 'EXPLOIT',
      severity: shift.riskLevel === 'critical' ? 'CRITICAL' : 'HIGH',
      title: `Unchecked Shift Operation (Cetus-Type Vulnerability)`,
      description: `Function '${shift.functionName}' contains a ${shift.direction} shift operation ${shift.inLoop ? 'inside a loop ' : ''}without proper bounds checking. ` +
        `This is the SAME class of vulnerability that caused the $223M Cetus Protocol hack in May 2025. ` +
        `An attacker could provide a large shift amount to cause integer overflow.`,
      recommendation: 'Add bounds checking: `assert!(shift_amount < 256, E_SHIFT_OVERFLOW)` before shift operations. ' +
        'Consider using checked_* variants or Move Prover to verify arithmetic safety.',
      confidence: shift.inLoop ? CONFIDENCE_LEVELS.HIGH : CONFIDENCE_LEVELS.MEDIUM,
      source: 'pattern' as const,
      evidence: {
        function: shift.functionName,
        direction: shift.direction,
        inLoop: shift.inLoop,
        hasAmountCheck: shift.hasAmountCheck,
        cetusHackReference: 'https://x.com/paboricke/status/1925620046653083814',
      },
    });
  }

  // Downcast issues
  for (const cast of downcasts.filter(d => d.riskLevel === 'critical' || d.riskLevel === 'high')) {
    issues.push({
      patternId: 'overflow:unsafe_downcast',
      category: 'EXPLOIT',
      severity: cast.riskLevel === 'critical' ? 'CRITICAL' : 'HIGH',
      title: `Unsafe Integer Downcast: ${cast.fromType} → ${cast.toType}`,
      description: `Function '${cast.functionName}' casts a larger integer type to ${cast.toType} without range checking. ` +
        `Values exceeding ${cast.toType}'s maximum will be truncated, leading to unexpected behavior.`,
      recommendation: `Add range check before cast: \`assert!(value <= ${cast.toType.toUpperCase()}_MAX, E_OVERFLOW)\``,
      confidence: CONFIDENCE_LEVELS.HIGH,
      source: 'pattern' as const,
      evidence: {
        function: cast.functionName,
        fromType: cast.fromType,
        toType: cast.toType,
        hasRangeCheck: cast.hasRangeCheck,
      },
    });
  }

  // Loop arithmetic issues
  for (const loop of loopArith.filter(l => l.riskLevel === 'critical')) {
    issues.push({
      patternId: 'overflow:loop_arithmetic',
      category: 'EXPLOIT',
      severity: 'CRITICAL',
      title: `Unbounded Arithmetic in Loop`,
      description: `Function '${loop.functionName}' performs ${loop.operation} inside a loop with ${loop.iterationCount} iteration count. ` +
        `Arithmetic in loops can compound, making overflow much more likely.`,
      recommendation: 'Bound loop iterations, use checked arithmetic, and validate intermediate results',
      confidence: loop.iterationCount === 'user_controlled' ? CONFIDENCE_LEVELS.HIGH : CONFIDENCE_LEVELS.MEDIUM,
      source: 'pattern' as const,
      evidence: {
        function: loop.functionName,
        operation: loop.operation,
        iterationCount: loop.iterationCount,
      },
    });
  }

  // Vulnerable library issues
  for (const lib of vulnLibs) {
    issues.push({
      patternId: `overflow:vulnerable_library:${lib.libraryName}`,
      category: 'EXPLOIT',
      severity: lib.severity,
      title: `Usage of Vulnerable Library: ${lib.libraryName}`,
      description: `Function '${lib.callerFunction}' uses '${lib.functionName}' from '${lib.libraryName}'. ` +
        `${lib.vulnerability}` +
        (lib.incident ? ` This library was involved in the ${lib.incident}.` : ''),
      recommendation: 'Audit usage carefully, add input validation, or use safer alternatives',
      confidence: lib.incident ? CONFIDENCE_LEVELS.HIGH : CONFIDENCE_LEVELS.MEDIUM,
      source: 'pattern' as const,
      evidence: {
        library: lib.libraryName,
        function: lib.functionName,
        caller: lib.callerFunction,
        knownIncident: lib.incident || 'none',
      },
    });
  }

  return issues;
}

/**
 * Generate summary of overflow analysis
 */
function generateSummary(result: IntegerOverflowResult): string {
  const lines: string[] = [];

  if (result.riskLevel === 'none') {
    return '✅ No significant integer overflow risks detected';
  }

  const icon = result.riskLevel === 'critical' ? '🔴' :
               result.riskLevel === 'high' ? '🟠' :
               result.riskLevel === 'medium' ? '🟡' : '🟢';

  lines.push(`${icon} Integer Overflow Risk: ${result.riskLevel.toUpperCase()}`);
  lines.push('');

  if (result.shiftOperations.length > 0) {
    lines.push(`⚠️  Shift Operations: ${result.shiftOperations.length}`);
    const criticalShifts = result.shiftOperations.filter(s => s.riskLevel === 'critical');
    if (criticalShifts.length > 0) {
      lines.push(`   🔴 ${criticalShifts.length} CRITICAL (Cetus-type vulnerability)`);
    }
  }

  if (result.downcastOperations.length > 0) {
    lines.push(`⚠️  Unsafe Downcasts: ${result.downcastOperations.length}`);
  }

  if (result.loopArithmetic.length > 0) {
    lines.push(`⚠️  Loop Arithmetic: ${result.loopArithmetic.length}`);
    const userControlled = result.loopArithmetic.filter(l => l.iterationCount === 'user_controlled');
    if (userControlled.length > 0) {
      lines.push(`   🔴 ${userControlled.length} with user-controlled iteration count`);
    }
  }

  if (result.vulnerableLibraryUsage.length > 0) {
    lines.push(`⚠️  Vulnerable Library Usage: ${result.vulnerableLibraryUsage.length}`);
    for (const lib of result.vulnerableLibraryUsage) {
      lines.push(`   - ${lib.libraryName}::${lib.functionName}`);
      if (lib.incident) {
        lines.push(`     (${lib.incident})`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Main integer overflow analysis
 */
export async function analyzeIntegerOverflow(
  moduleAddress: string,
  moduleName: string,
  network: Network = 'testnet'
): Promise<IntegerOverflowResult> {
  const moduleAnalysis = await analyzeModuleBytecode(moduleAddress, moduleName, network);

  if (!moduleAnalysis) {
    return {
      hasOverflowRisk: false,
      riskLevel: 'none',
      shiftOperations: [],
      arithmeticPatterns: [],
      downcastOperations: [],
      loopArithmetic: [],
      vulnerableLibraryUsage: [],
      issues: [],
      summary: 'Unable to analyze module bytecode',
    };
  }

  // Collect all findings
  const shiftOperations: ShiftOperationRisk[] = [];
  const downcastOperations: DowncastRisk[] = [];
  const loopArithmetic: LoopArithmeticRisk[] = [];

  for (const func of moduleAnalysis.functions) {
    shiftOperations.push(...analyzeShiftOperations(func));
    downcastOperations.push(...analyzeDowncasts(func));
    loopArithmetic.push(...analyzeLoopArithmetic(func));
  }

  const vulnerableLibraryUsage = checkVulnerableLibraries(moduleAnalysis);

  // Calculate overall risk
  const riskLevel = calculateOverallRisk(
    shiftOperations,
    downcastOperations,
    loopArithmetic,
    vulnerableLibraryUsage
  );

  // Generate issues
  const issues = generateIssues(
    shiftOperations,
    downcastOperations,
    loopArithmetic,
    vulnerableLibraryUsage
  );

  const result: IntegerOverflowResult = {
    hasOverflowRisk: riskLevel !== 'none',
    riskLevel,
    shiftOperations,
    arithmeticPatterns: [],
    downcastOperations,
    loopArithmetic,
    vulnerableLibraryUsage,
    issues,
    summary: '',
  };

  result.summary = generateSummary(result);

  return result;
}

/**
 * Quick check for overflow risk from function signature
 */
export function quickOverflowCheck(
  functionName: string,
  paramTypes: string[]
): { hasRisk: boolean; reason?: string } {
  // Check function name for dangerous patterns
  for (const pattern of DANGEROUS_ARITHMETIC_PATTERNS) {
    if (pattern.pattern.test(functionName)) {
      return {
        hasRisk: true,
        reason: `Function performs ${pattern.operation} (${pattern.risk} risk)`,
      };
    }
  }

  // Check if function is explicitly safe
  for (const safePattern of SAFE_PATTERNS) {
    if (safePattern.test(functionName)) {
      return { hasRisk: false };
    }
  }

  // Check parameter types for large integers
  const hasLargeInts = paramTypes.some(t =>
    t.includes('u128') || t.includes('u256')
  );

  if (hasLargeInts && /mul|add|sub|pow|shift/i.test(functionName)) {
    return {
      hasRisk: true,
      reason: 'Function operates on large integers without explicit safety markers',
    };
  }

  return { hasRisk: false };
}

export {
  VULNERABLE_LIBRARIES,
  DANGEROUS_ARITHMETIC_PATTERNS,
  SAFE_PATTERNS,
};
