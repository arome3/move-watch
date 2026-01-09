import type { DemoTransaction } from '@movewatch/shared';

/**
 * Demo transactions for hackathon demonstration
 * These are pre-configured transactions that showcase Guardian's capabilities
 */

export const DEMO_TRANSACTIONS: DemoTransaction[] = [
  // ============================================================================
  // SAFE TRANSACTIONS
  // ============================================================================
  {
    id: 'demo:safe:transfer',
    name: 'Safe Token Transfer',
    description: 'Standard MOVE token transfer between addresses - completely safe',
    category: 'safe',
    network: 'testnet',
    functionPath: '0x1::coin::transfer',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: [
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2',
      '1000000', // 0.01 MOVE
    ],
    expectedRisk: 'LOW',
    expectedIssues: [],
  },
  {
    id: 'demo:safe:register',
    name: 'Register Coin Store',
    description: 'Register to receive a new token type - safe operation',
    category: 'safe',
    network: 'testnet',
    functionPath: '0x1::managed_coin::register',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: [],
    expectedRisk: 'LOW',
    expectedIssues: [],
  },

  // ============================================================================
  // EXPLOIT TRANSACTIONS
  // ============================================================================
  {
    id: 'demo:exploit:flashloan',
    name: 'Flash Loan Attack',
    description: 'Simulates a flash loan with potential price manipulation',
    category: 'exploit',
    network: 'testnet',
    functionPath: '0xdemo::flashloan::execute_flash_borrow',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: [
      '1000000000000', // Large borrow amount
      '0xdemo::oracle::update_price',
      '50', // Price manipulation percentage
    ],
    expectedRisk: 'CRITICAL',
    expectedIssues: ['Flash Loan Pattern', 'Oracle Manipulation Risk'],
  },
  {
    id: 'demo:exploit:reentrancy',
    name: 'Reentrancy Attack',
    description: 'Withdrawal with external callback - potential reentrancy',
    category: 'exploit',
    network: 'testnet',
    functionPath: '0xdemo::vault::withdraw_with_callback',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: [
      '1000000000',
      '0xattacker::malicious::callback_drain',
    ],
    expectedRisk: 'CRITICAL',
    expectedIssues: ['Reentrancy Vulnerability Detected'],
  },
  {
    id: 'demo:exploit:sandwich',
    name: 'MEV-Vulnerable Swap',
    description: 'Swap with high slippage tolerance - vulnerable to sandwich attack',
    category: 'exploit',
    network: 'testnet',
    functionPath: '0xdemo::dex::swap_exact_in',
    typeArguments: [
      '0x1::aptos_coin::AptosCoin',
      '0xdemo::token::USDC',
    ],
    arguments: [
      '10000000000', // 100 tokens in
      '1000000', // Very low min out (high slippage)
    ],
    expectedRisk: 'HIGH',
    expectedIssues: ['Sandwich Attack Vulnerability', 'High Slippage Tolerance'],
  },

  // ============================================================================
  // RUG PULL TRANSACTIONS
  // ============================================================================
  {
    id: 'demo:rugpull:lp_removal',
    name: 'Liquidity Rug Pull',
    description: 'Large liquidity removal by project owner',
    category: 'rugpull',
    network: 'testnet',
    functionPath: '0xdemo::amm::remove_liquidity_all',
    typeArguments: [
      '0xdemo::scamtoken::SCAM',
      '0x1::aptos_coin::AptosCoin',
    ],
    arguments: [
      '0xdemo_pool_address',
      '999999999999999', // Remove all liquidity
    ],
    sender: '0xdemo_project_owner',
    expectedRisk: 'CRITICAL',
    expectedIssues: ['Large Liquidity Removal Detected'],
  },
  {
    id: 'demo:rugpull:ownership',
    name: 'Ownership Transfer',
    description: 'Contract ownership being transferred to unknown address',
    category: 'rugpull',
    network: 'testnet',
    functionPath: '0xdemo::token::transfer_ownership',
    typeArguments: [],
    arguments: ['0xsuspicious_new_owner_address'],
    expectedRisk: 'CRITICAL',
    expectedIssues: ['Ownership Transfer Detected'],
  },
  {
    id: 'demo:rugpull:mint',
    name: 'Unlimited Minting',
    description: 'Massive token minting that could crash price',
    category: 'rugpull',
    network: 'testnet',
    functionPath: '0xdemo::token::mint_tokens',
    typeArguments: ['0xdemo::scamtoken::SCAM'],
    arguments: [
      '0xowner_address',
      '999999999999999999999', // Massive amount
    ],
    expectedRisk: 'CRITICAL',
    expectedIssues: ['Large Token Minting Detected'],
  },
  {
    id: 'demo:rugpull:blacklist',
    name: 'Blacklist Function',
    description: 'Adding addresses to blacklist - can lock user funds',
    category: 'rugpull',
    network: 'testnet',
    functionPath: '0xdemo::token::add_to_blacklist',
    typeArguments: [],
    arguments: [
      '0xvictim_address_1',
      '0xvictim_address_2',
    ],
    expectedRisk: 'HIGH',
    expectedIssues: ['Blacklist Function Called'],
  },

  // ============================================================================
  // SUSPICIOUS/PERMISSION TRANSACTIONS
  // ============================================================================
  {
    id: 'demo:suspicious:pause',
    name: 'Emergency Pause',
    description: 'Admin pausing the contract - stops all user transactions',
    category: 'suspicious',
    network: 'testnet',
    functionPath: '0xdemo::protocol::emergency_pause',
    typeArguments: [],
    arguments: [true, 'security_incident'],
    expectedRisk: 'HIGH',
    expectedIssues: ['Contract Pause State Change'],
  },
  {
    id: 'demo:suspicious:upgrade',
    name: 'Contract Upgrade',
    description: 'Contract code being upgraded - critical change',
    category: 'suspicious',
    network: 'testnet',
    functionPath: '0x1::code::publish_package_txn',
    typeArguments: [],
    arguments: [
      '0xnew_code_hash',
      ['0xmodule1', '0xmodule2'],
    ],
    expectedRisk: 'CRITICAL',
    expectedIssues: ['Contract Upgrade Detected'],
  },
  {
    id: 'demo:suspicious:admin_fee',
    name: 'Admin Fee Change',
    description: 'Increasing protocol fees to suspicious levels',
    category: 'suspicious',
    network: 'testnet',
    functionPath: '0xdemo::protocol::set_fee_percentage',
    typeArguments: [],
    arguments: [5000], // 50% fee!
    expectedRisk: 'HIGH',
    expectedIssues: ['Fee Modification Detected', 'Admin Function Detected'],
  },
  {
    id: 'demo:suspicious:config',
    name: 'Configuration Change',
    description: 'Modifying protocol parameters',
    category: 'suspicious',
    network: 'testnet',
    functionPath: '0xdemo::protocol::update_config',
    typeArguments: [],
    arguments: [
      { max_slippage: 9000, min_liquidity: 0 },
    ],
    expectedRisk: 'MEDIUM',
    expectedIssues: ['Configuration Change Detected'],
  },
];

/**
 * Get all demo transactions
 */
export function getDemoTransactions(): DemoTransaction[] {
  return DEMO_TRANSACTIONS;
}

/**
 * Get demo transaction by ID
 */
export function getDemoTransactionById(id: string): DemoTransaction | undefined {
  return DEMO_TRANSACTIONS.find((t) => t.id === id);
}

/**
 * Get demo transactions by category
 */
export function getDemoTransactionsByCategory(
  category: 'safe' | 'exploit' | 'rugpull' | 'suspicious'
): DemoTransaction[] {
  return DEMO_TRANSACTIONS.filter((t) => t.category === category);
}
