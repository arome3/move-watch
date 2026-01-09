/**
 * Semantic State Change Analyzer
 *
 * THIS IS THE CRITICAL COMPONENT that real security tools use.
 * Instead of regex on function names, we analyze WHAT ACTUALLY HAPPENS:
 * - Token balance changes (who gains, who loses, how much)
 * - Permission/approval state changes
 * - Ownership modifications
 * - Resource creation/destruction
 *
 * This is how Blowfish, Pocket Universe, and Fire actually work.
 * They show users: "You will SEND 10 ETH" / "You will RECEIVE 0 tokens"
 *
 * References:
 * - Blowfish: "We simulate transactions and flag malicious outcomes"
 * - Pocket Universe: "Shows clear balance changes including NFT listings"
 */

import type { RiskSeverity, StateChange, SimulationEvent } from '@movewatch/shared';
import type { DetectedIssue } from './types.js';
import { CONFIDENCE_LEVELS } from './utils.js';

// ============================================================================
// TYPES
// ============================================================================

export interface BalanceChange {
  address: string;
  tokenType: string;
  tokenSymbol?: string;
  before: bigint;
  after: bigint;
  delta: bigint;
  deltaUsd?: number;
  isGain: boolean;
  isLoss: boolean;
  percentage: number; // % of holdings affected
}

export interface PermissionChange {
  type: 'approval' | 'operator' | 'ownership' | 'role' | 'capability';
  grantor: string;
  grantee: string;
  resource: string;
  scope: 'unlimited' | 'limited' | 'revoked';
  previousState?: string;
  newState?: string;
}

export interface ResourceChange {
  type: 'created' | 'destroyed' | 'modified';
  resourceType: string;
  owner: string;
  value?: unknown;
}

export interface SemanticAnalysisResult {
  // Human-readable summary
  summary: {
    youWillSend: BalanceChange[];
    youWillReceive: BalanceChange[];
    permissionsGranted: PermissionChange[];
    permissionsRevoked: PermissionChange[];
    ownershipChanges: PermissionChange[];
    resourcesCreated: ResourceChange[];
    resourcesDestroyed: ResourceChange[];
  };

  // Risk assessment based on actual changes
  riskIndicators: {
    netValueChange: bigint;
    isNetLoss: boolean;
    hasUnlimitedApproval: boolean;
    hasOwnershipTransfer: boolean;
    affectsMultipleTokens: boolean;
    largePercentageOfHoldings: boolean;
    drainPattern: boolean;
  };

  // Detected issues
  issues: DetectedIssue[];

  // Raw analysis data
  balanceChanges: BalanceChange[];
  permissionChanges: PermissionChange[];
  resourceChanges: ResourceChange[];
}

// ============================================================================
// KNOWN RESOURCE TYPE PATTERNS
// ============================================================================

const RESOURCE_PATTERNS = {
  // Coin/Token resources
  coin: [
    /::coin::CoinStore</i,
    /::coin::Coin</i,
    /::fungible_asset::FungibleStore/i,
    /::primary_fungible_store/i,
  ],

  // NFT/Token resources
  nft: [
    /::token::TokenStore/i,
    /::token::Token/i,
    /::object::ObjectCore/i,
    /::collection::Collection/i,
  ],

  // Approval/Permission resources
  approval: [
    /::coin::SupplyConfig/i,
    /::coin::CoinInfo/i,
    /Allowance/i,
    /Approval/i,
    /Operator/i,
  ],

  // Ownership resources
  ownership: [
    /OwnerCapability/i,
    /AdminCapability/i,
    /::object::ObjectGroup/i,
    /::object::TransferRef/i,
  ],

  // Stake resources
  stake: [
    /::stake::StakePool/i,
    /::staking_contract/i,
    /::delegation_pool/i,
  ],
};

// Known token type addresses for value estimation
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  '0x1::aptos_coin::AptosCoin': { symbol: 'APT', decimals: 8 },
  '0x1::aptos_coin::MOVE': { symbol: 'MOVE', decimals: 8 },
  // Add more known tokens
};

// ============================================================================
// STATE CHANGE PARSING
// ============================================================================

/**
 * Parse state changes into balance changes
 */
function parseBalanceChanges(
  stateChanges: StateChange[],
  sender: string
): BalanceChange[] {
  const balanceChanges: BalanceChange[] = [];

  for (const change of stateChanges) {
    // Identify coin/token resources
    const isCoinResource = RESOURCE_PATTERNS.coin.some(p => p.test(change.resource));

    if (!isCoinResource) continue;

    // Extract token type from resource path
    // Format: 0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>
    const tokenMatch = change.resource.match(/<([^>]+)>/);
    const tokenType = tokenMatch ? tokenMatch[1] : 'unknown';

    // Extract address from resource
    const addressMatch = change.resource.match(/^(0x[a-fA-F0-9]+)/);
    const address = addressMatch ? addressMatch[1] : 'unknown';

    // Parse before/after values
    let beforeValue = BigInt(0);
    let afterValue = BigInt(0);

    if (change.before && typeof change.before === 'object') {
      const before = change.before as Record<string, unknown>;
      if (before.coin && typeof before.coin === 'object') {
        const coin = before.coin as Record<string, unknown>;
        beforeValue = BigInt(String(coin.value || 0));
      } else if (before.value !== undefined) {
        beforeValue = BigInt(String(before.value));
      }
    }

    if (change.after && typeof change.after === 'object') {
      const after = change.after as Record<string, unknown>;
      if (after.coin && typeof after.coin === 'object') {
        const coin = after.coin as Record<string, unknown>;
        afterValue = BigInt(String(coin.value || 0));
      } else if (after.value !== undefined) {
        afterValue = BigInt(String(after.value));
      }
    }

    const delta = afterValue - beforeValue;
    const knownToken = KNOWN_TOKENS[tokenType];

    // Calculate percentage change
    const percentage = beforeValue > 0
      ? Number((delta * BigInt(10000)) / beforeValue) / 100
      : delta > 0 ? 100 : 0;

    balanceChanges.push({
      address,
      tokenType,
      tokenSymbol: knownToken?.symbol,
      before: beforeValue,
      after: afterValue,
      delta,
      isGain: delta > BigInt(0),
      isLoss: delta < BigInt(0),
      percentage: Math.abs(percentage),
    });
  }

  return balanceChanges;
}

/**
 * Parse permission-related state changes
 */
function parsePermissionChanges(
  stateChanges: StateChange[],
  events: SimulationEvent[]
): PermissionChange[] {
  const permissionChanges: PermissionChange[] = [];

  // Check state changes for approval/permission modifications
  for (const change of stateChanges) {
    const isApprovalResource = RESOURCE_PATTERNS.approval.some(p => p.test(change.resource));
    const isOwnershipResource = RESOURCE_PATTERNS.ownership.some(p => p.test(change.resource));

    if (!isApprovalResource && !isOwnershipResource) continue;

    // Extract addresses
    const addressMatch = change.resource.match(/^(0x[a-fA-F0-9]+)/);
    const grantor = addressMatch ? addressMatch[1] : 'unknown';

    // Determine change type
    let changeType: PermissionChange['type'] = 'approval';
    if (isOwnershipResource) changeType = 'ownership';

    // Parse grantee from change data
    let grantee = 'unknown';
    let scope: PermissionChange['scope'] = 'limited';

    if (change.after && typeof change.after === 'object') {
      const after = change.after as Record<string, unknown>;

      // Look for spender/operator/owner fields
      if (after.spender) grantee = String(after.spender);
      if (after.operator) grantee = String(after.operator);
      if (after.owner) grantee = String(after.owner);
      if (after.new_owner) grantee = String(after.new_owner);

      // Check for unlimited approval
      if (after.amount === '18446744073709551615' ||
          after.amount === '340282366920938463463374607431768211455') {
        scope = 'unlimited';
      }
    }

    if (change.type === 'delete') {
      scope = 'revoked';
    }

    permissionChanges.push({
      type: changeType,
      grantor,
      grantee,
      resource: change.resource,
      scope,
      previousState: change.before ? JSON.stringify(change.before) : undefined,
      newState: change.after ? JSON.stringify(change.after) : undefined,
    });
  }

  // Also check events for approval/transfer events
  for (const event of events) {
    if (/Approval|Approve|SetOperator|OwnershipTransfer/i.test(event.type)) {
      const data = event.data as Record<string, unknown> || {};

      permissionChanges.push({
        type: event.type.toLowerCase().includes('owner') ? 'ownership' : 'approval',
        grantor: String(data.owner || data.from || 'unknown'),
        grantee: String(data.spender || data.operator || data.to || 'unknown'),
        resource: event.type,
        scope: 'limited',
      });
    }
  }

  return permissionChanges;
}

/**
 * Parse resource creation/destruction
 */
function parseResourceChanges(stateChanges: StateChange[]): ResourceChange[] {
  const resourceChanges: ResourceChange[] = [];

  for (const change of stateChanges) {
    if (change.type === 'create' && !change.before) {
      // Resource created
      const addressMatch = change.resource.match(/^(0x[a-fA-F0-9]+)/);
      resourceChanges.push({
        type: 'created',
        resourceType: change.resource,
        owner: addressMatch ? addressMatch[1] : 'unknown',
        value: change.after,
      });
    } else if (change.type === 'delete') {
      // Resource destroyed
      const addressMatch = change.resource.match(/^(0x[a-fA-F0-9]+)/);
      resourceChanges.push({
        type: 'destroyed',
        resourceType: change.resource,
        owner: addressMatch ? addressMatch[1] : 'unknown',
        value: change.before,
      });
    }
  }

  return resourceChanges;
}

// ============================================================================
// RISK DETECTION
// ============================================================================

/**
 * Detect drain pattern: sender loses significant value, receives nothing
 */
function detectDrainPattern(
  balanceChanges: BalanceChange[],
  sender: string
): boolean {
  const senderChanges = balanceChanges.filter(
    c => c.address.toLowerCase() === sender.toLowerCase()
  );

  const totalLoss = senderChanges
    .filter(c => c.isLoss)
    .reduce((sum, c) => sum + (c.delta < 0 ? -c.delta : BigInt(0)), BigInt(0));

  const totalGain = senderChanges
    .filter(c => c.isGain)
    .reduce((sum, c) => sum + (c.delta > 0 ? c.delta : BigInt(0)), BigInt(0));

  // Drain pattern: significant loss with little/no gain
  return totalLoss > BigInt(0) && totalGain < totalLoss / BigInt(10);
}

/**
 * Detect honeypot: can deposit but not withdraw
 */
function detectHoneypotIndicators(
  stateChanges: StateChange[],
  events: SimulationEvent[]
): boolean {
  // Look for suspicious patterns in state changes
  // e.g., balance increases but withdraw functions fail
  // This is a heuristic - true detection requires multiple simulations

  const hasDeposit = events.some(e => /deposit|transfer.*to/i.test(e.type));
  const hasWithdrawBlock = stateChanges.some(c => {
    if (!c.after || typeof c.after !== 'object') return false;
    const after = c.after as Record<string, unknown>;
    return after.withdraw_disabled === true || after.locked === true;
  });

  return hasDeposit && hasWithdrawBlock;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Perform semantic analysis of transaction state changes
 * This is what real security tools do - analyze OUTCOMES not names
 */
export function analyzeStateChanges(data: {
  sender: string;
  stateChanges?: StateChange[];
  events?: SimulationEvent[];
  functionName: string;
}): SemanticAnalysisResult {
  const issues: DetectedIssue[] = [];
  const stateChanges = data.stateChanges || [];
  const events = data.events || [];

  // Parse all changes
  const balanceChanges = parseBalanceChanges(stateChanges, data.sender);
  const permissionChanges = parsePermissionChanges(stateChanges, events);
  const resourceChanges = parseResourceChanges(stateChanges);

  // Categorize balance changes relative to sender
  const senderAddress = data.sender.toLowerCase();
  const youWillSend = balanceChanges.filter(
    c => c.address.toLowerCase() === senderAddress && c.isLoss
  );
  const youWillReceive = balanceChanges.filter(
    c => c.address.toLowerCase() === senderAddress && c.isGain
  );

  // Calculate risk indicators
  const netValueChange = balanceChanges
    .filter(c => c.address.toLowerCase() === senderAddress)
    .reduce((sum, c) => sum + c.delta, BigInt(0));

  const hasUnlimitedApproval = permissionChanges.some(
    p => p.scope === 'unlimited' && p.type === 'approval'
  );

  const hasOwnershipTransfer = permissionChanges.some(
    p => p.type === 'ownership'
  );

  const drainPattern = detectDrainPattern(balanceChanges, data.sender);

  const largePercentageOfHoldings = balanceChanges.some(
    c => c.address.toLowerCase() === senderAddress && c.percentage > 50
  );

  // =========================================================================
  // GENERATE ISSUES BASED ON ACTUAL STATE CHANGES (not function names!)
  // =========================================================================

  // Issue: Net loss detected
  if (netValueChange < BigInt(0)) {
    const absLoss = -netValueChange;
    const severity: RiskSeverity = absLoss > BigInt('1000000000') ? 'HIGH' :
                                    absLoss > BigInt('100000000') ? 'MEDIUM' : 'LOW';

    issues.push({
      patternId: 'semantic:net_loss',
      category: 'EXCESSIVE_COST',
      severity,
      title: 'Transaction Results in Net Loss',
      description: `This transaction will result in you LOSING tokens. ` +
        `You will send: ${youWillSend.map(c => `${c.delta} ${c.tokenSymbol || 'tokens'}`).join(', ')}. ` +
        `You will receive: ${youWillReceive.length > 0 ? youWillReceive.map(c => `${c.delta} ${c.tokenSymbol || 'tokens'}`).join(', ') : 'NOTHING'}.`,
      recommendation: 'Verify this is the expected outcome. If you expected to receive tokens, this may be a scam.',
      confidence: CONFIDENCE_LEVELS.VERY_HIGH,
      source: 'pattern' as const,
      evidence: {
        netChange: netValueChange.toString(),
        sends: youWillSend.map(c => ({ token: c.tokenType, amount: c.delta.toString() })),
        receives: youWillReceive.map(c => ({ token: c.tokenType, amount: c.delta.toString() })),
        analysisMethod: 'semantic_state_analysis',
      },
    });
  }

  // Issue: Drain pattern detected
  if (drainPattern) {
    issues.push({
      patternId: 'semantic:drain_pattern',
      category: 'RUG_PULL',
      severity: 'CRITICAL',
      title: 'DRAIN PATTERN DETECTED - You Lose Everything, Receive Nothing',
      description: `This transaction shows classic wallet drain behavior: you will lose significant token value ` +
        `but receive nothing meaningful in return. This is exactly how wallet drainers steal funds.`,
      recommendation: 'DO NOT SIGN THIS TRANSACTION. This matches the pattern of wallet drainer attacks ' +
        'that stole $494M in 2024.',
      confidence: CONFIDENCE_LEVELS.VERY_HIGH,
      source: 'pattern' as const,
      evidence: {
        totalLost: youWillSend.reduce((s, c) => s + c.delta.toString(), ''),
        received: 'NOTHING',
        patternMatch: 'drain_attack',
      },
    });
  }

  // Issue: Unlimited approval
  if (hasUnlimitedApproval) {
    const unlimitedApprovals = permissionChanges.filter(p => p.scope === 'unlimited');

    issues.push({
      patternId: 'semantic:unlimited_approval',
      category: 'EXPLOIT',
      severity: 'CRITICAL',
      title: 'UNLIMITED APPROVAL - Spender Can Drain All Your Tokens',
      description: `This transaction grants UNLIMITED spending approval to ${unlimitedApprovals.map(p => p.grantee).join(', ')}. ` +
        `Once approved, they can drain ALL tokens of this type from your wallet at ANY time, even years later.`,
      recommendation: 'NEVER approve unlimited amounts. Approve only the exact amount needed. ' +
        '56.7% of 2024 wallet thefts used approval/permit signatures.',
      confidence: CONFIDENCE_LEVELS.VERY_HIGH,
      source: 'pattern' as const,
      evidence: {
        approvals: unlimitedApprovals.map(p => ({
          grantee: p.grantee,
          resource: p.resource,
        })),
        detectionMethod: 'state_change_analysis',
      },
    });
  }

  // Issue: Ownership transfer
  if (hasOwnershipTransfer) {
    const ownershipChanges = permissionChanges.filter(p => p.type === 'ownership');

    issues.push({
      patternId: 'semantic:ownership_transfer',
      category: 'RUG_PULL',
      severity: 'CRITICAL',
      title: 'OWNERSHIP TRANSFER - Control Being Given Away',
      description: `This transaction transfers ownership/control to ${ownershipChanges.map(p => p.grantee).join(', ')}. ` +
        `This is often irreversible and gives the new owner full control.`,
      recommendation: 'Verify you intend to transfer ownership. 31.9% of 2024 thefts used setOwner calls.',
      confidence: CONFIDENCE_LEVELS.VERY_HIGH,
      source: 'pattern' as const,
      evidence: {
        ownershipChanges: ownershipChanges.map(p => ({
          from: p.grantor,
          to: p.grantee,
          resource: p.resource,
        })),
      },
    });
  }

  // Issue: Large percentage of holdings affected
  if (largePercentageOfHoldings) {
    const largeChanges = balanceChanges.filter(
      c => c.address.toLowerCase() === senderAddress && c.percentage > 50
    );

    issues.push({
      patternId: 'semantic:large_percentage',
      category: 'PERMISSION',
      severity: 'HIGH',
      title: 'Large Percentage of Holdings Affected',
      description: `This transaction affects more than 50% of your holdings for: ` +
        `${largeChanges.map(c => `${c.tokenSymbol || c.tokenType} (${c.percentage.toFixed(1)}%)`).join(', ')}.`,
      recommendation: 'Transactions affecting large portions of your holdings deserve extra scrutiny.',
      confidence: CONFIDENCE_LEVELS.HIGH,
      source: 'pattern' as const,
      evidence: {
        affectedTokens: largeChanges.map(c => ({
          token: c.tokenType,
          percentage: c.percentage,
        })),
      },
    });
  }

  // Issue: Resources being destroyed (potential loss)
  const destroyedResources = resourceChanges.filter(r => r.type === 'destroyed');
  if (destroyedResources.length > 0) {
    issues.push({
      patternId: 'semantic:resource_destruction',
      category: 'PERMISSION',
      severity: 'MEDIUM',
      title: 'Resources Being Permanently Destroyed',
      description: `This transaction permanently destroys ${destroyedResources.length} resource(s). ` +
        `Resources: ${destroyedResources.map(r => r.resourceType).join(', ')}`,
      recommendation: 'Verify resource destruction is intended. Some resources cannot be recreated.',
      confidence: CONFIDENCE_LEVELS.HIGH,
      source: 'pattern' as const,
      evidence: {
        destroyedResources: destroyedResources.map(r => ({
          type: r.resourceType,
          owner: r.owner,
        })),
      },
    });
  }

  return {
    summary: {
      youWillSend,
      youWillReceive,
      permissionsGranted: permissionChanges.filter(p => p.scope !== 'revoked'),
      permissionsRevoked: permissionChanges.filter(p => p.scope === 'revoked'),
      ownershipChanges: permissionChanges.filter(p => p.type === 'ownership'),
      resourcesCreated: resourceChanges.filter(r => r.type === 'created'),
      resourcesDestroyed: destroyedResources,
    },
    riskIndicators: {
      netValueChange,
      isNetLoss: netValueChange < BigInt(0),
      hasUnlimitedApproval,
      hasOwnershipTransfer,
      affectsMultipleTokens: new Set(balanceChanges.map(c => c.tokenType)).size > 1,
      largePercentageOfHoldings,
      drainPattern,
    },
    issues,
    balanceChanges,
    permissionChanges,
    resourceChanges,
  };
}

/**
 * Generate human-readable summary for UI display
 */
export function generateHumanReadableSummary(
  analysis: SemanticAnalysisResult
): string {
  const lines: string[] = [];

  // What you will send
  if (analysis.summary.youWillSend.length > 0) {
    lines.push('📤 YOU WILL SEND:');
    for (const change of analysis.summary.youWillSend) {
      const amount = formatTokenAmount(change.delta, change.tokenSymbol);
      lines.push(`   - ${amount}`);
    }
  }

  // What you will receive
  if (analysis.summary.youWillReceive.length > 0) {
    lines.push('📥 YOU WILL RECEIVE:');
    for (const change of analysis.summary.youWillReceive) {
      const amount = formatTokenAmount(change.delta, change.tokenSymbol);
      lines.push(`   + ${amount}`);
    }
  } else if (analysis.summary.youWillSend.length > 0) {
    lines.push('📥 YOU WILL RECEIVE: NOTHING');
  }

  // Permissions
  if (analysis.summary.permissionsGranted.length > 0) {
    lines.push('🔑 PERMISSIONS GRANTED:');
    for (const perm of analysis.summary.permissionsGranted) {
      const scope = perm.scope === 'unlimited' ? '⚠️ UNLIMITED' : 'limited';
      lines.push(`   - ${perm.type} to ${perm.grantee} (${scope})`);
    }
  }

  // Ownership changes
  if (analysis.summary.ownershipChanges.length > 0) {
    lines.push('👑 OWNERSHIP CHANGES:');
    for (const change of analysis.summary.ownershipChanges) {
      lines.push(`   - Transferring to ${change.grantee}`);
    }
  }

  return lines.join('\n');
}

function formatTokenAmount(delta: bigint, symbol?: string): string {
  const absValue = delta < 0 ? -delta : delta;
  // Assume 8 decimals for most tokens
  const formatted = Number(absValue) / 1e8;
  return `${formatted.toLocaleString()} ${symbol || 'tokens'}`;
}

export {
  RESOURCE_PATTERNS,
  KNOWN_TOKENS,
  detectDrainPattern,
  detectHoneypotIndicators,
};
