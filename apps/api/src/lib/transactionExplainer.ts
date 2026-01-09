/**
 * Transaction Explainer
 * Generates human-readable explanations for Move transactions
 */

import type { SimulationRequest, SimulationResponse, StateChange, SimulationEvent } from '@movewatch/shared';

export interface TransactionExplanation {
  summary: string;
  type: TransactionType;
  details: ExplanationDetail[];
  warnings: string[];
  humanReadable: string;
}

export type TransactionType =
  | 'transfer'
  | 'swap'
  | 'stake'
  | 'unstake'
  | 'mint'
  | 'burn'
  | 'create_account'
  | 'register_coin'
  | 'nft_transfer'
  | 'nft_mint'
  | 'liquidity_add'
  | 'liquidity_remove'
  | 'governance_vote'
  | 'contract_deploy'
  | 'unknown';

export interface ExplanationDetail {
  label: string;
  value: string;
  type: 'amount' | 'address' | 'token' | 'percentage' | 'text';
  highlight?: boolean;
}

// Token name mappings for common tokens
const TOKEN_NAMES: Record<string, string> = {
  '0x1::aptos_coin::AptosCoin': 'APT',
  'AptosCoin': 'APT',
  'USDC': 'USDC',
  'USDT': 'USDT',
  'WETH': 'WETH',
  'WBTC': 'WBTC',
  'MOVE': 'MOVE',
};

// Known function patterns for transaction type detection
const FUNCTION_PATTERNS: Array<{
  pattern: RegExp;
  type: TransactionType;
  extractDetails: (match: RegExpMatchArray, args: unknown[]) => Partial<TransactionExplanation>;
}> = [
  // Coin transfers
  {
    pattern: /::coin::transfer$/,
    type: 'transfer',
    extractDetails: (_, args) => ({
      details: [
        { label: 'To', value: formatAddress(String(args[0] || '')), type: 'address' },
        { label: 'Amount', value: formatAmount(args[1]), type: 'amount', highlight: true },
      ],
    }),
  },
  {
    pattern: /::aptos_account::transfer$/,
    type: 'transfer',
    extractDetails: (_, args) => ({
      details: [
        { label: 'To', value: formatAddress(String(args[0] || '')), type: 'address' },
        { label: 'Amount', value: formatAmount(args[1]), type: 'amount', highlight: true },
      ],
    }),
  },
  // Account creation
  {
    pattern: /::aptos_account::create_account$/,
    type: 'create_account',
    extractDetails: (_, args) => ({
      details: [
        { label: 'New Account', value: formatAddress(String(args[0] || '')), type: 'address' },
      ],
    }),
  },
  // Coin registration
  {
    pattern: /::managed_coin::register$|::coin::register$/,
    type: 'register_coin',
    extractDetails: () => ({
      details: [
        { label: 'Action', value: 'Register coin store', type: 'text' },
      ],
    }),
  },
  // Staking
  {
    pattern: /::stake$|::staking::stake/,
    type: 'stake',
    extractDetails: (_, args) => ({
      details: [
        { label: 'Amount', value: formatAmount(args[0] || args[1]), type: 'amount', highlight: true },
      ],
    }),
  },
  {
    pattern: /::unstake$|::staking::unstake|::withdraw_stake/,
    type: 'unstake',
    extractDetails: (_, args) => ({
      details: [
        { label: 'Amount', value: formatAmount(args[0] || args[1]), type: 'amount', highlight: true },
      ],
    }),
  },
  // Swaps (common DEX patterns)
  {
    pattern: /::swap$|::swap_exact|::router::swap/,
    type: 'swap',
    extractDetails: (_, args) => ({
      details: [
        { label: 'Input Amount', value: formatAmount(args[0]), type: 'amount', highlight: true },
        { label: 'Min Output', value: formatAmount(args[1]), type: 'amount' },
      ],
    }),
  },
  // Liquidity
  {
    pattern: /::add_liquidity/,
    type: 'liquidity_add',
    extractDetails: (_, args) => ({
      details: [
        { label: 'Amount A', value: formatAmount(args[0]), type: 'amount' },
        { label: 'Amount B', value: formatAmount(args[1]), type: 'amount' },
      ],
    }),
  },
  {
    pattern: /::remove_liquidity/,
    type: 'liquidity_remove',
    extractDetails: (_, args) => ({
      details: [
        { label: 'LP Amount', value: formatAmount(args[0]), type: 'amount', highlight: true },
      ],
    }),
  },
  // NFT operations
  {
    pattern: /::token::transfer$|::nft::transfer/,
    type: 'nft_transfer',
    extractDetails: (_, args) => ({
      details: [
        { label: 'To', value: formatAddress(String(args[0] || '')), type: 'address' },
        { label: 'Token ID', value: String(args[1] || args[2] || 'Unknown'), type: 'text' },
      ],
    }),
  },
  {
    pattern: /::token::mint$|::nft::mint/,
    type: 'nft_mint',
    extractDetails: () => ({
      details: [
        { label: 'Action', value: 'Mint NFT', type: 'text' },
      ],
    }),
  },
  // Minting
  {
    pattern: /::mint$|::managed_coin::mint/,
    type: 'mint',
    extractDetails: (_, args) => ({
      details: [
        { label: 'To', value: formatAddress(String(args[0] || '')), type: 'address' },
        { label: 'Amount', value: formatAmount(args[1]), type: 'amount', highlight: true },
      ],
    }),
  },
  // Burning
  {
    pattern: /::burn$|::managed_coin::burn/,
    type: 'burn',
    extractDetails: (_, args) => ({
      details: [
        { label: 'Amount', value: formatAmount(args[0]), type: 'amount', highlight: true },
      ],
    }),
  },
];

// Format address for display
function formatAddress(address: string): string {
  if (!address) return 'Unknown';
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

// Format amount (handle octas conversion)
function formatAmount(value: unknown): string {
  if (value === undefined || value === null) return 'Unknown';

  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(numValue)) return String(value);

  // Convert from octas to APT (8 decimals)
  const apt = numValue / 100_000_000;

  if (apt >= 1_000_000) {
    return `${(apt / 1_000_000).toFixed(2)}M`;
  } else if (apt >= 1_000) {
    return `${(apt / 1_000).toFixed(2)}K`;
  } else if (apt >= 1) {
    return apt.toFixed(4);
  } else if (apt >= 0.0001) {
    return apt.toFixed(6);
  } else {
    return `${numValue.toLocaleString()} octas`;
  }
}

// Extract token type from type arguments
function extractTokenType(typeArgs: string[]): string {
  if (!typeArgs || typeArgs.length === 0) return 'tokens';

  const firstType = typeArgs[0];

  // Check known token names
  for (const [pattern, name] of Object.entries(TOKEN_NAMES)) {
    if (firstType.includes(pattern)) return name;
  }

  // Extract the last part of the type path
  const parts = firstType.split('::');
  return parts[parts.length - 1] || 'tokens';
}

// Get transaction type emoji
function getTypeEmoji(type: TransactionType): string {
  const emojis: Record<TransactionType, string> = {
    transfer: '',
    swap: '',
    stake: '',
    unstake: '',
    mint: '',
    burn: '',
    create_account: '',
    register_coin: '',
    nft_transfer: '',
    nft_mint: '',
    liquidity_add: '',
    liquidity_remove: '',
    governance_vote: '',
    contract_deploy: '',
    unknown: '',
  };
  return emojis[type] || '';
}

// Generate human-readable summary
function generateSummary(
  type: TransactionType,
  functionPath: string,
  args: unknown[],
  typeArgs: string[]
): string {
  const token = extractTokenType(typeArgs);

  switch (type) {
    case 'transfer': {
      const to = formatAddress(String(args[0] || ''));
      const amount = formatAmount(args[1]);
      return `Transfer ${amount} ${token} to ${to}`;
    }
    case 'swap': {
      const inputAmount = formatAmount(args[0]);
      return `Swap ${inputAmount} ${token} for another token`;
    }
    case 'stake': {
      const amount = formatAmount(args[0] || args[1]);
      return `Stake ${amount} ${token}`;
    }
    case 'unstake': {
      const amount = formatAmount(args[0] || args[1]);
      return `Unstake ${amount} ${token}`;
    }
    case 'mint': {
      const amount = formatAmount(args[1]);
      return `Mint ${amount} ${token}`;
    }
    case 'burn': {
      const amount = formatAmount(args[0]);
      return `Burn ${amount} ${token}`;
    }
    case 'create_account': {
      const addr = formatAddress(String(args[0] || ''));
      return `Create new account at ${addr}`;
    }
    case 'register_coin':
      return `Register ${token} coin store`;
    case 'nft_transfer': {
      const to = formatAddress(String(args[0] || ''));
      return `Transfer NFT to ${to}`;
    }
    case 'nft_mint':
      return 'Mint new NFT';
    case 'liquidity_add':
      return 'Add liquidity to pool';
    case 'liquidity_remove':
      return 'Remove liquidity from pool';
    case 'governance_vote':
      return 'Cast governance vote';
    case 'contract_deploy':
      return 'Deploy smart contract';
    default: {
      // Extract function name from path
      const funcName = functionPath.split('::').pop() || 'Unknown';
      return `Call ${funcName}`;
    }
  }
}

/**
 * Generate human-readable explanation for a transaction
 */
export function explainTransaction(
  request: SimulationRequest,
  response?: SimulationResponse
): TransactionExplanation {
  const functionPath = request.payload.function;
  const args = request.payload.arguments;
  const typeArgs = request.payload.type_arguments;
  const warnings: string[] = [];

  // Detect transaction type
  let type: TransactionType = 'unknown';
  let details: ExplanationDetail[] = [];

  for (const pattern of FUNCTION_PATTERNS) {
    const match = functionPath.match(pattern.pattern);
    if (match) {
      type = pattern.type;
      const extracted = pattern.extractDetails(match, args);
      details = extracted.details || [];
      break;
    }
  }

  // Generate summary
  const summary = generateSummary(type, functionPath, args, typeArgs);

  // Add token type if detected
  const token = extractTokenType(typeArgs);
  if (token !== 'tokens' && !details.some(d => d.label === 'Token')) {
    details.unshift({ label: 'Token', value: token, type: 'token' });
  }

  // Add gas estimate if available
  if (response?.gasUsed) {
    const gasInApt = response.gasUsed / 100_000_000;
    details.push({
      label: 'Est. Gas Cost',
      value: `${gasInApt.toFixed(6)} APT`,
      type: 'amount',
    });
  }

  // Add warnings based on simulation
  if (response) {
    if (!response.success) {
      warnings.push(`Transaction may fail: ${response.error?.vmStatus || 'Unknown error'}`);
    }

    // Check for large balance changes
    if (response.stateChanges) {
      for (const change of response.stateChanges) {
        if (change.type === 'delete') {
          warnings.push(`Resource will be deleted at ${formatAddress(change.address)}`);
        }
      }
    }

    // High gas warning
    if (response.gasUsed && response.gasUsed > 10_000_000) {
      warnings.push('High gas usage detected - transaction may be expensive');
    }
  }

  // Generate human-readable explanation
  const humanReadable = generateHumanReadable(type, summary, details, warnings);

  return {
    summary,
    type,
    details,
    warnings,
    humanReadable,
  };
}

/**
 * Generate a human-readable explanation string
 */
function generateHumanReadable(
  type: TransactionType,
  summary: string,
  details: ExplanationDetail[],
  warnings: string[]
): string {
  const lines: string[] = [];

  // Main action
  lines.push(`${getTypeEmoji(type)} ${summary}`);
  lines.push('');

  // Details
  if (details.length > 0) {
    lines.push('Details:');
    for (const detail of details) {
      const highlight = detail.highlight ? ' *' : '';
      lines.push(`  ${detail.label}: ${detail.value}${highlight}`);
    }
    lines.push('');
  }

  // Warnings
  if (warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of warnings) {
      lines.push(`  ! ${warning}`);
    }
  }

  return lines.join('\n').trim();
}

/**
 * Analyze balance changes from simulation and generate explanation
 */
export function explainBalanceChanges(
  stateChanges: StateChange[],
  senderAddress?: string
): string[] {
  const explanations: string[] = [];

  for (const change of stateChanges) {
    // Check for coin balance changes
    if (change.resource.includes('CoinStore') || change.resource.includes('FungibleStore')) {
      const token = extractTokenType([change.resource]);

      if (change.type === 'modify' && change.before && change.after) {
        const beforeData = change.before as Record<string, unknown>;
        const afterData = change.after as Record<string, unknown>;

        // Extract balance values
        const beforeBalance = extractBalance(beforeData);
        const afterBalance = extractBalance(afterData);

        if (beforeBalance !== null && afterBalance !== null) {
          const diff = afterBalance - beforeBalance;
          const formattedDiff = formatAmount(Math.abs(diff));
          const isSender = senderAddress && change.address.includes(senderAddress);

          if (diff > 0) {
            explanations.push(
              `${isSender ? 'You' : formatAddress(change.address)} receive${isSender ? '' : 's'} +${formattedDiff} ${token}`
            );
          } else if (diff < 0) {
            explanations.push(
              `${isSender ? 'You' : formatAddress(change.address)} send${isSender ? '' : 's'} -${formattedDiff} ${token}`
            );
          }
        }
      }
    }
  }

  return explanations;
}

// Helper to extract balance from resource data
function extractBalance(data: Record<string, unknown>): number | null {
  // Try coin.value path
  const coin = data.coin as Record<string, unknown> | undefined;
  if (coin?.value !== undefined) {
    return Number(coin.value);
  }

  // Try direct balance path
  if (data.balance !== undefined) {
    return Number(data.balance);
  }

  return null;
}
