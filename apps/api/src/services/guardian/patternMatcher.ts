import type {
  RiskCategory,
  RiskSeverity,
  StateChange,
  SimulationEvent,
} from '@movewatch/shared';
import type {
  AnalysisData,
  PatternMatchResult,
  RiskPatternDefinition,
  DetectedIssue,
} from './types.js';
import { ALL_PATTERNS, getPatternById } from './patterns/index.js';
import {
  SEVERITY_WEIGHTS,
  SEVERITY_ORDER,
  CONFIDENCE_LEVELS,
  sortBySeverity,
} from './utils.js';

/**
 * Pattern Matcher Engine
 * Runs all patterns against transaction data and returns detected issues
 */

/**
 * Parse function path into components
 * e.g., "0x1::coin::transfer" -> ["0x1", "coin", "transfer"]
 */
function parseFunctionPath(functionName: string): {
  moduleAddress: string;
  moduleName: string;
  functionBaseName: string;
} {
  const parts = functionName.split('::');
  if (parts.length >= 3) {
    return {
      moduleAddress: parts[0],
      moduleName: parts[1],
      functionBaseName: parts.slice(2).join('::'),
    };
  }
  // Fallback for non-standard paths
  return {
    moduleAddress: parts[0] || '',
    moduleName: parts[1] || '',
    functionBaseName: parts[2] || functionName,
  };
}

/**
 * Build analysis data from request and optional simulation
 */
export function buildAnalysisData(
  functionName: string,
  typeArguments: string[],
  args: unknown[],
  sender?: string,
  simulation?: {
    success: boolean;
    gasUsed?: number;
    stateChanges?: StateChange[];
    events?: SimulationEvent[];
    error?: unknown;
  }
): AnalysisData {
  const { moduleAddress, moduleName, functionBaseName } =
    parseFunctionPath(functionName);

  return {
    functionName,
    moduleAddress,
    moduleName,
    functionBaseName,
    typeArguments,
    arguments: args,
    sender,
    simulationResult: simulation,
  };
}

/**
 * Check if a pattern matches the analysis data
 */
function matchPattern(
  pattern: RiskPatternDefinition,
  data: AnalysisData
): PatternMatchResult | null {
  const criteria = pattern.matchCriteria;

  // 1. Try custom matcher first (most specific)
  if (criteria.customMatcher) {
    const result = criteria.customMatcher(data);
    if (result && result.matched) {
      return result;
    }
  }

  // 2. Check function patterns
  if (criteria.functionPatterns && criteria.functionPatterns.length > 0) {
    const fnMatch = criteria.functionPatterns.some(
      (regex) =>
        regex.test(data.functionName) || regex.test(data.functionBaseName)
    );
    if (fnMatch) {
      return {
        matched: true,
        patternId: pattern.id,
        category: pattern.category,
        severity: pattern.severity,
        confidence: CONFIDENCE_LEVELS.MEDIUM, // Regex-only match needs context
      };
    }
  }

  // 3. Check module patterns
  if (criteria.modulePatterns && criteria.modulePatterns.length > 0) {
    const modMatch = criteria.modulePatterns.some((regex) =>
      regex.test(data.moduleAddress)
    );
    if (modMatch) {
      return {
        matched: true,
        patternId: pattern.id,
        category: pattern.category,
        severity: pattern.severity,
        confidence: CONFIDENCE_LEVELS.LOW, // Module-only match is less specific
      };
    }
  }

  // 4. Check event patterns
  if (
    criteria.eventPatterns &&
    criteria.eventPatterns.length > 0 &&
    data.simulationResult?.events
  ) {
    const events = data.simulationResult.events;
    const requiredPatterns = criteria.eventPatterns.filter((p) => p.required);
    const optionalPatterns = criteria.eventPatterns.filter((p) => !p.required);

    // All required patterns must match
    const allRequiredMatch = requiredPatterns.every((ep) =>
      events.some((e) => ep.type.test(e.type))
    );

    // At least one optional pattern should match (if any exist)
    const anyOptionalMatch =
      optionalPatterns.length === 0 ||
      optionalPatterns.some((ep) => events.some((e) => ep.type.test(e.type)));

    if (allRequiredMatch && anyOptionalMatch && requiredPatterns.length > 0) {
      return {
        matched: true,
        patternId: pattern.id,
        category: pattern.category,
        severity: pattern.severity,
        confidence: CONFIDENCE_LEVELS.HIGH, // Event-based detection is reliable
        evidence: {
          matchedEvents: events
            .filter((e) =>
              criteria.eventPatterns!.some((ep) => ep.type.test(e.type))
            )
            .map((e) => e.type),
        },
      };
    }
  }

  // 5. Check gas threshold
  if (criteria.gasThreshold && data.simulationResult?.gasUsed) {
    const gas = data.simulationResult.gasUsed;
    const { min, max } = criteria.gasThreshold;

    if ((min && gas >= min) || (max && gas <= max)) {
      return {
        matched: true,
        patternId: pattern.id,
        category: pattern.category,
        severity: pattern.severity,
        confidence: CONFIDENCE_LEVELS.HIGH, // Gas data is objective
        evidence: { gasUsed: gas, threshold: criteria.gasThreshold },
      };
    }
  }

  return null;
}

/**
 * Run all patterns against the analysis data
 * Returns all matched patterns with their results
 */
export function runPatternMatching(data: AnalysisData): PatternMatchResult[] {
  const results: PatternMatchResult[] = [];

  for (const pattern of ALL_PATTERNS) {
    try {
      const result = matchPattern(pattern, data);
      if (result && result.matched) {
        results.push(result);
      }
    } catch (error) {
      // Log but don't fail on individual pattern errors
      console.error(`Pattern ${pattern.id} failed:`, error);
    }
  }

  return results;
}

/**
 * Convert pattern match results to detected issues
 */
export function convertToIssues(results: PatternMatchResult[]): DetectedIssue[] {
  return results.map((result) => {
    const pattern = getPatternById(result.patternId);

    if (!pattern) {
      // Fallback for unknown patterns
      return {
        patternId: result.patternId,
        category: result.category,
        severity: result.severity,
        title: 'Unknown Risk Pattern',
        description: 'A potential risk was detected.',
        recommendation: 'Review the transaction carefully.',
        evidence: result.evidence,
        confidence: result.confidence,
        source: 'pattern' as const,
      };
    }

    return {
      patternId: result.patternId,
      category: pattern.category,
      severity: result.severity, // Use result severity (may be modified)
      title: pattern.issueTemplate.title,
      description: pattern.issueTemplate.description,
      recommendation: pattern.issueTemplate.recommendation,
      evidence: result.evidence,
      confidence: result.confidence,
      source: 'pattern' as const,
    };
  });
}

/**
 * Calculate overall risk score from detected issues
 * Score: 0-100 where higher = more risky
 *
 * Scoring Algorithm:
 * 1. Each issue contributes: weight × confidence
 * 2. LOW severity issues are capped at 20 total contribution (prevents accumulation attacks)
 * 3. CRITICAL issues always result in CRITICAL overall severity (security principle)
 * 4. Final score is max(maxSeverityScore, cappedWeightedSum) to ensure severity dominates
 *
 * Severity weights:
 * - CRITICAL: 90 (immediate danger)
 * - HIGH: 60 (significant risk)
 * - MEDIUM: 30 (moderate concern)
 * - LOW: 10 (informational)
 */
export function calculateRiskScore(issues: DetectedIssue[]): {
  score: number;
  severity: RiskSeverity;
} {
  if (issues.length === 0) {
    return { score: 0, severity: 'LOW' };
  }

  // Track contributions by severity level
  const contributions: Record<RiskSeverity, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };

  let maxSeverity: RiskSeverity = 'LOW';
  let maxSeverityConfidence = 0;

  for (const issue of issues) {
    const weight = SEVERITY_WEIGHTS[issue.severity] * issue.confidence;
    contributions[issue.severity] += weight;

    // Track highest severity and its max confidence
    const currentIndex = SEVERITY_ORDER.indexOf(issue.severity);
    const maxIndex = SEVERITY_ORDER.indexOf(maxSeverity);

    if (currentIndex < maxIndex) {
      // Found a more severe issue (CRITICAL is index 0)
      maxSeverity = issue.severity;
      maxSeverityConfidence = issue.confidence;
    } else if (currentIndex === maxIndex && issue.confidence > maxSeverityConfidence) {
      maxSeverityConfidence = issue.confidence;
    }
  }

  // Cap LOW severity contribution to prevent accumulation attacks
  // Many LOW issues shouldn't trigger HIGH/CRITICAL ratings
  const cappedLowContribution = Math.min(contributions.LOW, 20);

  // Calculate total weighted score with caps
  const totalScore =
    contributions.CRITICAL +
    contributions.HIGH +
    contributions.MEDIUM +
    cappedLowContribution;

  // Ensure the max severity issue's base score is reflected
  // This prevents low-confidence CRITICAL being overshadowed by many LOW issues
  const maxSeverityBaseScore = SEVERITY_WEIGHTS[maxSeverity];
  const effectiveScore = Math.max(totalScore, maxSeverityBaseScore * maxSeverityConfidence);

  // Cap at 100
  const score = Math.min(100, Math.round(effectiveScore));

  // Determine overall severity
  // Key principle: CRITICAL issues ALWAYS result in CRITICAL overall
  // Even low-confidence CRITICAL should not be downgraded
  let overallSeverity: RiskSeverity;

  if (maxSeverity === 'CRITICAL') {
    // CRITICAL always stays CRITICAL - security principle
    overallSeverity = 'CRITICAL';
  } else if (maxSeverity === 'HIGH' || score >= 60) {
    overallSeverity = 'HIGH';
  } else if (maxSeverity === 'MEDIUM' || score >= 30) {
    overallSeverity = 'MEDIUM';
  } else {
    overallSeverity = 'LOW';
  }

  return { score, severity: overallSeverity };
}

/**
 * Deduplicate issues by pattern ID, keeping highest confidence
 */
export function deduplicateIssues(issues: DetectedIssue[]): DetectedIssue[] {
  const seen = new Map<string, DetectedIssue>();

  for (const issue of issues) {
    const existing = seen.get(issue.patternId);
    if (!existing || issue.confidence > existing.confidence) {
      seen.set(issue.patternId, issue);
    }
  }

  return Array.from(seen.values());
}

/**
 * Main entry point: analyze transaction and return issues
 */
export function analyzeWithPatterns(data: AnalysisData): {
  issues: DetectedIssue[];
  score: number;
  severity: RiskSeverity;
  patternResults: PatternMatchResult[];
} {
  // Run pattern matching
  const patternResults = runPatternMatching(data);

  // Convert to issues
  let issues = convertToIssues(patternResults);

  // Deduplicate
  issues = deduplicateIssues(issues);

  // Sort by severity (CRITICAL first) using shared utility
  issues = sortBySeverity(issues);

  // Calculate overall risk
  const { score, severity } = calculateRiskScore(issues);

  return { issues, score, severity, patternResults };
}
