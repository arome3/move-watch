import type { RiskPatternDefinition } from '../types.js';

/**
 * Permission detection patterns
 * Detects: Admin Functions, Pause Triggers, Contract Upgrades, Fee Changes
 */
export const PERMISSION_PATTERNS: RiskPatternDefinition[] = [
  // 1. Admin Function Detection
  {
    id: 'permission:admin:privileged_call',
    category: 'PERMISSION',
    severity: 'HIGH',
    name: 'Admin Function Call',
    description: 'Privileged admin function detected',
    matchCriteria: {
      functionPatterns: [
        /::set_/i,
        /::update_/i,
        /::admin_/i,
        /::configure_/i,
        /::initialize_/i,
        /::modify_/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        // Common admin function prefixes
        const adminPrefixes = [
          'set_',
          'update_',
          'admin_',
          'configure_',
          'modify_',
          'change_',
        ];

        const isAdminFunction = adminPrefixes.some((prefix) =>
          fnLower.startsWith(prefix)
        );

        // Also check for admin-like names
        const adminKeywords = [
          'admin',
          'owner',
          'governance',
          'manager',
          'operator',
          'controller',
        ];
        const hasAdminKeyword = adminKeywords.some((kw) =>
          fnLower.includes(kw)
        );

        if (isAdminFunction || hasAdminKeyword) {
          return {
            matched: true,
            patternId: 'permission:admin:privileged_call',
            category: 'PERMISSION',
            severity: 'HIGH',
            confidence: isAdminFunction ? 0.85 : 0.7,
            evidence: {
              functionName: data.functionName,
              isAdminPrefix: isAdminFunction,
              hasAdminKeyword,
              sender: data.sender,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Admin Function Detected',
      description:
        'This transaction calls an administrative function that requires elevated privileges. Admin functions can significantly alter contract behavior.',
      recommendation:
        'Verify the sender has proper admin privileges. Ensure this action is expected and authorized through proper governance.',
    },
  },

  // 2. Pause/Unpause Detection
  {
    id: 'permission:pause:toggle',
    category: 'PERMISSION',
    severity: 'MEDIUM',
    name: 'Pause Toggle',
    description: 'Contract pause state change detected',
    matchCriteria: {
      functionPatterns: [
        /::pause/i,
        /::unpause/i,
        /::freeze/i,
        /::unfreeze/i,
        /::halt/i,
        /::resume/i,
        /::stop/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        const pauseKeywords = [
          'pause',
          'unpause',
          'freeze',
          'unfreeze',
          'halt',
          'resume',
          'stop',
          'emergency_stop',
        ];

        const isPauseFunction = pauseKeywords.some((kw) =>
          fnLower.includes(kw)
        );

        if (isPauseFunction) {
          const isPausing =
            fnLower.includes('pause') ||
            fnLower.includes('freeze') ||
            fnLower.includes('halt') ||
            fnLower.includes('stop');
          const isUnpausing =
            fnLower.includes('unpause') ||
            fnLower.includes('unfreeze') ||
            fnLower.includes('resume');

          return {
            matched: true,
            patternId: 'permission:pause:toggle',
            category: 'PERMISSION',
            severity: isPausing ? 'HIGH' : 'MEDIUM',
            confidence: 0.9,
            evidence: {
              functionName: data.functionName,
              action: isPausing ? 'pausing' : isUnpausing ? 'unpausing' : 'toggle',
              sender: data.sender,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Contract Pause State Change',
      description:
        'This transaction changes the pause state of the contract. Pausing can lock user funds and prevent all interactions until unpaused.',
      recommendation:
        'Verify this is an authorized pause action. Check if this is an emergency response or routine maintenance.',
    },
  },

  // 3. Contract Upgrade Detection
  {
    id: 'permission:upgrade:contract',
    category: 'PERMISSION',
    severity: 'CRITICAL',
    name: 'Contract Upgrade',
    description: 'Contract upgrade or code change detected',
    matchCriteria: {
      functionPatterns: [
        /::upgrade/i,
        /::migrate/i,
        /::set_implementation/i,
        /::update_code/i,
        /::publish/i,
      ],
      modulePatterns: [/0x1::code/i],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        const upgradeKeywords = [
          'upgrade',
          'migrate',
          'set_implementation',
          'update_code',
          'publish_package',
          'deploy',
        ];

        const isUpgrade = upgradeKeywords.some((kw) => fnLower.includes(kw));

        // Check if calling Move code publishing module
        const isCodeModule = data.moduleAddress.includes('0x1::code');

        if (isUpgrade || isCodeModule) {
          return {
            matched: true,
            patternId: 'permission:upgrade:contract',
            category: 'PERMISSION',
            severity: 'CRITICAL',
            confidence: 0.95,
            evidence: {
              functionName: data.functionName,
              isCodeModule,
              sender: data.sender,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Contract Upgrade Detected',
      description:
        'Contract code is being upgraded or migrated. This is a critical operation that can completely change contract behavior.',
      recommendation:
        'Review the new implementation code thoroughly. Ensure proper audits have been conducted. Check governance approval.',
    },
  },

  // 4. Emergency Function Detection
  {
    id: 'permission:emergency:action',
    category: 'PERMISSION',
    severity: 'HIGH',
    name: 'Emergency Action',
    description: 'Emergency function invoked',
    matchCriteria: {
      functionPatterns: [
        /::emergency/i,
        /::urgent/i,
        /::critical/i,
        /::rescue/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        const emergencyKeywords = [
          'emergency',
          'urgent',
          'critical',
          'rescue',
          'recover',
          'salvage',
        ];

        const isEmergency = emergencyKeywords.some((kw) =>
          fnLower.includes(kw)
        );

        if (isEmergency) {
          return {
            matched: true,
            patternId: 'permission:emergency:action',
            category: 'PERMISSION',
            severity: 'HIGH',
            confidence: 0.9,
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
      title: 'Emergency Function Invoked',
      description:
        'An emergency function is being called. Emergency functions typically bypass normal checks and can make significant state changes.',
      recommendation:
        'Verify this is a legitimate emergency response. Check the context and ensure proper authorization.',
    },
  },

  // 5. Role/Permission Grant Detection
  {
    id: 'permission:role:grant',
    category: 'PERMISSION',
    severity: 'HIGH',
    name: 'Permission Grant',
    description: 'Permission or role grant detected',
    matchCriteria: {
      functionPatterns: [
        /::grant_role/i,
        /::add_role/i,
        /::set_role/i,
        /::authorize/i,
        /::add_operator/i,
        /::add_minter/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        const roleKeywords = [
          'grant_role',
          'add_role',
          'set_role',
          'authorize',
          'add_operator',
          'add_minter',
          'add_admin',
          'grant_permission',
          'add_signer',
        ];

        const isRoleGrant = roleKeywords.some((kw) => fnLower.includes(kw));

        if (isRoleGrant) {
          return {
            matched: true,
            patternId: 'permission:role:grant',
            category: 'PERMISSION',
            severity: 'HIGH',
            confidence: 0.85,
            evidence: {
              functionName: data.functionName,
              grantedTo: data.arguments.find(
                (arg) => typeof arg === 'string' && arg.startsWith('0x')
              ),
              sender: data.sender,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Permission/Role Grant Detected',
      description:
        'Permissions or roles are being granted to an address. This gives the recipient elevated privileges within the contract.',
      recommendation:
        'Verify the recipient address is trusted. Review what capabilities this role grants. Ensure proper governance approval.',
    },
  },

  // 6. Configuration Change Detection
  {
    id: 'permission:config:change',
    category: 'PERMISSION',
    severity: 'MEDIUM',
    name: 'Configuration Change',
    description: 'Protocol configuration change detected',
    matchCriteria: {
      functionPatterns: [
        /::set_config/i,
        /::update_config/i,
        /::set_param/i,
        /::configure/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        const configKeywords = [
          'set_config',
          'update_config',
          'set_param',
          'set_parameter',
          'configure',
          'set_threshold',
          'set_limit',
          'set_delay',
        ];

        const isConfigChange = configKeywords.some((kw) =>
          fnLower.includes(kw)
        );

        if (isConfigChange) {
          return {
            matched: true,
            patternId: 'permission:config:change',
            category: 'PERMISSION',
            severity: 'MEDIUM',
            confidence: 0.8,
            evidence: {
              functionName: data.functionName,
              newValues: data.arguments,
              sender: data.sender,
            },
          };
        }

        return null;
      },
    },
    issueTemplate: {
      title: 'Configuration Change Detected',
      description:
        'Protocol configuration parameters are being modified. Configuration changes can affect protocol behavior and user experience.',
      recommendation:
        'Review the new configuration values. Ensure changes are within acceptable ranges and properly authorized.',
    },
  },

  // 7. Timelock Override Detection
  {
    id: 'permission:timelock:bypass',
    category: 'PERMISSION',
    severity: 'CRITICAL',
    name: 'Timelock Bypass',
    description: 'Possible timelock bypass detected',
    matchCriteria: {
      functionPatterns: [
        /::skip_timelock/i,
        /::bypass/i,
        /::force_execute/i,
        /::immediate/i,
      ],
      customMatcher: (data) => {
        const fnLower = data.functionBaseName.toLowerCase();

        const bypassKeywords = [
          'skip_timelock',
          'bypass',
          'force_execute',
          'immediate',
          'override',
          'expedite',
        ];

        const isBypass = bypassKeywords.some((kw) => fnLower.includes(kw));

        if (isBypass) {
          return {
            matched: true,
            patternId: 'permission:timelock:bypass',
            category: 'PERMISSION',
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
      title: 'Timelock Bypass Detected',
      description:
        'This transaction appears to bypass normal timelock delays. Timelocks exist to give users time to react to governance decisions.',
      recommendation:
        'Verify this bypass is authorized for emergency situations. Check if proper governance approval was obtained.',
    },
  },
];

export default PERMISSION_PATTERNS;
