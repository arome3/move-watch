import type { RiskPatternDefinition } from '../types.js';

/**
 * Excessive Cost detection patterns
 * Detects: Gas Spikes, High Slippage, MEV Vulnerability
 */
export const COST_PATTERNS: RiskPatternDefinition[] = [
  // 1. High Gas Usage Detection
  {
    id: 'cost:gas:spike',
    category: 'EXCESSIVE_COST',
    severity: 'MEDIUM',
    name: 'High Gas Usage',
    description: 'Transaction uses unusually high gas',
    matchCriteria: {
      gasThreshold: { min: 500000 },
      customMatcher: (data) => {
        const gasUsed = data.simulationResult?.gasUsed || 0;

        if (gasUsed > 500000) {
          let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
          let confidence = 0.8;

          if (gasUsed > 2000000) {
            severity = 'HIGH';
            confidence = 0.95;
          } else if (gasUsed > 1000000) {
            severity = 'HIGH';
            confidence = 0.9;
          }

          return {
            matched: true,
            patternId: 'cost:gas:spike',
            category: 'EXCESSIVE_COST',
            severity,
            confidence,
            evidence: {
              gasUsed,
              threshold: 500000,
              multiplier: (gasUsed / 500000).toFixed(2),
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'High Gas Consumption',
      description:
        'This transaction consumes significantly more gas than typical transactions. This could indicate complex operations or inefficient code.',
      recommendation:
        'Review if this gas usage is expected for the operation. Consider optimizing the transaction or batching operations differently.',
    },
  },

  // 2. High Slippage Tolerance Detection
  {
    id: 'cost:slippage:high',
    category: 'EXCESSIVE_COST',
    severity: 'HIGH',
    name: 'High Slippage Risk',
    description: 'Transaction may experience high slippage',
    matchCriteria: {
      functionPatterns: [/::swap/i, /::exchange/i, /::trade/i],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        // Only check swap-like functions
        if (
          !fnLower.includes('swap') &&
          !fnLower.includes('exchange') &&
          !fnLower.includes('trade')
        ) {
          return null;
        }

        // Look for slippage indicators in arguments
        // Common pattern: amount_in, min_amount_out
        if (data.arguments.length >= 2) {
          try {
            // Assume first arg is amount in, second or later is min out
            const amountIn = BigInt(String(data.arguments[0]));

            // Find potential min_out (usually smaller than amount_in for same-value swaps)
            let minOut: bigint | null = null;
            for (let i = 1; i < data.arguments.length; i++) {
              const arg = data.arguments[i];
              if (typeof arg === 'string' || typeof arg === 'number') {
                try {
                  const val = BigInt(String(arg));
                  // Consider it min_out if it's non-zero and less than amount_in
                  if (val > 0 && val < amountIn) {
                    minOut = val;
                    break;
                  }
                } catch {
                  continue;
                }
              }
            }

            if (amountIn > 0 && minOut !== null && minOut > 0) {
              const slippagePercent = Number(
                ((amountIn - minOut) * BigInt(10000)) / amountIn
              ) / 100;

              if (slippagePercent > 5) {
                return {
                  matched: true,
                  patternId: 'cost:slippage:high',
                  category: 'EXCESSIVE_COST',
                  severity: slippagePercent > 20 ? 'CRITICAL' : 'HIGH',
                  confidence: 0.85,
                  evidence: {
                    amountIn: amountIn.toString(),
                    minOut: minOut.toString(),
                    estimatedSlippage: `${slippagePercent.toFixed(2)}%`,
                  },
                };
              }
            }
          } catch {
            // Could not parse amounts, skip
          }
        }

        // General warning for swap without clear slippage check
        return {
          matched: true,
          patternId: 'cost:slippage:high',
          category: 'EXCESSIVE_COST',
          severity: 'LOW',
          confidence: 0.5,
          evidence: {
            functionName: data.functionName,
            note: 'Swap detected but slippage parameters unclear',
          },
        };
      },
    },
    issueTemplate: {
      title: 'High Slippage Tolerance',
      description:
        'This transaction allows for high slippage, which means you may receive significantly less value than expected. This makes the trade vulnerable to front-running.',
      recommendation:
        'Consider reducing slippage tolerance to prevent value loss. Use smaller trades or private transaction pools for large swaps.',
    },
  },

  // 3. Large Transaction Size Warning
  {
    id: 'cost:size:large_trade',
    category: 'EXCESSIVE_COST',
    severity: 'MEDIUM',
    name: 'Large Transaction',
    description: 'Large transaction that may move market prices',
    matchCriteria: {
      functionPatterns: [/::swap/i, /::add_liquidity/i, /::trade/i],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        if (
          !fnLower.includes('swap') &&
          !fnLower.includes('liquidity') &&
          !fnLower.includes('trade')
        ) {
          return null;
        }

        // Check for large amounts (> 100 billion base units, roughly $100k+ depending on token)
        const largeAmount = data.arguments.some((arg) => {
          if (typeof arg === 'string' || typeof arg === 'number') {
            try {
              const num = BigInt(String(arg));
              return num > BigInt('100000000000000'); // 100 trillion base units
            } catch {
              return false;
            }
          }
          return false;
        });

        if (largeAmount) {
          return {
            matched: true,
            patternId: 'cost:size:large_trade',
            category: 'EXCESSIVE_COST',
            severity: 'MEDIUM',
            confidence: 0.7,
            evidence: {
              functionName: data.functionName,
              note: 'Large trade amount detected',
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Large Transaction Size',
      description:
        'This is a large transaction that may significantly impact market prices. Large trades often experience higher slippage and are attractive targets for MEV.',
      recommendation:
        'Consider splitting into smaller trades or using TWAP strategies. Use MEV protection services for large trades.',
    },
  },

  // 4. DEX Interaction Without Price Check
  {
    id: 'cost:dex:no_price_check',
    category: 'EXCESSIVE_COST',
    severity: 'MEDIUM',
    name: 'No Price Verification',
    description: 'DEX interaction without apparent price verification',
    matchCriteria: {
      functionPatterns: [/::swap/i, /::add_liquidity/i],
      customMatcher: (data) => {
        const events = data.simulationResult?.events || [];
        const fnLower = data.functionBaseName.toLowerCase();

        if (!fnLower.includes('swap') && !fnLower.includes('liquidity')) {
          return null;
        }

        // Look for oracle/price events
        const hasPriceCheck = events.some((e) =>
          /price|oracle|quote/i.test(e.type)
        );

        // Check for deadline parameter (usually indicates price protection)
        const hasDeadline = data.arguments.some((arg) => {
          if (typeof arg === 'number' || typeof arg === 'string') {
            const num = Number(arg);
            // Deadline usually looks like a unix timestamp
            return num > 1700000000 && num < 2000000000;
          }
          return false;
        });

        if (!hasPriceCheck && !hasDeadline) {
          return {
            matched: true,
            patternId: 'cost:dex:no_price_check',
            category: 'EXCESSIVE_COST',
            severity: 'LOW',
            confidence: 0.5,
            evidence: {
              functionName: data.functionName,
              hasPriceCheckEvent: hasPriceCheck,
              hasDeadline,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'No Price Verification Detected',
      description:
        'This DEX interaction does not appear to verify prices against an oracle. This could result in executing trades at unfavorable prices.',
      recommendation:
        'Consider using a DEX with oracle price checks or verify prices manually before large trades.',
    },
  },

  // 5. Repeated/Batch Operation Cost
  {
    id: 'cost:batch:multiple_ops',
    category: 'EXCESSIVE_COST',
    severity: 'LOW',
    name: 'Batch Operation',
    description: 'Multiple operations detected in single transaction',
    matchCriteria: {
      functionPatterns: [/::batch/i, /::multi/i, /::bulk/i],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();
        const events = data.simulationResult?.events || [];

        // Check for batch-like operations
        const isBatch =
          fnLower.includes('batch') ||
          fnLower.includes('multi') ||
          fnLower.includes('bulk');

        // Or many events (suggests multiple operations)
        const manyEvents = events.length > 10;

        // Or array arguments with many items
        const hasLargeArray = data.arguments.some(
          (arg) => Array.isArray(arg) && arg.length > 5
        );

        if (isBatch || manyEvents || hasLargeArray) {
          return {
            matched: true,
            patternId: 'cost:batch:multiple_ops',
            category: 'EXCESSIVE_COST',
            severity: 'LOW',
            confidence: 0.6,
            evidence: {
              isBatchFunction: isBatch,
              eventCount: events.length,
              hasLargeArrayArgs: hasLargeArray,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Batch Operation Detected',
      description:
        'This transaction performs multiple operations. While batching can save gas, complex batch operations may have higher risk if any single operation fails.',
      recommendation:
        'Review all operations in the batch carefully. Consider the atomicity implications - all succeed or all fail together.',
    },
  },
];

export default COST_PATTERNS;
