/**
 * Semantic Similarity Matcher
 *
 * Uses AI embeddings to match transactions against known exploit patterns.
 * Unlike regex patterns, this can detect renamed/obfuscated versions of known attacks.
 *
 * Approach based on SmartGuard (95% F1):
 * - Extract semantic features from transaction
 * - Compare against known exploit "signatures"
 * - Use LLM for semantic similarity scoring
 *
 * This catches attacks where:
 * - Function names are changed (drain → safe_transfer)
 * - Logic is slightly modified
 * - Code is obfuscated
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { z } from 'zod';
import type { DetectedIssue } from './types.js';
import type { StateChange, SimulationEvent, RiskSeverity } from '@movewatch/shared';
import { validateCategory, validateSeverity } from './utils.js';

// ============================================================================
// Configuration
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const SIMILARITY_MODEL = 'claude-3-5-haiku-latest'; // Fast for batch comparisons

// ============================================================================
// Known Exploit Signatures (Semantic Descriptions)
// ============================================================================

/**
 * These are SEMANTIC descriptions of exploit patterns, not code patterns.
 * The LLM will match based on meaning, not syntax.
 */
export const EXPLOIT_SIGNATURES = [
  // -------------------------------------------------------------------------
  // Flash Loan Attacks
  // -------------------------------------------------------------------------
  {
    id: 'flash-loan-oracle-manipulation',
    category: 'EXPLOIT',
    severity: 'CRITICAL' as RiskSeverity,
    semanticDescription: `
      A transaction that borrows a large amount of tokens without collateral,
      then manipulates a price oracle or AMM pool price, performs trades or
      liquidations at the manipulated price, and repays the loan - all atomically.
      The attacker profits from the price difference.
    `,
    indicators: [
      'Large token borrow with no collateral',
      'Price or oracle update in same transaction',
      'Swap or trade at unusual price',
      'Loan repayment at end',
    ],
    realExample: 'Mango Markets $100M exploit - manipulated MNGO price via flash loan',
  },
  {
    id: 'flash-loan-arbitrage',
    category: 'EXPLOIT',
    severity: 'HIGH' as RiskSeverity,
    semanticDescription: `
      A transaction that exploits price differences between pools or protocols
      by borrowing tokens, trading across multiple venues at different prices,
      and repaying with profit. May be legitimate arbitrage or exploit.
    `,
    indicators: [
      'Multiple swap operations',
      'Same token traded multiple times',
      'Price discrepancy between swaps',
      'Net profit to caller',
    ],
    realExample: 'Various DEX arbitrage operations',
  },

  // -------------------------------------------------------------------------
  // Rug Pull Patterns
  // -------------------------------------------------------------------------
  {
    id: 'liquidity-removal-rug',
    category: 'RUG_PULL',
    severity: 'CRITICAL' as RiskSeverity,
    semanticDescription: `
      A transaction where a privileged party (owner, admin) removes all or most
      liquidity from a pool, leaving other users' tokens worthless. Often happens
      after building up liquidity from users.
    `,
    indicators: [
      'Large LP token burn or withdrawal',
      'Caller is admin/owner or has special privileges',
      'Pool balance drops significantly',
      'Affects user funds not owned by caller',
    ],
    realExample: 'Countless DeFi rug pulls where devs drain LP',
  },
  {
    id: 'ownership-transfer-backdoor',
    category: 'RUG_PULL',
    severity: 'HIGH' as RiskSeverity,
    semanticDescription: `
      A transaction that transfers ownership or admin privileges to a new address,
      potentially setting up for future malicious actions. Suspicious if transferred
      to unknown address or EOA without multisig.
    `,
    indicators: [
      'Admin or owner role transferred',
      'New owner is unknown address',
      'No timelock or governance',
      'Happens shortly after launch',
    ],
    realExample: 'Pre-rug ownership transfers',
  },
  {
    id: 'hidden-mint-function',
    category: 'RUG_PULL',
    severity: 'CRITICAL' as RiskSeverity,
    semanticDescription: `
      A transaction that mints new tokens to a specific address, diluting existing
      holders. May use obscured function names like "reward", "airdrop", or
      "distribute" to hide the minting.
    `,
    indicators: [
      'Total supply increases',
      'New tokens go to specific address',
      'Function name obscures minting intent',
      'No corresponding burn or payment',
    ],
    realExample: 'Honeypot tokens with hidden mint',
  },

  // -------------------------------------------------------------------------
  // Integer Overflow (Move-specific)
  // -------------------------------------------------------------------------
  {
    id: 'cetus-style-overflow',
    category: 'EXPLOIT',
    severity: 'CRITICAL' as RiskSeverity,
    semanticDescription: `
      A transaction that exploits integer overflow in shift operations or
      unchecked multiplication. The Cetus hack used checked_shlw which didn't
      actually check for overflow, allowing massive value creation from tiny inputs.
    `,
    indicators: [
      'Shift operations (<<, >>) on user input',
      'Large output from small input',
      'Use of integer-mate or similar libraries',
      'Unchecked arithmetic near MAX values',
    ],
    realExample: 'Cetus Protocol $223M hack - shift overflow in integer-mate',
  },
  {
    id: 'downcast-truncation',
    category: 'EXPLOIT',
    severity: 'HIGH' as RiskSeverity,
    semanticDescription: `
      A transaction where a larger integer type is cast to a smaller one,
      potentially truncating significant bits. Can cause amount validation
      to pass with truncated value while actual transfer uses full amount.
    `,
    indicators: [
      'Type cast from u256/u128 to u64',
      'Value exceeds target type max',
      'Validation uses different precision than execution',
      'Amount mismatch between check and effect',
    ],
    realExample: 'Various DeFi truncation vulnerabilities',
  },

  // -------------------------------------------------------------------------
  // Access Control
  // -------------------------------------------------------------------------
  {
    id: 'missing-signer-check',
    category: 'PERMISSION',
    severity: 'CRITICAL' as RiskSeverity,
    semanticDescription: `
      A transaction to a function that modifies critical state but doesn't
      properly verify the caller's identity. In Move, this means accepting
      any address parameter instead of using &signer.
    `,
    indicators: [
      'Critical state modification',
      'Address parameter instead of signer',
      'No permission check visible',
      'Can be called by anyone',
    ],
    realExample: 'Thala Labs unauthorized access',
  },
  {
    id: 'capability-leak',
    category: 'PERMISSION',
    severity: 'HIGH' as RiskSeverity,
    semanticDescription: `
      A transaction that stores or exposes a signer capability, admin capability,
      or other privileged reference in a way that could be accessed later by
      unauthorized parties.
    `,
    indicators: [
      'Capability stored in global storage',
      'Capability returned from function',
      'Capability passed to untrusted module',
      'Reference escapes its intended scope',
    ],
    realExample: 'Move capability exposure vulnerabilities',
  },

  // -------------------------------------------------------------------------
  // Oracle Manipulation
  // -------------------------------------------------------------------------
  {
    id: 'oracle-update-before-trade',
    category: 'EXPLOIT',
    severity: 'CRITICAL' as RiskSeverity,
    semanticDescription: `
      A transaction that updates a price oracle immediately before performing
      a trade that benefits from the new price. The attacker controls both
      the price update and the trade, ensuring profit.
    `,
    indicators: [
      'Price/oracle update event',
      'Trade event shortly after',
      'Same caller for both',
      'Price movement benefits caller',
    ],
    realExample: 'Various oracle manipulation attacks',
  },

  // -------------------------------------------------------------------------
  // Honeypot Patterns
  // -------------------------------------------------------------------------
  {
    id: 'buy-only-honeypot',
    category: 'RUG_PULL',
    severity: 'HIGH' as RiskSeverity,
    semanticDescription: `
      A token contract that allows buying but prevents selling through hidden
      mechanisms: blacklists, max transaction limits, pause on sell, high sell
      tax, or approval manipulation.
    `,
    indicators: [
      'Buy succeeds, sell fails',
      'Hidden blacklist check',
      'Different tax for buy vs sell',
      'Approval doesn\'t persist',
    ],
    realExample: 'Honeypot tokens on DEXes',
  },

  // -------------------------------------------------------------------------
  // Reentrancy (Move-adapted)
  // -------------------------------------------------------------------------
  {
    id: 'cross-module-reentrancy',
    category: 'EXPLOIT',
    severity: 'HIGH' as RiskSeverity,
    semanticDescription: `
      A transaction where a callback or external call allows re-entering the
      original contract before state updates complete. In Move, this can happen
      through public(friend) functions or acquires patterns.
    `,
    indicators: [
      'External call before state update',
      'Callback mechanism',
      'State read after external call',
      'Multiple entries in call trace',
    ],
    realExample: 'Cross-contract reentrancy in Move DeFi',
  },

  // -------------------------------------------------------------------------
  // Approval Exploits
  // -------------------------------------------------------------------------
  {
    id: 'unlimited-approval-drain',
    category: 'EXPLOIT',
    severity: 'HIGH' as RiskSeverity,
    semanticDescription: `
      A transaction that requests unlimited (MAX_UINT) token approval, allowing
      the approved address to drain all tokens at any time in the future.
      Especially dangerous when combined with upgradeable contracts.
    `,
    indicators: [
      'Approval amount is MAX_UINT or very large',
      'Approved address is contract not user',
      'No time limit on approval',
      'Historical drain patterns from approved address',
    ],
    realExample: 'Approval phishing attacks',
  },
];

// ============================================================================
// Semantic Matching Types
// ============================================================================

export interface SemanticMatchResult {
  signatureId: string;
  similarity: number; // 0-1
  matchedIndicators: string[];
  reasoning: string;
}

export interface SemanticAnalysisInput {
  functionName: string;
  moduleAddress: string;
  arguments: unknown[];
  stateChanges?: StateChange[];
  events?: SimulationEvent[];
  gasUsed?: number;
}

// Zod schema for LLM response validation
const SimilarityResponseSchema = z.object({
  matches: z.array(z.object({
    signatureId: z.string(),
    similarity: z.number().min(0).max(1),
    matchedIndicators: z.array(z.string()),
    reasoning: z.string(),
  })),
});

// ============================================================================
// Core Matching Functions
// ============================================================================

/**
 * Extract semantic features from a transaction for comparison
 */
function extractSemanticFeatures(input: SemanticAnalysisInput): string {
  const features: string[] = [];

  // Function semantics
  features.push(`Function: ${input.functionName}`);

  // Argument patterns
  const argsStr = JSON.stringify(input.arguments);
  if (argsStr.includes('115792089237316195423570985008687907853269984665640564039457584007913129639935')) {
    features.push('Contains MAX_UINT256 value (unlimited approval?)');
  }
  if (argsStr.match(/0x[a-fA-F0-9]{64}/)) {
    features.push('Contains full address in arguments');
  }
  if (input.arguments.some(arg => typeof arg === 'number' && arg > 1e18)) {
    features.push('Contains very large numbers');
  }

  // State change semantics
  if (input.stateChanges && input.stateChanges.length > 0) {
    const balanceChanges = input.stateChanges.filter(sc =>
      sc.resource?.includes('Coin') || sc.resource?.includes('Balance')
    );
    if (balanceChanges.length > 0) {
      features.push(`Balance changes: ${balanceChanges.length} resources affected`);
    }

    const adminChanges = input.stateChanges.filter(sc =>
      sc.resource?.includes('Admin') || sc.resource?.includes('Owner') || sc.resource?.includes('Config')
    );
    if (adminChanges.length > 0) {
      features.push(`Admin/config changes: ${adminChanges.length} resources modified`);
    }
  }

  // Event semantics
  if (input.events && input.events.length > 0) {
    const eventTypes = input.events.map(e => e.type);

    if (eventTypes.some(t => t.includes('Swap') || t.includes('Exchange'))) {
      features.push('Trade/swap event detected');
    }
    if (eventTypes.some(t => t.includes('Transfer'))) {
      features.push('Token transfer event detected');
    }
    if (eventTypes.some(t => t.includes('Price') || t.includes('Oracle'))) {
      features.push('Price/oracle event detected');
    }
    if (eventTypes.some(t => t.includes('Borrow') || t.includes('FlashLoan'))) {
      features.push('Borrowing/flash loan detected');
    }
    if (eventTypes.some(t => t.includes('Mint'))) {
      features.push('Minting event detected');
    }
    if (eventTypes.some(t => t.includes('Burn') || t.includes('Remove'))) {
      features.push('Burning/removal event detected');
    }

    // Event ordering (important for oracle manipulation)
    const priceIdx = eventTypes.findIndex(t => t.includes('Price'));
    const swapIdx = eventTypes.findIndex(t => t.includes('Swap'));
    if (priceIdx !== -1 && swapIdx !== -1 && priceIdx < swapIdx) {
      features.push('SUSPICIOUS: Price update BEFORE swap');
    }
  }

  // Gas anomalies
  if (input.gasUsed && input.gasUsed > 500000) {
    features.push(`High gas usage: ${input.gasUsed}`);
  }

  return features.join('\n');
}

/**
 * Match transaction against all known exploit signatures using LLM
 */
export async function matchExploitSignatures(
  input: SemanticAnalysisInput,
  minSimilarity: number = 0.6
): Promise<SemanticMatchResult[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return [];
  }

  const features = extractSemanticFeatures(input);

  // Build prompt with all signatures
  const signaturesText = EXPLOIT_SIGNATURES.map(sig => `
ID: ${sig.id}
Category: ${sig.category}
Severity: ${sig.severity}
Description: ${sig.semanticDescription.trim()}
Indicators: ${sig.indicators.join(', ')}
`).join('\n---\n');

  const prompt = `Compare this transaction against known exploit signatures.

## Transaction Features:
${features}

## Raw Transaction:
Function: ${input.functionName}
Module: ${input.moduleAddress}
Arguments: ${JSON.stringify(input.arguments, null, 2)}
${input.events?.length ? `Events: ${JSON.stringify(input.events.map(e => e.type))}` : ''}
${input.stateChanges?.length ? `State Changes: ${input.stateChanges.length} changes` : ''}

## Known Exploit Signatures:
${signaturesText}

## Task:
For each signature, assess similarity (0.0-1.0) based on SEMANTIC similarity, not exact matches.
A transaction doesn't need to match exactly - look for similar INTENT and BEHAVIOR.

Return JSON only:
{
  "matches": [
    {
      "signatureId": "signature-id",
      "similarity": 0.0-1.0,
      "matchedIndicators": ["indicator1", "indicator2"],
      "reasoning": "Why this matches or doesn't"
    }
  ]
}

Only include signatures with similarity >= ${minSimilarity}.`;

  try {
    const response = await anthropic.messages.create({
      model: SIMILARITY_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block): block is TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Parse response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = SimilarityResponseSchema.safeParse(parsed);

    if (!validated.success) {
      console.warn('Semantic matching validation failed:', validated.error);
      return [];
    }

    return validated.data.matches.filter(m => m.similarity >= minSimilarity);
  } catch (error) {
    console.error('Semantic matching failed:', error);
    return [];
  }
}

/**
 * Convert semantic matches to detected issues
 */
export function semanticMatchesToIssues(matches: SemanticMatchResult[]): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  for (const match of matches) {
    const signature = EXPLOIT_SIGNATURES.find(s => s.id === match.signatureId);
    if (!signature) continue;

    issues.push({
      patternId: `semantic:${match.signatureId}`,
      category: validateCategory(signature.category),
      severity: validateSeverity(signature.severity),
      title: `Semantic Match: ${formatSignatureId(match.signatureId)}`,
      description: `Transaction behavior semantically matches known exploit pattern "${match.signatureId}" with ${(match.similarity * 100).toFixed(0)}% similarity.\n\n${match.reasoning}`,
      recommendation: `Review transaction carefully. Matched indicators: ${match.matchedIndicators.join(', ')}`,
      confidence: match.similarity * 0.9, // Slightly reduce confidence for semantic matches
      source: 'llm',
      evidence: { matchedIndicators: match.matchedIndicators, similarity: match.similarity },
    });
  }

  return issues;
}

function formatSignatureId(id: string): string {
  return id
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// Quick Semantic Check (for specific patterns)
// ============================================================================

/**
 * Quick check for specific high-risk patterns without full LLM analysis
 */
export function quickSemanticCheck(input: SemanticAnalysisInput): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const funcLower = input.functionName.toLowerCase();
  const argsStr = JSON.stringify(input.arguments).toLowerCase();

  // Check for oracle manipulation pattern (price update before swap)
  if (input.events && input.events.length >= 2) {
    const eventTypes = input.events.map(e => e.type.toLowerCase());
    const priceIdx = eventTypes.findIndex(t =>
      t.includes('price') || t.includes('oracle') || t.includes('update')
    );
    const swapIdx = eventTypes.findIndex(t =>
      t.includes('swap') || t.includes('exchange') || t.includes('trade')
    );

    if (priceIdx !== -1 && swapIdx !== -1 && priceIdx < swapIdx) {
      issues.push({
        patternId: 'semantic:quick:oracle-before-swap',
        category: 'EXPLOIT',
        severity: 'HIGH',
        title: 'Potential Oracle Manipulation',
        description: 'Price/oracle update occurs BEFORE swap operation. This pattern is commonly used in oracle manipulation attacks.',
        recommendation: 'Verify price source independence and check for flash loan usage',
        confidence: 0.75,
        source: 'llm',
      });
    }
  }

  // Check for unlimited approval
  const maxUint = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
  if (argsStr.includes(maxUint) || argsStr.includes('ffffffffffffffff')) {
    issues.push({
      patternId: 'semantic:quick:unlimited-approval',
      category: 'PERMISSION',
      severity: 'MEDIUM',
      title: 'Unlimited Approval Detected',
      description: 'Transaction contains MAX_UINT value, potentially requesting unlimited token approval.',
      recommendation: 'Consider using limited approval amounts',
      confidence: 0.8,
      source: 'llm',
    });
  }

  // Check for suspicious function names
  const suspiciousNames = [
    { pattern: /emergency.*withdraw/i, title: 'Emergency Withdrawal', severity: 'HIGH' as RiskSeverity },
    { pattern: /drain|rug|exploit/i, title: 'Suspicious Function Name', severity: 'CRITICAL' as RiskSeverity },
    { pattern: /set.*owner|transfer.*ownership/i, title: 'Ownership Change', severity: 'MEDIUM' as RiskSeverity },
    { pattern: /pause|freeze|blacklist/i, title: 'Access Control Function', severity: 'MEDIUM' as RiskSeverity },
    { pattern: /upgrade|migrate/i, title: 'Contract Upgrade', severity: 'MEDIUM' as RiskSeverity },
  ];

  for (const { pattern, title, severity } of suspiciousNames) {
    if (pattern.test(funcLower)) {
      issues.push({
        patternId: `semantic:quick:${title.toLowerCase().replace(/\s+/g, '-')}`,
        category: severity === 'CRITICAL' ? 'EXPLOIT' : 'PERMISSION',
        severity,
        title,
        description: `Function name "${input.functionName}" matches suspicious pattern.`,
        recommendation: 'Verify function behavior and authorization',
        confidence: 0.6,
        source: 'llm',
      });
    }
  }

  // Check for large value movements
  if (input.stateChanges) {
    const largeChanges = input.stateChanges.filter(sc => {
      const afterStr = JSON.stringify(sc.after || '');
      const numbers = afterStr.match(/\d+/g) || [];
      return numbers.some(n => parseInt(n) > 1e12); // > 1 trillion (1e12 / 1e6 decimals = 1M tokens)
    });

    if (largeChanges.length > 0) {
      issues.push({
        patternId: 'semantic:quick:large-value',
        category: 'EXPLOIT',
        severity: 'MEDIUM',
        title: 'Large Value Movement',
        description: `Transaction involves large value changes in ${largeChanges.length} resources.`,
        recommendation: 'Verify large transfers are intentional',
        confidence: 0.5,
        source: 'llm',
      });
    }
  }

  return issues;
}

// ============================================================================
// Similarity Cache (for performance)
// ============================================================================

const similarityCache = new Map<string, { result: SemanticMatchResult[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(input: SemanticAnalysisInput): string {
  return `${input.functionName}:${input.moduleAddress}:${JSON.stringify(input.arguments).slice(0, 100)}`;
}

export async function matchExploitSignaturesCached(
  input: SemanticAnalysisInput,
  minSimilarity: number = 0.6
): Promise<SemanticMatchResult[]> {
  const key = getCacheKey(input);
  const cached = similarityCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  const result = await matchExploitSignatures(input, minSimilarity);
  similarityCache.set(key, { result, timestamp: Date.now() });

  // Cleanup old cache entries
  if (similarityCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of similarityCache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        similarityCache.delete(k);
      }
    }
  }

  return result;
}

// ============================================================================
// Exports
// ============================================================================

export { extractSemanticFeatures };
