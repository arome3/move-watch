import type { RiskPatternDefinition } from '../types.js';

/**
 * Rug Pull detection patterns
 * Detects: LP Removal, Ownership Transfer, Blacklist, Unlimited Minting
 */
export const RUG_PULL_PATTERNS: RiskPatternDefinition[] = [
  // 1. Liquidity Removal Detection
  {
    id: 'rugpull:lp:remove_liquidity',
    category: 'RUG_PULL',
    severity: 'HIGH',
    name: 'Liquidity Removal',
    description: 'Large liquidity removal detected',
    matchCriteria: {
      functionPatterns: [
        /::remove_liquidity/i,
        /::withdraw_liquidity/i,
        /::burn_lp/i,
        /::exit_pool/i,
        /::remove_all_liquidity/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        // Check for liquidity removal functions
        if (
          fnLower.includes('remove_liquidity') ||
          fnLower.includes('withdraw_liquidity') ||
          fnLower.includes('burn_lp') ||
          fnLower.includes('exit_pool')
        ) {
          const events = data.simulationResult?.events || [];
          const lpEvent = events.find((e) =>
            /liquidity|lp|pool/i.test(e.type)
          );

          // Check if removing significant amount
          const isLargeRemoval = data.arguments.some((arg) => {
            if (typeof arg === 'string' || typeof arg === 'number') {
              try {
                const num = BigInt(arg);
                // Consider large if > 1 billion units (could be 1000 tokens with 6 decimals)
                return num > BigInt('1000000000');
              } catch {
                return false;
              }
            }
            return false;
          });

          return {
            matched: true,
            patternId: 'rugpull:lp:remove_liquidity',
            category: 'RUG_PULL',
            severity: isLargeRemoval ? 'CRITICAL' : 'HIGH',
            confidence: isLargeRemoval ? 0.9 : 0.75,
            evidence: {
              functionName: data.functionName,
              isLargeRemoval,
              hasLpEvent: !!lpEvent,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Large Liquidity Removal Detected',
      description:
        'This transaction removes liquidity from a pool. Large liquidity removals can significantly impact token price and may indicate a rug pull.',
      recommendation:
        'Verify this is an authorized action. Check if the sender is a trusted address and if this aligns with the project roadmap.',
    },
  },

  // 2. Ownership Transfer Detection
  {
    id: 'rugpull:ownership:transfer',
    category: 'RUG_PULL',
    severity: 'CRITICAL',
    name: 'Ownership Transfer',
    description: 'Contract ownership transfer detected',
    matchCriteria: {
      functionPatterns: [
        /::transfer_ownership/i,
        /::set_owner/i,
        /::set_admin/i,
        /::change_owner/i,
        /::renounce_ownership/i,
        /::accept_ownership/i,
      ],
      eventPatterns: [{ type: /OwnershipTransfer|AdminChange|NewOwner/i }],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        if (
          fnLower.includes('transfer_ownership') ||
          fnLower.includes('set_owner') ||
          fnLower.includes('set_admin') ||
          fnLower.includes('change_owner') ||
          fnLower.includes('renounce')
        ) {
          // Check events for ownership transfer
          const events = data.simulationResult?.events || [];
          const ownershipEvent = events.find((e) =>
            /owner|admin/i.test(e.type)
          );

          return {
            matched: true,
            patternId: 'rugpull:ownership:transfer',
            category: 'RUG_PULL',
            severity: 'CRITICAL',
            confidence: 0.95,
            evidence: {
              functionName: data.functionName,
              newOwner: data.arguments[0],
              hasOwnershipEvent: !!ownershipEvent,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Ownership Transfer Detected',
      description:
        'Contract ownership is being transferred to a new address. This is a critical operation that could be a precursor to a rug pull.',
      recommendation:
        'Verify the new owner address is trusted. Check if this is part of a planned transition. Be cautious of unexpected ownership changes.',
    },
  },

  // 3. Blacklist Function Detection
  {
    id: 'rugpull:blacklist:add',
    category: 'RUG_PULL',
    severity: 'HIGH',
    name: 'Blacklist Function',
    description: 'Address blacklisting detected',
    matchCriteria: {
      functionPatterns: [
        /::blacklist/i,
        /::block_address/i,
        /::freeze_account/i,
        /::ban_address/i,
        /::add_to_blocklist/i,
        /::freeze/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        if (
          fnLower.includes('blacklist') ||
          fnLower.includes('block_address') ||
          fnLower.includes('freeze') ||
          fnLower.includes('ban')
        ) {
          return {
            matched: true,
            patternId: 'rugpull:blacklist:add',
            category: 'RUG_PULL',
            severity: 'HIGH',
            confidence: 0.9,
            evidence: {
              functionName: data.functionName,
              targetAddresses: data.arguments.filter(
                (arg) => typeof arg === 'string' && arg.startsWith('0x')
              ),
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Blacklist Function Called',
      description:
        'This transaction adds addresses to a blacklist, preventing them from transacting. Contracts with blacklist functionality pose rug pull risks as users can be locked out.',
      recommendation:
        'Be cautious of tokens with blacklist functionality. Verify this is legitimate anti-spam or compliance action, not malicious blocking.',
    },
  },

  // 4. Unlimited Minting Detection
  {
    id: 'rugpull:mint:unlimited',
    category: 'RUG_PULL',
    severity: 'CRITICAL',
    name: 'Unlimited Minting',
    description: 'Large token minting detected',
    matchCriteria: {
      functionPatterns: [
        /::mint/i,
        /::issue_tokens/i,
        /::create_tokens/i,
        /::increase_supply/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        if (
          fnLower.includes('mint') ||
          fnLower.includes('issue') ||
          fnLower.includes('create_token')
        ) {
          // Check for large mint amounts
          const mintAmount = data.arguments.find((arg) => {
            if (typeof arg === 'string' || typeof arg === 'number') {
              try {
                const num = BigInt(arg);
                return num > BigInt('1000000000000'); // > 1 trillion base units
              } catch {
                return false;
              }
            }
            return false;
          });

          const isLargeMint = !!mintAmount;

          return {
            matched: true,
            patternId: 'rugpull:mint:unlimited',
            category: 'RUG_PULL',
            severity: isLargeMint ? 'CRITICAL' : 'HIGH',
            confidence: isLargeMint ? 0.9 : 0.7,
            evidence: {
              functionName: data.functionName,
              isLargeMint,
              mintAmount: mintAmount ? String(mintAmount) : undefined,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Large Token Minting Detected',
      description:
        'A significant amount of tokens are being minted. Unrestricted minting can dilute token value and is a common rug pull vector.',
      recommendation:
        'Verify the minting is within expected parameters and follows the tokenomics. Check if there are minting caps or governance controls.',
    },
  },

  // 5. Emergency Withdraw / Drain
  {
    id: 'rugpull:emergency:drain',
    category: 'RUG_PULL',
    severity: 'CRITICAL',
    name: 'Emergency Drain',
    description: 'Emergency withdrawal or fund drain detected',
    matchCriteria: {
      functionPatterns: [
        /::emergency_withdraw/i,
        /::drain/i,
        /::rescue_funds/i,
        /::recover_tokens/i,
        /::sweep/i,
        /::withdraw_all/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        if (
          fnLower.includes('emergency') ||
          fnLower.includes('drain') ||
          fnLower.includes('rescue') ||
          fnLower.includes('sweep') ||
          fnLower.includes('withdraw_all')
        ) {
          return {
            matched: true,
            patternId: 'rugpull:emergency:drain',
            category: 'RUG_PULL',
            severity: 'CRITICAL',
            confidence: 0.85,
            evidence: {
              functionName: data.functionName,
              sender: data.sender,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Emergency Fund Drain Detected',
      description:
        'This transaction uses emergency withdrawal or fund recovery functions. These are high-risk operations that can drain protocol funds.',
      recommendation:
        'Verify this is a legitimate emergency action. Check if proper governance approval was obtained. Monitor for unusual fund movements.',
    },
  },

  // 6. Hidden Fee Modification
  {
    id: 'rugpull:fee:hidden_increase',
    category: 'RUG_PULL',
    severity: 'HIGH',
    name: 'Fee Modification',
    description: 'Transaction fee modification detected',
    matchCriteria: {
      functionPatterns: [
        /::set_fee/i,
        /::update_fee/i,
        /::change_fee/i,
        /::set_tax/i,
        /::modify_fee/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        if (
          fnLower.includes('fee') ||
          fnLower.includes('tax') ||
          fnLower.includes('commission')
        ) {
          // Check for high fee values (> 10%)
          const highFee = data.arguments.some((arg) => {
            if (typeof arg === 'number') {
              return arg > 1000; // > 10% in basis points
            }
            if (typeof arg === 'string') {
              const num = Number(arg);
              return !isNaN(num) && num > 1000;
            }
            return false;
          });

          return {
            matched: true,
            patternId: 'rugpull:fee:hidden_increase',
            category: 'RUG_PULL',
            severity: highFee ? 'CRITICAL' : 'HIGH',
            confidence: 0.8,
            evidence: {
              functionName: data.functionName,
              potentialHighFee: highFee,
              feeArguments: data.arguments,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Fee Modification Detected',
      description:
        'Transaction fees are being modified. Hidden or excessive fee increases can extract value from users and indicate a honeypot or rug pull.',
      recommendation:
        'Review the new fee structure. Fees above 5-10% are typically suspicious. Check if fee changes require governance approval.',
    },
  },
];

export default RUG_PULL_PATTERNS;
