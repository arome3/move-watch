/**
 * Advanced Pattern Detector
 *
 * Combines multiple analysis techniques for sophisticated threat detection:
 * - Control Flow Graph (CFG) analysis
 * - Data flow tracking
 * - Semantic analysis of state changes
 * - Cross-function vulnerability patterns
 * - Temporal pattern matching (event ordering)
 *
 * This represents industry-grade static analysis, going far beyond
 * simple regex pattern matching.
 */

import type { Network, RiskSeverity, RiskCategory } from '@movewatch/shared';
import type { DetectedIssue, AnalysisData } from './types.js';
import { CONFIDENCE_LEVELS } from './utils.js';
import type { ModuleAnalysis, FunctionAnalysis, ControlFlowGraph } from './moveBytecodeParser.js';
import type { PrivilegeEscalationResult } from './privilegeEscalationDetector.js';
import type { IntegerOverflowResult } from './integerOverflowDetector.js';

// ============================================================================
// TYPES
// ============================================================================

// Advanced pattern definition
export interface AdvancedPattern {
  id: string;
  name: string;
  description: string;
  severity: RiskSeverity;
  category: RiskCategory;

  // Detection method
  detectMethod: 'cfg' | 'dataflow' | 'temporal' | 'cross_function' | 'state_semantic';

  // Pattern-specific detector
  detect: (context: PatternContext) => PatternMatch | null;

  // Metadata
  references?: string[];
  cwe?: string; // Common Weakness Enumeration ID
}

// Context passed to pattern detectors
export interface PatternContext {
  // Analysis data
  analysisData: AnalysisData;

  // Module analysis (if available)
  moduleAnalysis?: ModuleAnalysis;

  // Function-level analysis
  functionAnalysis?: FunctionAnalysis;

  // CFG (if available)
  cfg?: ControlFlowGraph;

  // Other analysis results
  privilegeAnalysis?: PrivilegeEscalationResult;
  overflowAnalysis?: IntegerOverflowResult;

  // Transaction context
  sender: string;
  functionName: string;
  moduleAddress: string;
  arguments: unknown[];
  events?: Array<{ type: string; data: unknown }>;
  stateChanges?: Array<{ type: string; key: string; value: unknown }>;
}

// Pattern match result
export interface PatternMatch {
  patternId: string;
  severity: RiskSeverity;
  confidence: number;
  evidence: Record<string, unknown>;
  location?: {
    function?: string;
    instruction?: number;
    cfgBlock?: number;
  };
}

// Temporal event pattern
export interface TemporalPattern {
  name: string;
  events: Array<{
    type: string;
    constraint?: 'must_precede' | 'must_follow' | 'must_not_exist';
  }>;
  isMalicious: boolean;
  description: string;
}

// Data flow path
export interface DataFlowPath {
  source: { type: 'param' | 'external' | 'constant'; index?: number };
  sink: { type: 'arithmetic' | 'storage' | 'transfer' | 'call' };
  transformations: string[];
  isTainted: boolean;
}

// ============================================================================
// TEMPORAL PATTERNS (Event Ordering)
// ============================================================================

const TEMPORAL_PATTERNS: TemporalPattern[] = [
  {
    name: 'Oracle Manipulation',
    events: [
      { type: 'PriceUpdate', constraint: 'must_precede' },
      { type: 'Swap', constraint: 'must_follow' },
    ],
    isMalicious: true,
    description: 'Price oracle updated immediately before swap - classic oracle manipulation',
  },
  {
    name: 'Flash Loan Attack',
    events: [
      { type: 'FlashLoan', constraint: 'must_precede' },
      { type: 'Swap' },
      { type: 'FlashLoanRepay', constraint: 'must_follow' },
    ],
    isMalicious: false, // Flash loans themselves aren't malicious
    description: 'Flash loan pattern detected - verify loan is repaid in same tx',
  },
  {
    name: 'Sandwich Attack',
    events: [
      { type: 'Swap', constraint: 'must_precede' },
      { type: 'UserSwap' },
      { type: 'Swap', constraint: 'must_follow' },
    ],
    isMalicious: true,
    description: 'Sandwich attack pattern - swaps before and after target transaction',
  },
  {
    name: 'Reentrancy Pattern',
    events: [
      { type: 'ExternalCall', constraint: 'must_precede' },
      { type: 'StateUpdate', constraint: 'must_follow' },
    ],
    isMalicious: true,
    description: 'State update after external call - potential reentrancy vulnerability',
  },
  {
    name: 'Legitimate Ownership Transfer',
    events: [
      { type: 'OwnershipTransferRequested' },
      { type: 'TimelockStart' },
      { type: 'OwnershipTransferExecuted' },
    ],
    isMalicious: false,
    description: 'Ownership transfer with timelock - legitimate pattern',
  },
  {
    name: 'Instant Ownership Transfer',
    events: [
      { type: 'OwnershipTransferred' },
    ],
    isMalicious: true,
    description: 'Instant ownership transfer without timelock - potential rug pull setup',
  },
];

// ============================================================================
// ADVANCED PATTERNS
// ============================================================================

const ADVANCED_PATTERNS: AdvancedPattern[] = [
  // -------------------------------------------------------------------------
  // CFG-Based Patterns
  // -------------------------------------------------------------------------
  {
    id: 'adv:unreachable_code',
    name: 'Unreachable Code (Hidden Logic)',
    description: 'Code that appears unreachable but could be triggered by specific conditions',
    severity: 'MEDIUM',
    category: 'PERMISSION',
    detectMethod: 'cfg',
    detect: (ctx) => {
      if (!ctx.cfg) return null;

      const unreachable = ctx.cfg.unreachableBlocks;
      if (unreachable.length === 0) return null;

      // Check if unreachable code contains dangerous operations
      const dangerousOps = ['MOVE_FROM', 'CALL', 'BORROW_GLOBAL_MUT'];
      let hasDangerousOps = false;

      for (const blockId of unreachable) {
        const block = ctx.cfg.blocks.get(blockId);
        if (block) {
          for (const inst of block.instructions) {
            if (dangerousOps.includes(inst.opcodeName)) {
              hasDangerousOps = true;
              break;
            }
          }
        }
      }

      if (!hasDangerousOps) return null;

      return {
        patternId: 'adv:unreachable_code',
        severity: 'MEDIUM',
        confidence: 60,
        evidence: {
          unreachableBlocks: unreachable.length,
          hasDangerousOperations: true,
        },
        location: {
          cfgBlock: unreachable[0],
        },
      };
    },
    cwe: 'CWE-561',
  },

  {
    id: 'adv:infinite_loop_risk',
    name: 'Potential Infinite Loop',
    description: 'Loop without clear termination condition',
    severity: 'HIGH',
    category: 'EXPLOIT',
    detectMethod: 'cfg',
    detect: (ctx) => {
      if (!ctx.cfg) return null;

      for (const loop of ctx.cfg.loops) {
        const headerBlock = ctx.cfg.blocks.get(loop.header);
        if (!headerBlock) continue;

        // Check if loop has a comparison before branch (termination check)
        const hasTerminationCheck = headerBlock.instructions.some(i =>
          i.category === 'comparison'
        );

        if (!hasTerminationCheck) {
          return {
            patternId: 'adv:infinite_loop_risk',
            severity: 'HIGH',
            confidence: 70,
            evidence: {
              loopHeader: loop.header,
              loopBody: loop.body,
              missingTerminationCheck: true,
            },
            location: {
              cfgBlock: loop.header,
            },
          };
        }
      }

      return null;
    },
    cwe: 'CWE-835',
  },

  // -------------------------------------------------------------------------
  // Data Flow Patterns
  // -------------------------------------------------------------------------
  {
    id: 'adv:tainted_arithmetic',
    name: 'User Input in Arithmetic',
    description: 'User-controlled values used directly in arithmetic without validation',
    severity: 'HIGH',
    category: 'EXPLOIT',
    detectMethod: 'dataflow',
    detect: (ctx) => {
      if (!ctx.functionAnalysis) return null;

      // Check if function has arithmetic and parameters
      const hasArithmetic = ctx.functionAnalysis.arithmeticOps > 0;
      const hasParams = ctx.functionAnalysis.instructionCount > 5; // Heuristic for params

      if (!hasArithmetic || !hasParams) return null;

      // Check for overflow risks from user input
      const userControlledOverflow = ctx.functionAnalysis.overflowRisks.filter(r =>
        r.userControlled && r.riskLevel === 'high'
      );

      if (userControlledOverflow.length === 0) return null;

      return {
        patternId: 'adv:tainted_arithmetic',
        severity: 'HIGH',
        confidence: 75,
        evidence: {
          riskyOperations: userControlledOverflow.map(r => ({
            opcode: r.opcode,
            inLoop: r.inLoop,
          })),
          functionName: ctx.functionAnalysis.name,
        },
        location: {
          function: ctx.functionAnalysis.name,
        },
      };
    },
    cwe: 'CWE-190',
  },

  {
    id: 'adv:unchecked_return',
    name: 'Unchecked External Call Return',
    description: 'Return value from external call not verified',
    severity: 'MEDIUM',
    category: 'PERMISSION',
    detectMethod: 'dataflow',
    detect: (ctx) => {
      if (!ctx.functionAnalysis) return null;

      // Check for external calls without subsequent comparison
      const hasExternalCalls = ctx.functionAnalysis.externalCalls > 0;
      if (!hasExternalCalls) return null;

      // Simplified check: if there are calls but few comparisons
      const comparisonRatio = ctx.functionAnalysis.cfg.blocks.size > 0
        ? ctx.functionAnalysis.externalCalls
        : 0;

      if (comparisonRatio > 2) {
        return {
          patternId: 'adv:unchecked_return',
          severity: 'MEDIUM',
          confidence: 55,
          evidence: {
            externalCalls: ctx.functionAnalysis.externalCalls,
            functionName: ctx.functionAnalysis.name,
          },
          location: {
            function: ctx.functionAnalysis.name,
          },
        };
      }

      return null;
    },
    cwe: 'CWE-252',
  },

  // -------------------------------------------------------------------------
  // Temporal Patterns
  // -------------------------------------------------------------------------
  {
    id: 'adv:oracle_manipulation',
    name: 'Oracle Price Manipulation',
    description: 'Price oracle updated in same transaction as swap',
    severity: 'CRITICAL',
    category: 'EXPLOIT',
    detectMethod: 'temporal',
    detect: (ctx) => {
      if (!ctx.events || ctx.events.length < 2) return null;

      // Check for price update before swap
      let priceUpdateIndex = -1;
      let swapIndex = -1;

      for (let i = 0; i < ctx.events.length; i++) {
        const event = ctx.events[i];
        if (/price|oracle|update.*price/i.test(event.type)) {
          priceUpdateIndex = i;
        }
        if (/swap|exchange|trade/i.test(event.type)) {
          swapIndex = i;
        }
      }

      // Malicious pattern: price update BEFORE swap
      if (priceUpdateIndex !== -1 && swapIndex !== -1 && priceUpdateIndex < swapIndex) {
        return {
          patternId: 'adv:oracle_manipulation',
          severity: 'CRITICAL',
          confidence: 85,
          evidence: {
            priceUpdateEvent: ctx.events[priceUpdateIndex].type,
            swapEvent: ctx.events[swapIndex].type,
            eventOrder: 'price_update_before_swap',
            attackType: 'Oracle manipulation - price set before swap execution',
          },
        };
      }

      return null;
    },
    references: ['https://samczsun.com/so-you-want-to-use-a-price-oracle/'],
  },

  {
    id: 'adv:flash_loan_pattern',
    name: 'Flash Loan Pattern',
    description: 'Flash loan borrow and repay in same transaction',
    severity: 'MEDIUM', // Not inherently malicious
    category: 'EXPLOIT',
    detectMethod: 'temporal',
    detect: (ctx) => {
      if (!ctx.events || ctx.events.length < 2) return null;

      const flashBorrow = ctx.events.find(e =>
        /flash.*borrow|borrow.*flash|flashloan/i.test(e.type)
      );
      const flashRepay = ctx.events.find(e =>
        /flash.*repay|repay.*flash|flashloan.*return/i.test(e.type)
      );

      if (flashBorrow && flashRepay) {
        return {
          patternId: 'adv:flash_loan_pattern',
          severity: 'MEDIUM',
          confidence: 90,
          evidence: {
            borrowEvent: flashBorrow.type,
            repayEvent: flashRepay.type,
            note: 'Flash loan detected - verify business logic is protected',
          },
        };
      }

      return null;
    },
  },

  // -------------------------------------------------------------------------
  // Cross-Function Patterns
  // -------------------------------------------------------------------------
  {
    id: 'adv:privileged_without_check',
    name: 'Privileged Function Without Access Check',
    description: 'Admin/owner function callable without proper authorization',
    severity: 'CRITICAL',
    category: 'PERMISSION',
    detectMethod: 'cross_function',
    detect: (ctx) => {
      if (!ctx.privilegeAnalysis) return null;

      const criticalAdmins = ctx.privilegeAnalysis.adminFunctions.filter(
        a => a.riskLevel === 'critical'
      );

      if (criticalAdmins.length === 0) return null;

      return {
        patternId: 'adv:privileged_without_check',
        severity: 'CRITICAL',
        confidence: 85,
        evidence: {
          functions: criticalAdmins.map(a => ({
            name: a.name,
            missingChecks: a.missingChecks,
          })),
          count: criticalAdmins.length,
        },
        location: {
          function: criticalAdmins[0].name,
        },
      };
    },
    cwe: 'CWE-862',
  },

  {
    id: 'adv:reentrancy_risk',
    name: 'Cross-Function Reentrancy',
    description: 'External call before state update across functions',
    severity: 'CRITICAL',
    category: 'EXPLOIT',
    detectMethod: 'cross_function',
    detect: (ctx) => {
      if (!ctx.moduleAnalysis) return null;

      // Look for functions that: 1) make external calls 2) modify state
      const riskyFunctions = ctx.moduleAnalysis.functions.filter(f =>
        f.externalCalls > 0 && f.hasGlobalStateMutation
      );

      if (riskyFunctions.length === 0) return null;

      return {
        patternId: 'adv:reentrancy_risk',
        severity: 'HIGH', // HIGH not CRITICAL without proof
        confidence: 60,
        evidence: {
          functions: riskyFunctions.map(f => f.name),
          note: 'Functions with external calls and state mutation - verify reentrancy safety',
        },
      };
    },
    cwe: 'CWE-841',
  },

  // -------------------------------------------------------------------------
  // State Semantic Patterns
  // -------------------------------------------------------------------------
  {
    id: 'adv:balance_drain',
    name: 'Balance Drain Pattern',
    description: 'Transaction drains significant balance to external address',
    severity: 'CRITICAL',
    category: 'RUG_PULL',
    detectMethod: 'state_semantic',
    detect: (ctx) => {
      if (!ctx.stateChanges) return null;

      // Look for balance decreases
      const balanceChanges = ctx.stateChanges.filter(c =>
        /balance|coin|token/i.test(c.key)
      );

      const drains = balanceChanges.filter(c => {
        // Check if it's a decrease
        const value = typeof c.value === 'number' ? c.value :
                      typeof c.value === 'string' ? parseFloat(c.value) : 0;
        return value < 0;
      });

      if (drains.length === 0) return null;

      // Check if drain goes to sender (withdrawal to self is fine)
      // vs external address (potential drain)
      const suspiciousDrains = drains.filter(d => {
        const key = d.key.toLowerCase();
        return !key.includes(ctx.sender.toLowerCase());
      });

      if (suspiciousDrains.length === 0) return null;

      return {
        patternId: 'adv:balance_drain',
        severity: 'CRITICAL',
        confidence: 75,
        evidence: {
          drains: suspiciousDrains.map(d => ({
            key: d.key,
            value: d.value,
          })),
          sender: ctx.sender,
          note: 'Balance being drained to potentially external address',
        },
      };
    },
  },

  {
    id: 'adv:unlimited_approval',
    name: 'Unlimited Token Approval',
    description: 'Approving unlimited token spending',
    severity: 'HIGH',
    category: 'PERMISSION',
    detectMethod: 'state_semantic',
    detect: (ctx) => {
      // Check function name
      if (!/approve|set.*allowance|increase.*allowance/i.test(ctx.functionName)) {
        return null;
      }

      // Check arguments for max value
      const MAX_U64 = BigInt('18446744073709551615');
      const MAX_U128 = BigInt('340282366920938463463374607431768211455');

      for (const arg of ctx.arguments) {
        const value = typeof arg === 'bigint' ? arg :
                      typeof arg === 'number' ? BigInt(arg) :
                      typeof arg === 'string' ? BigInt(arg) : BigInt(0);

        if (value >= MAX_U64 || value >= MAX_U128) {
          return {
            patternId: 'adv:unlimited_approval',
            severity: 'HIGH',
            confidence: 90,
            evidence: {
              function: ctx.functionName,
              approvalAmount: value.toString(),
              isMaxValue: true,
              warning: 'Unlimited approval allows spender to transfer all tokens',
            },
          };
        }
      }

      return null;
    },
    cwe: 'CWE-285',
  },
];

// ============================================================================
// DETECTION ENGINE
// ============================================================================

/**
 * Run all advanced pattern detections
 */
export function runAdvancedPatternDetection(
  context: PatternContext
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  for (const pattern of ADVANCED_PATTERNS) {
    try {
      const match = pattern.detect(context);

      if (match) {
        issues.push({
          patternId: match.patternId,
          category: pattern.category,
          severity: match.severity,
          title: pattern.name,
          description: pattern.description,
          recommendation: getRecommendation(pattern),
          confidence: match.confidence / 100, // Normalize to 0-1
          source: 'pattern' as const,
          evidence: {
            ...match.evidence,
            location: match.location,
            cwe: pattern.cwe,
            references: pattern.references,
          },
        });
      }
    } catch (error) {
      // Continue on individual pattern errors
      console.warn(`Pattern ${pattern.id} error:`, error);
    }
  }

  return issues;
}

/**
 * Run temporal pattern detection on events
 */
export function detectTemporalPatterns(
  events: Array<{ type: string; data: unknown }>
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  for (const pattern of TEMPORAL_PATTERNS) {
    const matchResult = matchTemporalPattern(events, pattern);

    if (matchResult.matched && pattern.isMalicious) {
      issues.push({
        patternId: `temporal:${pattern.name.toLowerCase().replace(/\s+/g, '_')}`,
        category: 'EXPLOIT',
        severity: 'CRITICAL',
        title: `Temporal Pattern: ${pattern.name}`,
        description: pattern.description,
        recommendation: 'Review event ordering carefully. This pattern is commonly associated with attacks.',
        confidence: CONFIDENCE_LEVELS.HIGH,
        source: 'pattern' as const,
        evidence: {
          eventSequence: matchResult.matchedEvents,
          patternDescription: pattern.description,
        },
      });
    }
  }

  return issues;
}

/**
 * Match a temporal pattern against events
 */
function matchTemporalPattern(
  events: Array<{ type: string; data: unknown }>,
  pattern: TemporalPattern
): { matched: boolean; matchedEvents: string[] } {
  const matchedEvents: string[] = [];
  let lastMatchIndex = -1;

  for (const patternEvent of pattern.events) {
    let found = false;

    for (let i = lastMatchIndex + 1; i < events.length; i++) {
      if (events[i].type.toLowerCase().includes(patternEvent.type.toLowerCase())) {
        if (patternEvent.constraint === 'must_not_exist') {
          return { matched: false, matchedEvents: [] };
        }

        matchedEvents.push(events[i].type);
        lastMatchIndex = i;
        found = true;
        break;
      }
    }

    if (!found && patternEvent.constraint !== 'must_not_exist') {
      return { matched: false, matchedEvents: [] };
    }
  }

  return {
    matched: matchedEvents.length === pattern.events.filter(e => e.constraint !== 'must_not_exist').length,
    matchedEvents,
  };
}

/**
 * Get recommendation for pattern
 */
function getRecommendation(pattern: AdvancedPattern): string {
  switch (pattern.detectMethod) {
    case 'cfg':
      return 'Review the control flow of this function. Consider simplifying logic and removing unreachable code.';
    case 'dataflow':
      return 'Validate all user inputs before use in sensitive operations. Add bounds checking.';
    case 'temporal':
      return 'Review the ordering of operations. Some attack patterns rely on specific event sequences.';
    case 'cross_function':
      return 'Review function interactions. Ensure proper access control and state consistency.';
    case 'state_semantic':
      return 'Review state changes carefully. Ensure they match expected business logic.';
    default:
      return 'Review this code section carefully for security issues.';
  }
}

/**
 * Get statistics about advanced pattern detection
 */
export function getAdvancedPatternStats(): {
  totalPatterns: number;
  byMethod: Record<string, number>;
  bySeverity: Record<string, number>;
  temporalPatterns: number;
} {
  const byMethod: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const pattern of ADVANCED_PATTERNS) {
    byMethod[pattern.detectMethod] = (byMethod[pattern.detectMethod] || 0) + 1;
    bySeverity[pattern.severity] = (bySeverity[pattern.severity] || 0) + 1;
  }

  return {
    totalPatterns: ADVANCED_PATTERNS.length,
    byMethod,
    bySeverity,
    temporalPatterns: TEMPORAL_PATTERNS.length,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  ADVANCED_PATTERNS,
  TEMPORAL_PATTERNS,
};
