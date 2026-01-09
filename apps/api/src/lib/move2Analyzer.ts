/**
 * Move 2 Language Feature Analyzer
 *
 * Detects Move 2 language features used in modules to provide
 * educational insights and compatibility information.
 *
 * Move 2 Feature Versions:
 * - Move 2.0: Enums, receiver style, index notation, positional structs, package visibility
 * - Move 2.1: Compound assignments, loop labels, underscore wildcards
 * - Move 2.2: Optional acquires, function values, comparison operations
 * - Move 2.3: Signed integers (i8-i256), builtin constants
 */

import type { Network } from '@movewatch/shared';
import { getMovementClient } from './movement.js';
import { cacheGet, cacheSet } from './redis.js';

// Cache duration: 1 hour
const ANALYSIS_CACHE_TTL = 60 * 60;

// ============================================================================
// TYPES
// ============================================================================

export interface Move2Feature {
  id: string;
  name: string;
  version: '2.0' | '2.1' | '2.2' | '2.3';
  category: 'syntax' | 'types' | 'control_flow' | 'visibility' | 'safety';
  description: string;
  benefit: string;
  example?: string;
  learnMoreUrl?: string;
}

export interface Move2FeatureDetection {
  feature: Move2Feature;
  detected: boolean;
  occurrences: number;
  locations?: string[]; // Function names or struct names where detected
}

export interface Move2Analysis {
  moduleAddress: string;
  moduleName: string;
  network: Network;
  move2Version: '2.0' | '2.1' | '2.2' | '2.3' | 'legacy';
  featuresDetected: Move2FeatureDetection[];
  summary: {
    totalFeatures: number;
    byVersion: Record<string, number>;
    byCategory: Record<string, number>;
  };
  recommendations: Move2Recommendation[];
  compatibility: {
    aptosMainnet: boolean;
    movementMainnet: boolean;
    movementTestnet: boolean;
  };
}

export interface Move2Recommendation {
  type: 'upgrade' | 'optimization' | 'best_practice';
  title: string;
  description: string;
  feature?: string;
  priority: 'low' | 'medium' | 'high';
}

// ============================================================================
// MOVE 2 FEATURE CATALOG
// ============================================================================

export const MOVE2_FEATURES: Move2Feature[] = [
  // Move 2.0 Features
  {
    id: 'enums',
    name: 'Enums',
    version: '2.0',
    category: 'types',
    description: 'Multiple data variants in a single storable type',
    benefit: 'Enables pattern matching and more expressive data modeling',
    example: 'enum Status { Pending, Active { since: u64 }, Completed }',
    learnMoreUrl: 'https://aptos.dev/build/smart-contracts/book/move-2#enums',
  },
  {
    id: 'receiver_style',
    name: 'Receiver Style Functions',
    version: '2.0',
    category: 'syntax',
    description: 'Call functions with dot notation (value.func())',
    benefit: 'More readable, chainable method calls',
    example: 'coin.value() instead of coin::value(&coin)',
    learnMoreUrl: 'https://aptos.dev/build/smart-contracts/book/move-2#receiver-style',
  },
  {
    id: 'index_notation',
    name: 'Index Notation',
    version: '2.0',
    category: 'syntax',
    description: 'Access vector elements with bracket syntax',
    benefit: 'Familiar array-like access pattern',
    example: 'vector[0] instead of vector::borrow(&vector, 0)',
  },
  {
    id: 'positional_structs',
    name: 'Positional Structs',
    version: '2.0',
    category: 'types',
    description: 'Define wrapper types with positional fields',
    benefit: 'Cleaner newtype patterns and tuple-like structs',
    example: 'struct Wrapped(u64)',
  },
  {
    id: 'package_visibility',
    name: 'Package Visibility',
    version: '2.0',
    category: 'visibility',
    description: 'Functions visible within package via public(package)',
    benefit: 'Better encapsulation between modules',
    example: 'public(package) fun internal_helper()',
  },
  {
    id: 'dot_dot_patterns',
    name: 'Dot-Dot Patterns',
    version: '2.0',
    category: 'syntax',
    description: 'Selectively match struct fields',
    benefit: 'Ignore irrelevant fields in destructuring',
    example: 'let Struct { x, .. } = value',
  },

  // Move 2.1 Features
  {
    id: 'compound_assignments',
    name: 'Compound Assignments',
    version: '2.1',
    category: 'syntax',
    description: 'Shorthand operators (+=, -=, *=, etc.)',
    benefit: 'Cleaner arithmetic updates',
    example: 'balance += amount',
  },
  {
    id: 'loop_labels',
    name: 'Loop Labels',
    version: '2.1',
    category: 'control_flow',
    description: 'Named loops for break/continue from nested contexts',
    benefit: 'Control complex nested loop logic',
    example: "'outer: loop { loop { break 'outer } }",
  },
  {
    id: 'underscore_wildcard',
    name: 'Underscore Wildcards',
    version: '2.1',
    category: 'syntax',
    description: 'True wildcard parameters that do not bind values',
    benefit: 'Cleaner unused parameter handling',
    example: 'fun process(_, value: u64)',
  },

  // Move 2.2 Features
  {
    id: 'optional_acquires',
    name: 'Optional Acquires',
    version: '2.2',
    category: 'safety',
    description: 'Compiler infers resource access annotations',
    benefit: 'Less boilerplate, automatic safety checks',
    example: 'Omit `acquires` clause when compiler can infer',
  },
  {
    id: 'function_values',
    name: 'Function Values',
    version: '2.2',
    category: 'types',
    description: 'Functions as first-class values',
    benefit: 'Higher-order functions, callbacks, strategy patterns',
    example: 'let handler: |u64| -> bool = my_predicate',
  },
  {
    id: 'comparison_operations',
    name: 'Universal Comparisons',
    version: '2.2',
    category: 'types',
    description: 'All types support <, >, <=, >= comparisons',
    benefit: 'Generic sorting and ordering operations',
    example: 'if (struct_a < struct_b) { ... }',
  },

  // Move 2.3 Features
  {
    id: 'signed_integers',
    name: 'Signed Integers',
    version: '2.3',
    category: 'types',
    description: 'Native signed integer types (i8, i16, i32, i64, i128, i256)',
    benefit: 'Native negative number support without custom libraries',
    example: 'let delta: i64 = -100',
  },
  {
    id: 'builtin_constants',
    name: 'Builtin Constants',
    version: '2.3',
    category: 'types',
    description: 'Min/max values for integer types',
    benefit: 'Safe bounds checking without magic numbers',
    example: 'U64_MAX, I128_MIN',
  },
];

// ============================================================================
// DETECTION LOGIC
// ============================================================================

interface ModuleABI {
  address: string;
  name: string;
  exposed_functions: Array<{
    name: string;
    visibility: string;
    is_entry: boolean;
    is_view: boolean;
    generic_type_params: Array<{ constraints: string[] }>;
    params: string[];
    return: string[];
  }>;
  structs: Array<{
    name: string;
    is_native: boolean;
    abilities: string[];
    generic_type_params: Array<{ constraints: string[]; is_phantom: boolean }>;
    fields: Array<{ name: string; type: string }>;
  }>;
}

/**
 * Analyze a module for Move 2 features
 */
export async function analyzeMove2Features(
  network: Network,
  moduleAddress: string,
  moduleName: string
): Promise<Move2Analysis | null> {
  const cacheKey = `move2:${network}:${moduleAddress}:${moduleName}`;

  // Check cache
  const cached = await cacheGet<Move2Analysis>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const client = getMovementClient(network);
    const module = await client.getAccountModule({
      accountAddress: moduleAddress,
      moduleName: moduleName,
    });

    if (!module || !module.abi) {
      return null;
    }

    const abi = module.abi as unknown as ModuleABI;
    const detections = detectFeatures(abi);

    // Determine highest Move 2 version used
    const move2Version = determineMove2Version(detections);

    // Generate recommendations
    const recommendations = generateRecommendations(detections, abi);

    // Build summary
    const summary = buildSummary(detections);

    const analysis: Move2Analysis = {
      moduleAddress,
      moduleName,
      network,
      move2Version,
      featuresDetected: detections,
      summary,
      recommendations,
      compatibility: {
        aptosMainnet: true, // Move 2 is supported on Aptos mainnet
        movementMainnet: true, // Movement supports Move 2
        movementTestnet: true,
      },
    };

    // Cache the result
    await cacheSet(cacheKey, analysis, ANALYSIS_CACHE_TTL);

    return analysis;
  } catch (error) {
    console.error(`[Move2Analyzer] Failed to analyze ${moduleAddress}::${moduleName}:`, error);
    return null;
  }
}

/**
 * Detect Move 2 features from module ABI
 */
function detectFeatures(abi: ModuleABI): Move2FeatureDetection[] {
  return MOVE2_FEATURES.map((feature) => {
    const detection = detectFeature(feature, abi);
    return {
      feature,
      detected: detection.detected,
      occurrences: detection.occurrences,
      locations: detection.locations,
    };
  });
}

/**
 * Detect a specific feature in the ABI
 */
function detectFeature(
  feature: Move2Feature,
  abi: ModuleABI
): { detected: boolean; occurrences: number; locations: string[] } {
  const locations: string[] = [];
  let occurrences = 0;

  switch (feature.id) {
    case 'signed_integers': {
      // Check for signed integer types in params and returns
      const signedTypes = ['i8', 'i16', 'i32', 'i64', 'i128', 'i256'];
      for (const fn of abi.exposed_functions) {
        const hasSignedParams = fn.params.some((p) =>
          signedTypes.some((t) => p.includes(t))
        );
        const hasSignedReturns = fn.return.some((r) =>
          signedTypes.some((t) => r.includes(t))
        );
        if (hasSignedParams || hasSignedReturns) {
          locations.push(fn.name);
          occurrences++;
        }
      }
      // Check struct fields
      for (const struct of abi.structs) {
        const hasSignedFields = struct.fields.some((f) =>
          signedTypes.some((t) => f.type.includes(t))
        );
        if (hasSignedFields) {
          locations.push(`struct ${struct.name}`);
          occurrences++;
        }
      }
      break;
    }

    case 'package_visibility': {
      // Check for public(package) visibility (shown as 'friend' in ABI)
      for (const fn of abi.exposed_functions) {
        if (fn.visibility === 'friend') {
          locations.push(fn.name);
          occurrences++;
        }
      }
      break;
    }

    case 'function_values': {
      // Check for function type parameters (|T| -> U patterns)
      for (const fn of abi.exposed_functions) {
        const hasFunctionParams = fn.params.some(
          (p) => p.includes('|') || p.includes('Fun<')
        );
        if (hasFunctionParams) {
          locations.push(fn.name);
          occurrences++;
        }
      }
      break;
    }

    case 'enums': {
      // Enums appear as structs with specific patterns in newer ABIs
      // Detection is limited without bytecode analysis
      // For now, check for common enum naming patterns
      for (const struct of abi.structs) {
        if (
          struct.name.includes('Variant') ||
          struct.abilities.includes('copy') && struct.abilities.includes('drop')
        ) {
          // Could be an enum variant - mark as potential
          // This is heuristic-based without full bytecode analysis
        }
      }
      break;
    }

    case 'positional_structs': {
      // Check for structs with numeric field names (0, 1, 2...)
      for (const struct of abi.structs) {
        const hasPositionalFields = struct.fields.some((f) => /^\d+$/.test(f.name));
        if (hasPositionalFields) {
          locations.push(`struct ${struct.name}`);
          occurrences++;
        }
      }
      break;
    }

    // Features that require bytecode/source analysis (not detectable from ABI alone)
    case 'receiver_style':
    case 'index_notation':
    case 'dot_dot_patterns':
    case 'compound_assignments':
    case 'loop_labels':
    case 'underscore_wildcard':
    case 'optional_acquires':
    case 'comparison_operations':
    case 'builtin_constants': {
      // These features are syntax-level and not visible in the ABI
      // They would require source code or bytecode analysis
      // Mark as unknown/not detectable
      break;
    }
  }

  return {
    detected: occurrences > 0,
    occurrences,
    locations,
  };
}

/**
 * Determine the highest Move 2 version used
 */
function determineMove2Version(
  detections: Move2FeatureDetection[]
): Move2Analysis['move2Version'] {
  const versions = detections
    .filter((d) => d.detected)
    .map((d) => d.feature.version);

  if (versions.includes('2.3')) return '2.3';
  if (versions.includes('2.2')) return '2.2';
  if (versions.includes('2.1')) return '2.1';
  if (versions.includes('2.0')) return '2.0';
  return 'legacy';
}

/**
 * Generate recommendations based on detected features
 */
function generateRecommendations(
  detections: Move2FeatureDetection[],
  abi: ModuleABI
): Move2Recommendation[] {
  const recommendations: Move2Recommendation[] = [];
  const detectedFeatureIds = new Set(
    detections.filter((d) => d.detected).map((d) => d.feature.id)
  );

  // Recommend signed integers if doing arithmetic
  if (!detectedFeatureIds.has('signed_integers')) {
    const hasArithmetic = abi.exposed_functions.some(
      (fn) =>
        fn.name.includes('subtract') ||
        fn.name.includes('diff') ||
        fn.name.includes('delta') ||
        fn.name.includes('change')
    );
    if (hasArithmetic) {
      recommendations.push({
        type: 'upgrade',
        title: 'Consider Signed Integers',
        description:
          'Your module appears to do arithmetic that might benefit from signed integers (i64, i128) instead of unsigned types.',
        feature: 'signed_integers',
        priority: 'medium',
      });
    }
  }

  // Recommend package visibility for internal helpers
  const publicNonEntryFunctions = abi.exposed_functions.filter(
    (fn) => fn.visibility === 'public' && !fn.is_entry && !fn.is_view
  );
  if (publicNonEntryFunctions.length > 3 && !detectedFeatureIds.has('package_visibility')) {
    recommendations.push({
      type: 'best_practice',
      title: 'Use Package Visibility',
      description: `You have ${publicNonEntryFunctions.length} public helper functions. Consider using public(package) for internal-only functions.`,
      feature: 'package_visibility',
      priority: 'low',
    });
  }

  // Recommend function values for callbacks
  const hasCallbackPattern = abi.exposed_functions.some(
    (fn) =>
      fn.name.includes('callback') ||
      fn.name.includes('handler') ||
      fn.name.includes('on_')
  );
  if (hasCallbackPattern && !detectedFeatureIds.has('function_values')) {
    recommendations.push({
      type: 'upgrade',
      title: 'Consider Function Values',
      description:
        'Your module uses callback patterns. Move 2.2 function values enable cleaner higher-order function design.',
      feature: 'function_values',
      priority: 'medium',
    });
  }

  return recommendations;
}

/**
 * Build summary statistics
 */
function buildSummary(detections: Move2FeatureDetection[]): Move2Analysis['summary'] {
  const detected = detections.filter((d) => d.detected);

  const byVersion: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const d of detected) {
    byVersion[d.feature.version] = (byVersion[d.feature.version] || 0) + 1;
    byCategory[d.feature.category] = (byCategory[d.feature.category] || 0) + 1;
  }

  return {
    totalFeatures: detected.length,
    byVersion,
    byCategory,
  };
}

/**
 * Analyze a function path for Move 2 features
 * Quick analysis based on function signature
 */
export function analyzeFunction(
  functionPath: string,
  typeArguments: string[],
  args: unknown[]
): { features: string[]; notes: string[] } {
  const features: string[] = [];
  const notes: string[] = [];

  // Check for signed integers in type arguments
  const signedTypes = ['i8', 'i16', 'i32', 'i64', 'i128', 'i256'];
  for (const typeArg of typeArguments) {
    if (signedTypes.some((t) => typeArg.includes(t))) {
      features.push('signed_integers');
      notes.push(`Uses Move 2.3 signed integer type: ${typeArg}`);
    }
  }

  // Check for known Move 2 stdlib patterns
  if (functionPath.includes('::option::')) {
    notes.push('Uses Option type (standard library)');
  }
  if (functionPath.includes('::smart_vector::')) {
    notes.push('Uses SmartVector (optimized for large collections)');
  }
  if (functionPath.includes('::smart_table::')) {
    notes.push('Uses SmartTable (optimized for large maps)');
  }

  return { features, notes };
}

/**
 * Get all Move 2 features as a catalog
 */
export function getFeatureCatalog(): Move2Feature[] {
  return MOVE2_FEATURES;
}

/**
 * Get features by version
 */
export function getFeaturesByVersion(version: Move2Feature['version']): Move2Feature[] {
  return MOVE2_FEATURES.filter((f) => f.version === version);
}
