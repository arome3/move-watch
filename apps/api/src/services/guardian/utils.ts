/**
 * Guardian Risk Analyzer Utilities
 * Shared constants, types, and helper functions
 */

import type { RiskSeverity, GuardianAnalysisWarning, GuardianWarningType, GuardianWarningSeverity } from '@movewatch/shared';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Cache TTL in seconds (7 days - reduced from 30 days for fresher results)
 */
export const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Result TTL in days (7 days - reduced from 30 days)
 */
export const RESULT_TTL_DAYS = 7;

/**
 * Severity order for sorting (CRITICAL first)
 */
export const SEVERITY_ORDER: RiskSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * Severity weights for risk score calculation
 *
 * Design rationale:
 * - CRITICAL: Base 90, represents immediate danger (exploits, drains)
 * - HIGH: Base 60, represents significant risk (LP removal, ownership)
 * - MEDIUM: Base 30, represents moderate concern (slippage, MEV)
 * - LOW: Base 10, represents informational (pattern detected but low risk)
 */
export const SEVERITY_WEIGHTS: Record<RiskSeverity, number> = {
  LOW: 10,
  MEDIUM: 30,
  HIGH: 60,
  CRITICAL: 90,
};

/**
 * Confidence levels with documentation
 *
 * These represent how certain the detection is:
 * - VERY_HIGH (0.95): Direct function name match with supporting events
 * - HIGH (0.85): Strong pattern match with simulation data
 * - MEDIUM (0.70): Pattern match without full context
 * - LOW (0.60): Regex-only match, needs human review
 * - MINIMAL (0.50): Heuristic match, high false positive risk
 */
export const CONFIDENCE_LEVELS = {
  VERY_HIGH: 0.95,
  HIGH: 0.85,
  MEDIUM: 0.70,
  LOW: 0.60,
  MINIMAL: 0.50,
} as const;

/**
 * LLM rate limiting configuration
 */
export const LLM_RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 20,
  WINDOW_MS: 60 * 1000,
} as const;

/**
 * High-risk function patterns that always trigger LLM analysis
 * Even if pattern matching shows low complexity
 */
export const HIGH_RISK_FUNCTION_PATTERNS = [
  /admin/i,
  /owner/i,
  /upgrade/i,
  /pause/i,
  /emergency/i,
  /drain/i,
  /withdraw/i,
  /mint/i,
  /burn/i,
  /blacklist/i,
  /freeze/i,
] as const;

/**
 * Minimum complexity threshold for triggering LLM
 * Lowered from 5 to 2 to catch more edge cases
 */
export const MIN_COMPLEXITY_FOR_LLM = 2;

// ============================================================================
// SORTING UTILITIES
// ============================================================================

/**
 * Sort items by severity (CRITICAL first)
 */
export function sortBySeverity<T extends { severity: RiskSeverity }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
}

/**
 * Get severity index for comparison (lower = more severe)
 */
export function getSeverityIndex(severity: RiskSeverity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

/**
 * Compare two severities (-1 if a is more severe, 1 if b is more severe, 0 if equal)
 */
export function compareSeverity(a: RiskSeverity, b: RiskSeverity): number {
  return getSeverityIndex(a) - getSeverityIndex(b);
}

// ============================================================================
// WARNING UTILITIES
// ============================================================================

/**
 * Create a Guardian analysis warning
 */
export function createWarning(
  type: GuardianWarningType,
  message: string,
  severity: GuardianWarningSeverity = 'warning'
): GuardianAnalysisWarning {
  return { type, message, severity };
}

/**
 * Common warning messages
 */
export const WARNINGS = {
  simulationFailed: (error?: string) => createWarning(
    'simulation_failed',
    error
      ? `Simulation failed: ${error}. Analysis may be incomplete.`
      : 'Transaction simulation failed. Analysis based on static pattern matching only.',
    'warning'
  ),

  llmSkipped: () => createWarning(
    'llm_skipped',
    'AI analysis was skipped. Pattern matching only.',
    'info'
  ),

  llmError: (error?: string) => createWarning(
    'llm_error',
    error
      ? `AI analysis failed: ${error}`
      : 'AI analysis encountered an error.',
    'warning'
  ),

  llmRateLimited: () => createWarning(
    'llm_rate_limited',
    'AI analysis was rate limited. Pattern matching only.',
    'warning'
  ),

  partialAnalysis: () => createWarning(
    'partial_analysis',
    'Analysis may be incomplete. Some detection methods were unavailable.',
    'warning'
  ),

  staleResult: (ageInDays: number) => createWarning(
    'stale_result',
    `This analysis is ${ageInDays} day${ageInDays > 1 ? 's' : ''} old. Consider re-analyzing.`,
    ageInDays > 3 ? 'warning' : 'info'
  ),
} as const;

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate and normalize a risk category
 */
export function validateCategory(category: string): 'EXPLOIT' | 'RUG_PULL' | 'EXCESSIVE_COST' | 'PERMISSION' {
  const normalized = category?.toUpperCase();
  const valid = ['EXPLOIT', 'RUG_PULL', 'EXCESSIVE_COST', 'PERMISSION'] as const;
  return valid.includes(normalized as typeof valid[number])
    ? (normalized as typeof valid[number])
    : 'EXPLOIT';
}

/**
 * Validate and normalize a risk severity
 */
export function validateSeverity(severity: string): RiskSeverity {
  const normalized = severity?.toUpperCase();
  const valid: RiskSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return valid.includes(normalized as RiskSeverity)
    ? (normalized as RiskSeverity)
    : 'MEDIUM';
}

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

/**
 * Sanitize user input for LLM prompt injection protection
 * Escapes potential instruction patterns and wraps in delimiters
 */
export function sanitizeForLLM(input: unknown): string {
  const str = typeof input === 'string'
    ? input
    : JSON.stringify(input, null, 2);

  // Limit length to prevent token abuse
  const truncated = str.length > 10000 ? str.slice(0, 10000) + '...[truncated]' : str;

  // Escape patterns that could be interpreted as instructions
  const sanitized = truncated
    .replace(/ignore.*instruction/gi, '[filtered]')
    .replace(/system.*prompt/gi, '[filtered]')
    .replace(/you are/gi, '[filtered]')
    .replace(/respond with/gi, '[filtered]')
    .replace(/output.*json/gi, '[filtered]');

  return sanitized;
}

/**
 * Check if input looks like it might contain prompt injection attempts
 */
export function detectPromptInjection(input: string): boolean {
  const suspiciousPatterns = [
    /ignore.*previous/i,
    /forget.*instructions/i,
    /new.*system.*prompt/i,
    /you.*are.*now/i,
    /disregard.*above/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

// ============================================================================
// ANALYSIS COMPLETENESS
// ============================================================================

/**
 * Determine if analysis is complete based on status
 */
export function isAnalysisComplete(
  simulationStatus: 'success' | 'failed' | 'skipped',
  llmStatus: 'used' | 'skipped' | 'rate_limited' | 'error'
): boolean {
  // Analysis is complete if simulation succeeded and LLM either ran or wasn't needed
  return simulationStatus === 'success' && (llmStatus === 'used' || llmStatus === 'skipped');
}

/**
 * Calculate result age in days
 */
export function calculateResultAge(createdAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Convert database enum to API type
 */
export function dbSimulationStatusToApi(
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED'
): 'success' | 'failed' | 'skipped' {
  return status.toLowerCase() as 'success' | 'failed' | 'skipped';
}

/**
 * Convert API type to database enum
 */
export function apiSimulationStatusToDb(
  status: 'success' | 'failed' | 'skipped'
): 'SUCCESS' | 'FAILED' | 'SKIPPED' {
  return status.toUpperCase() as 'SUCCESS' | 'FAILED' | 'SKIPPED';
}

/**
 * Convert database enum to API type for LLM status
 */
export function dbLlmStatusToApi(
  status: 'USED' | 'SKIPPED' | 'RATE_LIMITED' | 'ERROR'
): 'used' | 'skipped' | 'rate_limited' | 'error' {
  return status.toLowerCase().replace('_', '_') as 'used' | 'skipped' | 'rate_limited' | 'error';
}

/**
 * Convert API type to database enum for LLM status
 */
export function apiLlmStatusToDb(
  status: 'used' | 'skipped' | 'rate_limited' | 'error'
): 'USED' | 'SKIPPED' | 'RATE_LIMITED' | 'ERROR' {
  return status.toUpperCase().replace('_', '_') as 'USED' | 'SKIPPED' | 'RATE_LIMITED' | 'ERROR';
}
