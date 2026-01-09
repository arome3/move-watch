import type { RiskPatternDefinition } from '../types.js';
import { EXPLOIT_PATTERNS } from './exploitPatterns.js';
import { RUG_PULL_PATTERNS } from './rugPullPatterns.js';
import { COST_PATTERNS } from './costPatterns.js';
import { PERMISSION_PATTERNS } from './permissionPatterns.js';
import { ADVANCED_PATTERNS } from './advancedPatterns.js';

/**
 * Pattern Registry
 * Combines all patterns from all categories
 */

// All patterns combined
export const ALL_PATTERNS: RiskPatternDefinition[] = [
  ...EXPLOIT_PATTERNS,
  ...RUG_PULL_PATTERNS,
  ...COST_PATTERNS,
  ...PERMISSION_PATTERNS,
  ...ADVANCED_PATTERNS,
];

// Pattern lookup map for quick access by ID
export const PATTERN_MAP: Map<string, RiskPatternDefinition> = new Map(
  ALL_PATTERNS.map((p) => [p.id, p])
);

// Get patterns by category
export function getPatternsByCategory(
  category: 'EXPLOIT' | 'RUG_PULL' | 'EXCESSIVE_COST' | 'PERMISSION'
): RiskPatternDefinition[] {
  return ALL_PATTERNS.filter((p) => p.category === category);
}

// Get pattern by ID
export function getPatternById(id: string): RiskPatternDefinition | undefined {
  return PATTERN_MAP.get(id);
}

// Get pattern summary for API response
export function getPatternSummary(): Array<{
  id: string;
  category: string;
  severity: string;
  name: string;
  description: string;
}> {
  return ALL_PATTERNS.map((p) => ({
    id: p.id,
    category: p.category,
    severity: p.severity,
    name: p.name,
    description: p.description,
  }));
}

// Pattern statistics
export const PATTERN_STATS = {
  total: ALL_PATTERNS.length,
  byCategory: {
    EXPLOIT: ALL_PATTERNS.filter((p) => p.category === 'EXPLOIT').length,
    RUG_PULL: ALL_PATTERNS.filter((p) => p.category === 'RUG_PULL').length,
    EXCESSIVE_COST: ALL_PATTERNS.filter((p) => p.category === 'EXCESSIVE_COST').length,
    PERMISSION: ALL_PATTERNS.filter((p) => p.category === 'PERMISSION').length,
  },
  bySeverity: {
    LOW: ALL_PATTERNS.filter((p) => p.severity === 'LOW').length,
    MEDIUM: ALL_PATTERNS.filter((p) => p.severity === 'MEDIUM').length,
    HIGH: ALL_PATTERNS.filter((p) => p.severity === 'HIGH').length,
    CRITICAL: ALL_PATTERNS.filter((p) => p.severity === 'CRITICAL').length,
  },
};

// Export individual pattern collections
export {
  EXPLOIT_PATTERNS,
  RUG_PULL_PATTERNS,
  COST_PATTERNS,
  PERMISSION_PATTERNS,
  ADVANCED_PATTERNS,
};
