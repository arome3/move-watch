/**
 * Move Prover Integration Service
 *
 * ============================================================================
 * HONEST LIMITATIONS - PLEASE READ
 * ============================================================================
 *
 * What this module DOES:
 * - Checks if Move Prover CLI is installed locally
 * - Looks for spec annotations in source code (if available)
 * - Generates RECOMMENDATIONS for formal verification
 *
 * What this module DOES NOT DO:
 * - Actually run the Move Prover (requires source code + time)
 * - Mathematically prove anything about the contract
 * - Guarantee absence of vulnerabilities
 * - Replace professional security audits
 *
 * WHY:
 * Real formal verification with Move Prover requires:
 * 1. Access to source code (we often only have bytecode)
 * 2. Specification annotations written by developers
 * 3. Minutes to hours of computation time
 * 4. Expert review of verification results
 *
 * Example: Liquidswap's formal verification by MoveBit took weeks.
 * See: https://pontem.network/posts/liquidswap-passes-formal-verification-by-movebit
 *
 * This service is INFORMATIONAL ONLY - it tells users formal verification
 * exists and is recommended, but does not provide actual verification.
 *
 * ============================================================================
 *
 * What Move Prover Can Verify (when properly run):
 * - Arithmetic overflow/underflow safety
 * - Resource safety (no duplication, no loss)
 * - Access control invariants
 * - Custom specification assertions
 *
 * Requirements (for full functionality):
 * - Move Prover binary (part of Aptos CLI)
 * - Boogie verifier
 * - Z3 SMT solver
 * - SOURCE CODE with spec annotations
 *
 * References:
 * - Move Prover docs: https://aptos.dev/move/prover/move-prover
 * - Move Specification Language: https://aptos.dev/move/prover/spec-lang
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { RiskSeverity, RiskCategory, Network } from '@movewatch/shared';
import type { DetectedIssue } from './types.js';
import { CONFIDENCE_LEVELS } from './utils.js';

const execAsync = promisify(exec);

// Move Prover availability status
export interface MoveProverStatus {
  available: boolean;
  version?: string;
  error?: string;
  recommendation: string;
}

// Formal verification result
export interface FormalVerificationResult {
  proverAvailable: boolean;
  specAnnotationsFound: boolean;
  verificationType: 'full' | 'spec_only' | 'none';
  issues: DetectedIssue[];
  recommendations: string[];
  metadata: {
    hasInvariants: boolean;
    hasRequires: boolean;
    hasEnsures: boolean;
    hasAborts: boolean;
    specCoverage: 'full' | 'partial' | 'none';
  };
}

// Known spec patterns in Move modules
const SPEC_PATTERNS = {
  invariant: /spec\s+\w+\s*\{[^}]*invariant/,
  requires: /requires\s+/,
  ensures: /ensures\s+/,
  aborts_if: /aborts_if\s+/,
  modifies: /modifies\s+/,
  emits: /emits\s+/,
  pragma: /pragma\s+(opaque|verify|intrinsic)/,
};

// Common vulnerability patterns that Move Prover can catch
const PROVER_CATCHABLE_VULNERABILITIES = [
  {
    id: 'prover:arithmetic_overflow',
    name: 'Arithmetic Overflow',
    description: 'Move Prover can prove absence of integer overflow/underflow',
    severity: 'HIGH' as RiskSeverity,
  },
  {
    id: 'prover:resource_leak',
    name: 'Resource Leak',
    description: 'Move Prover can verify resources are not lost or duplicated',
    severity: 'CRITICAL' as RiskSeverity,
  },
  {
    id: 'prover:access_control',
    name: 'Access Control Violation',
    description: 'Move Prover can verify signer requirements are enforced',
    severity: 'CRITICAL' as RiskSeverity,
  },
  {
    id: 'prover:invariant_violation',
    name: 'Invariant Violation',
    description: 'Move Prover can verify state invariants are maintained',
    severity: 'HIGH' as RiskSeverity,
  },
];

/**
 * Check if Move Prover is available on the system
 */
export async function checkMoveProverAvailability(): Promise<MoveProverStatus> {
  try {
    // Try to run the Move Prover via Aptos CLI
    const { stdout } = await execAsync('aptos move prove --help', {
      timeout: 5000,
    });

    if (stdout.includes('prove')) {
      // Try to get version
      try {
        const versionResult = await execAsync('aptos --version', { timeout: 5000 });
        const version = versionResult.stdout.trim();

        return {
          available: true,
          version,
          recommendation: 'Move Prover is available. Consider running formal verification on critical contracts.',
        };
      } catch {
        return {
          available: true,
          recommendation: 'Move Prover is available but version could not be determined.',
        };
      }
    }

    return {
      available: false,
      error: 'Move Prover command not found in Aptos CLI',
      recommendation: 'Install Aptos CLI with Move Prover support for formal verification.',
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      recommendation: 'Move Prover is not available. Install Aptos CLI and boogie/z3 dependencies for formal verification.',
    };
  }
}

/**
 * Analyze module ABI for specification annotations
 * This doesn't require the prover - just checks if specs exist
 */
export function analyzeSpecAnnotations(moduleSource?: string): {
  hasSpecs: boolean;
  specTypes: string[];
  coverage: 'full' | 'partial' | 'none';
} {
  if (!moduleSource) {
    return {
      hasSpecs: false,
      specTypes: [],
      coverage: 'none',
    };
  }

  const foundSpecs: string[] = [];

  for (const [specType, pattern] of Object.entries(SPEC_PATTERNS)) {
    if (pattern.test(moduleSource)) {
      foundSpecs.push(specType);
    }
  }

  let coverage: 'full' | 'partial' | 'none' = 'none';
  if (foundSpecs.length >= 4) {
    coverage = 'full';
  } else if (foundSpecs.length > 0) {
    coverage = 'partial';
  }

  return {
    hasSpecs: foundSpecs.length > 0,
    specTypes: foundSpecs,
    coverage,
  };
}

/**
 * Generate formal verification recommendations based on module analysis
 */
export function generateFormalVerificationRecommendations(
  moduleAddress: string,
  moduleName: string,
  hasSpecs: boolean,
  isHighValue: boolean
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  // HONEST: We're just checking for specs, not running verification
  if (!hasSpecs) {
    issues.push({
      patternId: 'prover:no_specs',
      category: 'PERMISSION',
      severity: 'LOW', // Changed from HIGH - this is just a recommendation
      title: '[INFO] No Formal Specifications Detected',
      description: `The module ${moduleAddress}::${moduleName} does not appear to have Move Prover specifications. ` +
        `NOTE: We did NOT run formal verification - we only checked if spec annotations exist. ` +
        `Real formal verification requires source code, spec annotations, and significant computation time.`,
      recommendation: 'For production contracts handling significant value, consider professional formal verification. ' +
        'Example: Liquidswap\'s MoveBit verification took weeks.',
      confidence: CONFIDENCE_LEVELS.MEDIUM, // Lower confidence - we didn't verify anything
      source: 'pattern' as const,
      evidence: {
        moduleAddress,
        moduleName,
        hasSpecs: false,
        disclaimer: 'This is a RECOMMENDATION, not a verification result',
        whatWeChecked: 'Presence of spec annotations only',
        whatWeDidNot: 'Run Move Prover, analyze bytecode, verify properties',
      },
    });
  }

  // Informational only - make it clear this is not verification
  if (!hasSpecs && isHighValue) {
    issues.push({
      patternId: 'prover:info_only',
      category: 'PERMISSION',
      severity: 'LOW',
      title: '[INFO] Formal Verification Recommended for High-Value Contracts',
      description: 'Move Prover CAN mathematically verify: arithmetic safety, resource safety, access control. ' +
        'However, THIS TOOL DID NOT RUN THE PROVER. This is informational only.',
      recommendation: 'Consider: (1) Professional audit firms like MoveBit, OtterSec, Halborn ' +
        '(2) Running Move Prover locally with source code (3) Bug bounty programs',
      confidence: CONFIDENCE_LEVELS.LOW, // Very low - this is just info
      source: 'pattern' as const,
      evidence: {
        catchableVulnerabilities: PROVER_CATCHABLE_VULNERABILITIES.map(v => v.name),
        disclaimer: 'INFORMATIONAL ONLY - NO VERIFICATION PERFORMED',
        proverNotRun: true,
        sourceCodeRequired: true,
        estimatedVerificationTime: 'Hours to weeks depending on complexity',
      },
    });
  }

  return issues;
}

/**
 * Main formal verification analysis function
 *
 * This performs what analysis is possible without running the full prover:
 * 1. Check if prover is available
 * 2. Check for spec annotations
 * 3. Generate recommendations
 */
export async function analyzeFormalVerification(
  moduleAddress: string,
  moduleName: string,
  moduleSource?: string,
  isHighValue: boolean = true
): Promise<FormalVerificationResult> {
  // Check prover availability
  const proverStatus = await checkMoveProverAvailability();

  // Check for spec annotations
  const specAnalysis = analyzeSpecAnnotations(moduleSource);

  // Generate issues and recommendations
  const issues = generateFormalVerificationRecommendations(
    moduleAddress,
    moduleName,
    specAnalysis.hasSpecs,
    isHighValue
  );

  const recommendations: string[] = [];

  if (!proverStatus.available) {
    recommendations.push('Install Aptos CLI with Move Prover for full formal verification');
    recommendations.push('Dependencies: Boogie verifier, Z3 SMT solver');
  }

  if (!specAnalysis.hasSpecs) {
    recommendations.push('Add Move specification annotations to the source code');
    recommendations.push('Key specs: invariant, requires, ensures, aborts_if');
  }

  if (specAnalysis.hasSpecs && proverStatus.available) {
    recommendations.push('Run `aptos move prove` to verify specifications');
    recommendations.push('Check for verification errors and warnings');
  }

  // Determine verification type
  let verificationType: 'full' | 'spec_only' | 'none' = 'none';
  if (proverStatus.available && specAnalysis.hasSpecs) {
    verificationType = 'full';
  } else if (specAnalysis.hasSpecs) {
    verificationType = 'spec_only';
  }

  return {
    proverAvailable: proverStatus.available,
    specAnnotationsFound: specAnalysis.hasSpecs,
    verificationType,
    issues,
    recommendations,
    metadata: {
      hasInvariants: specAnalysis.specTypes.includes('invariant'),
      hasRequires: specAnalysis.specTypes.includes('requires'),
      hasEnsures: specAnalysis.specTypes.includes('ensures'),
      hasAborts: specAnalysis.specTypes.includes('aborts_if'),
      specCoverage: specAnalysis.coverage,
    },
  };
}

/**
 * Get information about Move Prover capabilities
 */
export function getMoveProverInfo(): {
  name: string;
  description: string;
  capabilities: string[];
  requirements: string[];
  resources: { name: string; url: string }[];
} {
  return {
    name: 'Move Prover',
    description: 'Formal verification tool that mathematically proves properties about Move smart contracts.',
    capabilities: [
      'Arithmetic safety (overflow/underflow prevention)',
      'Resource safety (no duplication or loss)',
      'Access control verification (signer requirements)',
      'Custom invariant checking',
      'Abort condition verification',
      'State modification tracking',
    ],
    requirements: [
      'Aptos CLI with Move Prover support',
      'Boogie intermediate verification language',
      'Z3 SMT solver',
      'Move source code with spec annotations',
    ],
    resources: [
      { name: 'Move Prover Documentation', url: 'https://aptos.dev/move/prover/move-prover' },
      { name: 'Specification Language Guide', url: 'https://aptos.dev/move/prover/spec-lang' },
      { name: 'Prover User Guide', url: 'https://aptos.dev/move/prover/prover-guide' },
    ],
  };
}

export { PROVER_CATCHABLE_VULNERABILITIES };
