import type {
  RiskCategory,
  RiskSeverity,
  StateChange,
  SimulationEvent,
} from '@movewatch/shared';

/**
 * Internal types for Guardian pattern matching engine
 */

// Pattern match result from a single pattern
export interface PatternMatchResult {
  matched: boolean;
  patternId: string;
  category: RiskCategory;
  severity: RiskSeverity;
  confidence: number;
  evidence?: Record<string, unknown>;
}

// Analysis data passed to pattern matchers
export interface AnalysisData {
  functionName: string;
  moduleAddress: string;
  moduleName: string;
  functionBaseName: string;
  typeArguments: string[];
  arguments: unknown[];
  sender?: string;
  simulationResult?: {
    success: boolean;
    gasUsed?: number;
    stateChanges?: StateChange[];
    events?: SimulationEvent[];
    error?: unknown;
  };
}

// Pattern criteria for matching
export interface PatternCriteria {
  // Function name patterns (regex)
  functionPatterns?: RegExp[];
  // Module address patterns (regex)
  modulePatterns?: RegExp[];
  // Event type patterns
  eventPatterns?: Array<{
    type: RegExp;
    required?: boolean;
  }>;
  // Argument patterns
  argumentPatterns?: Array<{
    index?: number | 'any';
    name?: string;
    pattern: (value: unknown, allArgs: unknown[]) => boolean;
  }>;
  // State change patterns
  stateChangePatterns?: Array<{
    resourcePattern?: RegExp;
    type?: 'create' | 'modify' | 'delete';
  }>;
  // Gas threshold
  gasThreshold?: {
    min?: number;
    max?: number;
  };
  // Custom matcher function for complex logic
  customMatcher?: (data: AnalysisData) => PatternMatchResult | null;
}

// Risk pattern definition
export interface RiskPatternDefinition {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  name: string;
  description: string;
  matchCriteria: PatternCriteria;
  issueTemplate: {
    title: string;
    description: string;
    recommendation: string;
  };
}

// Issue generated from pattern match
export interface DetectedIssue {
  patternId: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  description: string;
  recommendation: string;
  evidence?: Record<string, unknown>;
  confidence: number;
  source: 'pattern' | 'llm';
}

// LLM analysis request
export interface LLMAnalysisRequest {
  functionName: string;
  moduleAddress: string;
  typeArguments: string[];
  arguments: unknown[];
  stateChanges?: StateChange[];
  events?: SimulationEvent[];
  patternResults: PatternMatchResult[];
  gasUsed?: number;
}

// LLM analysis response
export interface LLMAnalysisResponse {
  additionalIssues: DetectedIssue[];
  riskAssessment: string;
  confidence: number;
  reasoning: string;
}
