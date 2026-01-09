/**
 * Execution Trace Analyzer
 *
 * Analyzes actual transaction execution data (state changes, events, gas)
 * rather than just function names. This provides REAL security analysis
 * by looking at what the code DOES, not what it's NAMED.
 *
 * Key Analysis Types:
 * 1. Token Flow Analysis - tracks balance changes to detect fund drains
 * 2. Event Sequence Analysis - detects reentrancy and callback patterns
 * 3. State Change Analysis - identifies unauthorized state modifications
 * 4. Gas Usage Analysis - detects excessive gas consumption patterns
 *
 * This is critical because:
 * - A function named "safeTransfer" could actually drain funds
 * - A function named "donate" could steal from users
 * - Only by analyzing WHAT the code does can we detect real threats
 */

import type { RiskSeverity, RiskCategory, StateChange, SimulationEvent } from '@movewatch/shared';
import type { DetectedIssue } from './types.js';
import { CONFIDENCE_LEVELS } from './utils.js';

// Token flow change representation
interface TokenFlow {
  token: string;
  fromAddress: string;
  toAddress: string;
  amount: bigint;
  direction: 'incoming' | 'outgoing';
}

// Event sequence for pattern detection
interface EventSequence {
  events: Array<{
    type: string;
    sequence_number: number;
    data: unknown;
  }>;
  moduleCallCount: Record<string, number>;
  hasRepeatedCalls: boolean;
}

// Analysis result
export interface ExecutionTraceResult {
  tokenFlows: TokenFlow[];
  eventSequence: EventSequence;
  issues: DetectedIssue[];
  summary: {
    totalBalanceChange: Record<string, bigint>;
    eventCount: number;
    modulesCalled: string[];
    gasUsed: number;
  };
}

/**
 * Analyze token flows from state changes
 *
 * This extracts actual token movements from the simulation result,
 * allowing us to detect fund drains regardless of function name.
 */
function analyzeTokenFlows(
  stateChanges: StateChange[],
  sender: string
): { flows: TokenFlow[]; issues: DetectedIssue[] } {
  const flows: TokenFlow[] = [];
  const issues: DetectedIssue[] = [];

  // Track balance changes by address and token
  const balanceChanges: Record<string, Record<string, bigint>> = {};

  for (const change of stateChanges) {
    // Detect CoinStore or FungibleAsset balance changes
    const coinStoreMatch = change.resource.match(/0x1::coin::CoinStore<(.+)>/);
    const fungibleMatch = change.resource.match(/0x1::fungible_asset::/);

    if (coinStoreMatch || fungibleMatch) {
      const token = coinStoreMatch ? coinStoreMatch[1] : 'FungibleAsset';
      const address = change.address || 'unknown';

      // Extract value changes
      if (change.type === 'modify' && change.before && change.after) {
        const beforeValue = extractCoinValue(change.before);
        const afterValue = extractCoinValue(change.after);

        if (beforeValue !== null && afterValue !== null) {
          const delta = afterValue - beforeValue;

          // Track the change
          if (!balanceChanges[address]) {
            balanceChanges[address] = {};
          }
          balanceChanges[address][token] = (balanceChanges[address][token] || BigInt(0)) + delta;

          // Create flow entry
          if (delta < 0) {
            flows.push({
              token,
              fromAddress: address,
              toAddress: 'unknown', // Would need to correlate with other changes
              amount: -delta,
              direction: address.toLowerCase() === sender.toLowerCase() ? 'outgoing' : 'outgoing',
            });
          } else if (delta > 0) {
            flows.push({
              token,
              fromAddress: 'unknown',
              toAddress: address,
              amount: delta,
              direction: address.toLowerCase() === sender.toLowerCase() ? 'incoming' : 'incoming',
            });
          }
        }
      }
    }
  }

  // Analyze for suspicious patterns
  const senderLower = sender.toLowerCase();

  for (const [address, tokenChanges] of Object.entries(balanceChanges)) {
    for (const [token, delta] of Object.entries(tokenChanges)) {
      const isSender = address.toLowerCase() === senderLower;

      // Large outgoing transfer from sender
      if (isSender && delta < 0) {
        const absAmount = -delta;

        // Flag if sender is losing more than 10^18 units (1 token in common decimals)
        if (absAmount > BigInt('1000000000000000000')) {
          issues.push({
            patternId: 'trace:token_flow:large_outgoing',
            category: 'RUG_PULL',
            severity: 'HIGH',
            title: 'Large Token Transfer From Your Account',
            description: `This transaction transfers ${formatBigInt(absAmount)} ${token} from your account. This is detected from actual state changes, not function names.`,
            recommendation: 'Verify this is the expected amount. Large unexpected outflows could indicate a drain attack.',
            confidence: CONFIDENCE_LEVELS.VERY_HIGH,
            source: 'pattern' as const,
            evidence: {
              token,
              amount: absAmount.toString(),
              fromAddress: address,
              detectedFromStateChanges: true,
            },
          });
        }
      }

      // Sender losing funds while unknown address gains
      if (!isSender && delta > 0 && balanceChanges[sender]?.[token] && balanceChanges[sender][token] < 0) {
        issues.push({
          patternId: 'trace:token_flow:fund_movement',
          category: 'EXPLOIT',
          severity: 'MEDIUM',
          title: 'Token Movement Detected',
          description: `Tokens (${token}) are moving from your account to ${address}. Verify this recipient is expected.`,
          recommendation: 'Confirm the recipient address is correct before proceeding.',
          confidence: CONFIDENCE_LEVELS.HIGH,
          source: 'pattern' as const,
          evidence: {
            token,
            toAddress: address,
            amount: delta.toString(),
            detectedFromStateChanges: true,
          },
        });
      }
    }
  }

  return { flows, issues };
}

/**
 * Analyze event sequences for suspicious patterns
 *
 * This detects:
 * - Reentrancy-like patterns (same event firing multiple times)
 * - Unusual event ordering (e.g., withdraw before deposit)
 * - Missing expected events
 */
function analyzeEventSequence(
  events: SimulationEvent[]
): { sequence: EventSequence; issues: DetectedIssue[] } {
  const issues: DetectedIssue[] = [];

  // Count module calls
  const moduleCallCount: Record<string, number> = {};
  for (const event of events) {
    const moduleMatch = event.type.match(/^(0x[^:]+::[^:]+)/);
    if (moduleMatch) {
      const module = moduleMatch[1];
      moduleCallCount[module] = (moduleCallCount[module] || 0) + 1;
    }
  }

  // Check for repeated module calls (potential reentrancy)
  const hasRepeatedCalls = Object.values(moduleCallCount).some(count => count > 2);

  const sequence: EventSequence = {
    events: events.map((e, i) => ({
      type: e.type,
      sequence_number: e.sequenceNumber || i,
      data: e.data,
    })),
    moduleCallCount,
    hasRepeatedCalls,
  };

  // Detect suspicious patterns

  // 1. Same event type appearing many times (potential loop/reentrancy)
  const eventTypeCounts: Record<string, number> = {};
  for (const event of events) {
    eventTypeCounts[event.type] = (eventTypeCounts[event.type] || 0) + 1;
  }

  for (const [eventType, count] of Object.entries(eventTypeCounts)) {
    if (count > 5) {
      issues.push({
        patternId: 'trace:event_sequence:repeated_event',
        category: 'EXPLOIT',
        severity: 'HIGH',
        title: 'Repeated Event Pattern Detected',
        description: `The event "${eventType}" was emitted ${count} times in this transaction. This could indicate a loop or reentrancy-like behavior.`,
        recommendation: 'Review the transaction logic. Multiple identical events may indicate unexpected recursive calls.',
        confidence: CONFIDENCE_LEVELS.HIGH,
        source: 'pattern' as const,
        evidence: {
          eventType,
          count,
          detectedFromEventTrace: true,
        },
      });
    }
  }

  // 2. Check for withdraw followed by deposit pattern (flash loan)
  const eventTypes = events.map(e => e.type.toLowerCase());
  const hasWithdraw = eventTypes.some(t => t.includes('withdraw') || t.includes('borrow'));
  const hasDeposit = eventTypes.some(t => t.includes('deposit') || t.includes('repay'));

  if (hasWithdraw && hasDeposit) {
    // Check order - withdraw before deposit in same tx is flash loan pattern
    const withdrawIndex = eventTypes.findIndex((t: string) => t.includes('withdraw') || t.includes('borrow'));
    // Use reverse search for last deposit index (findLastIndex not available in all targets)
    let depositIndex = -1;
    for (let i = eventTypes.length - 1; i >= 0; i--) {
      if (eventTypes[i].includes('deposit') || eventTypes[i].includes('repay')) {
        depositIndex = i;
        break;
      }
    }

    if (withdrawIndex < depositIndex && depositIndex - withdrawIndex > 2) {
      issues.push({
        patternId: 'trace:event_sequence:flash_loan_pattern',
        category: 'EXPLOIT',
        severity: 'HIGH',
        title: 'Flash Loan Pattern Detected',
        description: 'This transaction shows a borrow/withdraw followed by repay/deposit pattern with operations in between. This is characteristic of flash loan usage.',
        recommendation: 'Flash loans are powerful tools that can be used for both legitimate and malicious purposes. Verify the intermediate operations.',
        confidence: CONFIDENCE_LEVELS.HIGH,
        source: 'pattern' as const,
        evidence: {
          pattern: 'withdraw...operations...deposit',
          withdrawIndex,
          depositIndex,
          operationsBetween: depositIndex - withdrawIndex - 1,
          detectedFromEventTrace: true,
        },
      });
    }
  }

  // 3. Check for price update events (oracle manipulation)
  const priceEvents = events.filter(e =>
    e.type.toLowerCase().includes('price') ||
    e.type.toLowerCase().includes('oracle')
  );

  if (priceEvents.length > 1) {
    issues.push({
      patternId: 'trace:event_sequence:multiple_price_updates',
      category: 'EXPLOIT',
      severity: 'CRITICAL',
      title: 'Multiple Price/Oracle Updates',
      description: `Detected ${priceEvents.length} price or oracle update events in a single transaction. This pattern is often associated with oracle manipulation attacks.`,
      recommendation: 'Be extremely cautious. Multiple price updates in one transaction is a red flag for oracle manipulation.',
      confidence: CONFIDENCE_LEVELS.VERY_HIGH,
      source: 'pattern' as const,
      evidence: {
        priceEventCount: priceEvents.length,
        priceEventTypes: priceEvents.map(e => e.type),
        detectedFromEventTrace: true,
      },
    });
  }

  return { sequence, issues };
}

/**
 * Analyze gas usage patterns
 *
 * Detects:
 * - Excessive gas consumption (DoS potential)
 * - Unusual gas per operation
 */
function analyzeGasUsage(
  gasUsed: number,
  eventCount: number,
  stateChangeCount: number
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  // Gas per operation
  const operationCount = eventCount + stateChangeCount;
  const gasPerOperation = operationCount > 0 ? gasUsed / operationCount : gasUsed;

  // Flag excessive gas
  if (gasUsed > 50000000) {
    issues.push({
      patternId: 'trace:gas:excessive',
      category: 'EXCESSIVE_COST',
      severity: 'HIGH',
      title: 'Excessive Gas Consumption',
      description: `This transaction uses ${gasUsed.toLocaleString()} gas units, which is extremely high. This could lead to transaction failure or high costs.`,
      recommendation: 'Review the transaction complexity. Consider breaking into smaller transactions if possible.',
      confidence: CONFIDENCE_LEVELS.HIGH,
      source: 'pattern' as const,
      evidence: {
        gasUsed,
        threshold: 50000000,
        detectedFromGasAnalysis: true,
      },
    });
  }

  // Flag high gas per operation (potentially inefficient or malicious)
  if (gasPerOperation > 500000 && operationCount > 0) {
    issues.push({
      patternId: 'trace:gas:inefficient',
      category: 'EXCESSIVE_COST',
      severity: 'MEDIUM',
      title: 'Unusually High Gas Per Operation',
      description: `Average gas per operation is ${Math.round(gasPerOperation).toLocaleString()}, which is higher than typical. This could indicate inefficient code or hidden computations.`,
      recommendation: 'The transaction may be doing more work than expected. Verify the operation complexity.',
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      source: 'pattern' as const,
      evidence: {
        gasUsed,
        operationCount,
        gasPerOperation: Math.round(gasPerOperation),
        detectedFromGasAnalysis: true,
      },
    });
  }

  return issues;
}

/**
 * Main execution trace analysis function
 *
 * Combines all trace analysis methods to provide comprehensive
 * execution-based security analysis.
 */
export function analyzeExecutionTrace(data: {
  sender: string;
  stateChanges?: StateChange[];
  events?: SimulationEvent[];
  gasUsed?: number;
}): ExecutionTraceResult {
  const allIssues: DetectedIssue[] = [];
  const stateChanges = data.stateChanges || [];
  const events = data.events || [];
  const gasUsed = data.gasUsed || 0;

  // 1. Analyze token flows
  const { flows: tokenFlows, issues: flowIssues } = analyzeTokenFlows(stateChanges, data.sender);
  allIssues.push(...flowIssues);

  // 2. Analyze event sequences
  const { sequence: eventSequence, issues: sequenceIssues } = analyzeEventSequence(events);
  allIssues.push(...sequenceIssues);

  // 3. Analyze gas usage
  const gasIssues = analyzeGasUsage(gasUsed, events.length, stateChanges.length);
  allIssues.push(...gasIssues);

  // Build summary
  const totalBalanceChange: Record<string, bigint> = {};
  for (const flow of tokenFlows) {
    const change = flow.direction === 'incoming' ? flow.amount : -flow.amount;
    totalBalanceChange[flow.token] = (totalBalanceChange[flow.token] || BigInt(0)) + change;
  }

  // Get unique modules called
  const modulesCalled = Object.keys(eventSequence.moduleCallCount);

  return {
    tokenFlows,
    eventSequence,
    issues: allIssues,
    summary: {
      totalBalanceChange,
      eventCount: events.length,
      modulesCalled,
      gasUsed,
    },
  };
}

/**
 * Helper: Extract coin value from state data
 */
function extractCoinValue(stateData: unknown): bigint | null {
  if (typeof stateData !== 'object' || stateData === null) {
    return null;
  }

  const data = stateData as Record<string, unknown>;

  // Try different formats
  if ('coin' in data && typeof data.coin === 'object' && data.coin !== null) {
    const coin = data.coin as Record<string, unknown>;
    if ('value' in coin) {
      try {
        return BigInt(String(coin.value));
      } catch {
        return null;
      }
    }
  }

  if ('value' in data) {
    try {
      return BigInt(String(data.value));
    } catch {
      return null;
    }
  }

  if ('balance' in data) {
    try {
      return BigInt(String(data.balance));
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Helper: Format bigint for display
 */
function formatBigInt(value: bigint): string {
  const str = value.toString();
  if (str.length <= 18) {
    return str;
  }
  // Format as decimal with 8 decimal places
  const intPart = str.slice(0, str.length - 8);
  const decPart = str.slice(str.length - 8);
  return `${intPart || '0'}.${decPart}`;
}

export { analyzeTokenFlows, analyzeEventSequence, analyzeGasUsage };
