import type { RiskPatternDefinition } from '../types.js';

/**
 * Advanced Security Patterns
 * Detects: Unlimited Approvals, Proxy Patterns, Resource Destruction,
 * Cross-Contract Calls, State Change Anomalies
 */
export const ADVANCED_PATTERNS: RiskPatternDefinition[] = [
  // 1. Unlimited Token Approval Detection
  {
    id: 'advanced:approval:unlimited',
    category: 'EXPLOIT',
    severity: 'CRITICAL',
    name: 'Unlimited Token Approval',
    description: 'Unlimited token approval detected - allows spender to drain all tokens',
    matchCriteria: {
      functionPatterns: [
        /::approve/i,
        /::set_allowance/i,
        /::increase_allowance/i,
        /::grant_allowance/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        // Check if it's an approval function
        const isApprovalFunction =
          fnLower.includes('approve') ||
          fnLower.includes('allowance') ||
          fnLower.includes('delegation');

        if (!isApprovalFunction) return null;

        // Check for unlimited/max value approvals
        const MAX_U64 = BigInt('18446744073709551615');
        const MAX_U128 = BigInt('340282366920938463463374607431768211455');
        // Common "unlimited" patterns
        const UNLIMITED_PATTERNS = [
          MAX_U64,
          MAX_U128,
          BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935'), // EVM max
        ];

        let isUnlimited = false;
        let approvalAmount: string | undefined;

        for (const arg of data.arguments) {
          if (typeof arg === 'string' || typeof arg === 'number') {
            try {
              const num = BigInt(arg);
              // Check if it's close to max values (within 1%)
              for (const maxVal of UNLIMITED_PATTERNS) {
                if (num >= (maxVal * BigInt(99)) / BigInt(100)) {
                  isUnlimited = true;
                  approvalAmount = num.toString();
                  break;
                }
              }
            } catch {
              // Not a valid bigint
            }
          }
        }

        if (isUnlimited) {
          return {
            matched: true,
            patternId: 'advanced:approval:unlimited',
            category: 'EXPLOIT',
            severity: 'CRITICAL',
            confidence: 0.9,
            evidence: {
              functionName: data.functionName,
              approvalAmount,
              sender: data.sender,
              reason: 'Unlimited token approval grants full access to all tokens',
            },
          };
        }

        // Even non-unlimited approvals are worth noting
        return {
          matched: true,
          patternId: 'advanced:approval:unlimited',
          category: 'PERMISSION',
          severity: 'MEDIUM',
          confidence: 0.7,
          evidence: {
            functionName: data.functionName,
            sender: data.sender,
            reason: 'Token approval grants spending permission to another address',
          },
        };
      },
    },
    issueTemplate: {
      title: 'Token Approval Detected',
      description:
        'This transaction grants token spending permission to another address. Unlimited approvals allow the spender to transfer all your tokens at any time.',
      recommendation:
        'Only approve the exact amount needed. Use time-limited or revocable approvals when possible. Verify the spender address is trusted.',
    },
  },

  // 2. Proxy/Upgradeable Contract Interaction
  {
    id: 'advanced:proxy:interaction',
    category: 'PERMISSION',
    severity: 'HIGH',
    name: 'Proxy Contract Interaction',
    description: 'Interaction with proxy/upgradeable contract detected',
    matchCriteria: {
      functionPatterns: [
        /proxy/i,
        /::delegated_/i,
        /::forward_call/i,
        /::execute_via/i,
      ],
      modulePatterns: [
        /proxy/i,
        /upgradeable/i,
        /upgrade_policy/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionName.toLowerCase();
        const moduleLower = data.moduleAddress.toLowerCase();

        // Check for proxy patterns
        const isProxy =
          fnLower.includes('proxy') ||
          fnLower.includes('delegate') ||
          fnLower.includes('forward') ||
          moduleLower.includes('proxy') ||
          moduleLower.includes('upgradeable');

        // Check for Move's upgrade_policy module
        const isUpgradePolicy = fnLower.includes('upgrade_policy');

        if (isProxy || isUpgradePolicy) {
          return {
            matched: true,
            patternId: 'advanced:proxy:interaction',
            category: 'PERMISSION',
            severity: 'HIGH',
            confidence: 0.8,
            evidence: {
              functionName: data.functionName,
              moduleAddress: data.moduleAddress,
              isUpgradePolicy,
              reason: 'Proxy contracts can have their implementation changed',
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Proxy Contract Detected',
      description:
        'This transaction interacts with a proxy or upgradeable contract. The underlying implementation can be changed by the contract owner.',
      recommendation:
        'Verify the current implementation is trusted. Check if upgrades have a timelock. Monitor for implementation changes.',
    },
  },

  // 3. Resource Destruction Detection
  {
    id: 'advanced:resource:destruction',
    category: 'EXPLOIT',
    severity: 'HIGH',
    name: 'Resource Destruction',
    description: 'Move resource destruction or drop detected',
    matchCriteria: {
      functionPatterns: [
        /::destroy/i,
        /::delete/i,
        /::drop/i,
        /::burn_resource/i,
        /::remove_resource/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();
        const events = data.simulationResult?.events || [];

        // Check for resource destruction functions
        const destructionKeywords = [
          'destroy',
          'delete',
          'drop',
          'remove_resource',
          'burn_resource',
          'dissolve',
        ];

        const isDestruction = destructionKeywords.some((kw) =>
          fnLower.includes(kw)
        );

        // Check for destruction events
        const hasDestructionEvent = events.some((e) =>
          /destroy|delete|drop|burn/i.test(e.type)
        );

        if (isDestruction || hasDestructionEvent) {
          return {
            matched: true,
            patternId: 'advanced:resource:destruction',
            category: 'EXPLOIT',
            severity: 'HIGH',
            confidence: 0.75,
            evidence: {
              functionName: data.functionName,
              hasDestructionEvent,
              sender: data.sender,
              reason: 'Resource destruction is permanent and irreversible',
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Resource Destruction Detected',
      description:
        'This transaction permanently destroys a Move resource. Once destroyed, the resource and its data cannot be recovered.',
      recommendation:
        'Ensure this is intentional. Verify the resource should be destroyed. Consider if this affects other users.',
    },
  },

  // 4. Large Value State Changes
  {
    id: 'advanced:state:large_change',
    category: 'EXPLOIT',
    severity: 'HIGH',
    name: 'Large Value State Change',
    description: 'Unusually large value change detected in state',
    matchCriteria: {
      customMatcher: (data) => {
        const stateChanges = data.simulationResult?.stateChanges || [];

        // Look for large numeric changes in state
        const largeChanges: Array<{
          key: string;
          oldValue: string;
          newValue: string;
          changeMagnitude: string;
        }> = [];

        for (const change of stateChanges) {
          if (change.type === 'modify' && change.before && change.after) {
            try {
              // Try to extract numeric values from the change
              const oldNum = extractNumericValue(change.before);
              const newNum = extractNumericValue(change.after);

              if (oldNum !== null && newNum !== null) {
                const diff = newNum > oldNum ? newNum - oldNum : oldNum - newNum;
                // Consider large if change is > 1e18 (1 token in common decimals)
                if (diff > BigInt('1000000000000000000')) {
                  largeChanges.push({
                    key: change.resource,
                    oldValue: oldNum.toString(),
                    newValue: newNum.toString(),
                    changeMagnitude: diff.toString(),
                  });
                }
              }
            } catch {
              // Parsing failed, skip
            }
          }
        }

        if (largeChanges.length > 0) {
          return {
            matched: true,
            patternId: 'advanced:state:large_change',
            category: 'EXPLOIT',
            severity: 'HIGH',
            confidence: 0.7,
            evidence: {
              largeChanges,
              count: largeChanges.length,
              reason: 'Large value changes may indicate fund movements or exploits',
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Large Value State Change',
      description:
        'This transaction causes unusually large changes to stored values. This could indicate significant fund movements.',
      recommendation:
        'Review the state changes carefully. Verify the amounts are expected. Check for potential exploitation.',
    },
  },

  // 5. Multi-Recipient Token Transfer (Potential Airdrop Scam)
  {
    id: 'advanced:transfer:multi_recipient',
    category: 'RUG_PULL',
    severity: 'MEDIUM',
    name: 'Multi-Recipient Transfer',
    description: 'Token transfers to multiple recipients detected',
    matchCriteria: {
      functionPatterns: [
        /::batch_transfer/i,
        /::multi_transfer/i,
        /::airdrop/i,
        /::distribute/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();
        const events = data.simulationResult?.events || [];

        // Check for batch transfer patterns
        const isBatchFunction =
          fnLower.includes('batch') ||
          fnLower.includes('multi') ||
          fnLower.includes('airdrop') ||
          fnLower.includes('distribute');

        // Count transfer events
        const transferEvents = events.filter((e) =>
          /transfer|coin.*deposit|withdraw/i.test(e.type)
        );

        // Multiple transfers is suspicious
        if (isBatchFunction || transferEvents.length > 3) {
          return {
            matched: true,
            patternId: 'advanced:transfer:multi_recipient',
            category: 'RUG_PULL',
            severity: transferEvents.length > 10 ? 'HIGH' : 'MEDIUM',
            confidence: 0.65,
            evidence: {
              functionName: data.functionName,
              transferCount: transferEvents.length,
              isBatchFunction,
              reason: 'Multiple transfers could be airdrop scam or fund distribution',
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Multi-Recipient Transfer',
      description:
        'This transaction transfers tokens to multiple recipients. While this can be legitimate (airdrops, payroll), it can also be used for scams.',
      recommendation:
        'Verify the source and legitimacy of the tokens. Be cautious of unsolicited airdrops. Check if this is from a known protocol.',
    },
  },

  // 6. Module Self-Reference (Potential Callback Exploit)
  {
    id: 'advanced:callback:self_reference',
    category: 'EXPLOIT',
    severity: 'HIGH',
    name: 'Self-Referential Call',
    description: 'Module calls back to itself which may indicate reentrancy',
    matchCriteria: {
      customMatcher: (data) => {
        const events = data.simulationResult?.events || [];
        const moduleAddress = data.moduleAddress;

        // Look for events from the same module appearing multiple times
        // in a pattern that suggests re-entry
        const moduleEvents = events.filter((e) =>
          e.type.includes(moduleAddress)
        );

        // Check for alternating patterns (A -> B -> A -> B)
        if (moduleEvents.length >= 2) {
          const eventTypes = moduleEvents.map((e) => e.type);
          const uniqueTypes = [...new Set(eventTypes)];

          // If same event type appears multiple times, could be reentrancy
          const hasRepeatedEvents = eventTypes.length > uniqueTypes.length;

          if (hasRepeatedEvents) {
            return {
              matched: true,
              patternId: 'advanced:callback:self_reference',
              category: 'EXPLOIT',
              severity: 'HIGH',
              confidence: 0.6,
              evidence: {
                moduleAddress,
                eventCount: moduleEvents.length,
                uniqueEventTypes: uniqueTypes.length,
                reason: 'Repeated calls to same module may indicate reentrancy',
              },
            };
          }
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Self-Referential Call Pattern',
      description:
        'This transaction shows a pattern where the same module is called multiple times in sequence. This could indicate a reentrancy vulnerability or callback loop.',
      recommendation:
        'Review the call sequence carefully. Ensure state is properly updated before external calls. Consider using reentrancy guards.',
    },
  },

  // 7. Token Blacklist/Whitelist Operations
  {
    id: 'advanced:access:blocklist',
    category: 'RUG_PULL',
    severity: 'HIGH',
    name: 'Blocklist Operation',
    description: 'Token blacklist/whitelist modification detected',
    matchCriteria: {
      functionPatterns: [
        /::blacklist/i,
        /::whitelist/i,
        /::block_address/i,
        /::ban/i,
        /::restrict/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        const blocklistKeywords = [
          'blacklist',
          'whitelist',
          'blocklist',
          'allowlist',
          'block_address',
          'ban',
          'restrict',
          'freeze_account',
        ];

        const isBlocklistOp = blocklistKeywords.some((kw) =>
          fnLower.includes(kw)
        );

        if (isBlocklistOp) {
          // Extract the address being blocked/allowed
          const targetAddress = data.arguments.find(
            (arg) => typeof arg === 'string' && arg.startsWith('0x')
          );

          return {
            matched: true,
            patternId: 'advanced:access:blocklist',
            category: 'RUG_PULL',
            severity: 'HIGH',
            confidence: 0.85,
            evidence: {
              functionName: data.functionName,
              targetAddress,
              sender: data.sender,
              reason: 'Blocklist operations can lock user funds permanently',
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Blocklist Operation Detected',
      description:
        'This transaction modifies an address blocklist/whitelist. Blocked addresses cannot interact with the token, effectively freezing their funds.',
      recommendation:
        'Verify this is a legitimate security action. Check if you could be affected. Consider using tokens without blocklist functionality.',
    },
  },
];

/**
 * Helper to extract numeric value from various formats
 */
function extractNumericValue(value: unknown): bigint | null {
  if (typeof value === 'number') {
    return BigInt(Math.floor(value));
  }
  if (typeof value === 'string') {
    // Try direct parse
    try {
      return BigInt(value);
    } catch {
      // Try extracting numbers from string
      const match = value.match(/(\d+)/);
      if (match) {
        try {
          return BigInt(match[1]);
        } catch {
          return null;
        }
      }
    }
  }
  if (typeof value === 'object' && value !== null) {
    // Handle common object formats like { value: "123" }
    const obj = value as Record<string, unknown>;
    if ('value' in obj) {
      return extractNumericValue(obj.value);
    }
    if ('amount' in obj) {
      return extractNumericValue(obj.amount);
    }
  }
  return null;
}

export default ADVANCED_PATTERNS;
