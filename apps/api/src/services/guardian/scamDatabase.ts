/**
 * Scam Contract Database
 *
 * Contains known malicious addresses, function signatures, and exploit patterns
 * for Move-based chains (Movement Network, Aptos).
 *
 * Data Sources (to be populated from):
 * - Movebit security reports
 * - Verichains audits
 * - OtterSec findings
 * - Community-reported scams
 * - On-chain forensics from past exploits
 *
 * This is a critical security feature that provides immediate detection of
 * known bad actors rather than relying solely on pattern heuristics.
 */

import type { Network, RiskSeverity, RiskCategory } from '@movewatch/shared';
import type { DetectedIssue } from './types.js';
import { CONFIDENCE_LEVELS } from './utils.js';

// Known malicious address entry
export interface MaliciousAddress {
  address: string;
  network: Network | 'all';
  severity: RiskSeverity;
  category: RiskCategory;
  name: string;
  description: string;
  reportedAt: string;
  source: string;
  tags: string[];
  // Optional: specific functions to flag
  flaggedFunctions?: string[];
}

// Known malicious function signature
export interface MaliciousFunctionSignature {
  // Full function pattern: address::module::function or just module::function
  pattern: RegExp;
  severity: RiskSeverity;
  category: RiskCategory;
  name: string;
  description: string;
  tags: string[];
}

// Known exploit pattern (higher-level than function signatures)
export interface ExploitPattern {
  id: string;
  name: string;
  description: string;
  severity: RiskSeverity;
  category: RiskCategory;
  // Detection criteria
  criteria: {
    modulePatterns?: RegExp[];
    functionPatterns?: RegExp[];
    argumentPatterns?: RegExp[];
    eventPatterns?: RegExp[];
  };
  cve?: string;
  reportUrl?: string;
  tags: string[];
}

/**
 * Known Malicious Addresses Database
 *
 * NOTE: This is a starting template. In production, this should be:
 * 1. Stored in a database for easy updates
 * 2. Regularly updated from security feeds
 * 3. Sourced from verified security researchers
 * 4. Include community reporting mechanism
 */
const KNOWN_MALICIOUS_ADDRESSES: MaliciousAddress[] = [
  // Example entries - in production, populate from security feeds
  // These are PLACEHOLDER examples and should NOT be considered real scam addresses
  {
    address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    network: 'all',
    severity: 'CRITICAL',
    category: 'RUG_PULL',
    name: 'Example Honeypot',
    description: 'Example malicious address for testing purposes only.',
    reportedAt: '2024-01-01',
    source: 'Internal Testing',
    tags: ['honeypot', 'test'],
  },
];

/**
 * Known Malicious Function Signatures
 *
 * These are function name patterns commonly used in scams.
 * They are checked against the full function path.
 */
const MALICIOUS_FUNCTION_SIGNATURES: MaliciousFunctionSignature[] = [
  // Phishing patterns that impersonate legitimate protocols
  {
    pattern: /(?:pancake|uni|sushi)swap.*(?:claim|airdrop|reward)/i,
    severity: 'CRITICAL',
    category: 'RUG_PULL',
    name: 'DEX Phishing Attempt',
    description: 'Function name mimics popular DEX reward/claim functions, commonly used in phishing.',
    tags: ['phishing', 'dex-impersonation'],
  },
  {
    pattern: /(?:free|claim|get).*(?:nft|token|coin|airdrop)/i,
    severity: 'HIGH',
    category: 'RUG_PULL',
    name: 'Fake Airdrop Pattern',
    description: 'Function name suggests free token/NFT claim, commonly used in scams.',
    tags: ['airdrop-scam', 'phishing'],
  },
  {
    pattern: /emergency.*withdraw.*all/i,
    severity: 'CRITICAL',
    category: 'RUG_PULL',
    name: 'Emergency Drain Function',
    description: 'Emergency withdraw all pattern often used by malicious admins.',
    tags: ['admin-abuse', 'rug-pull'],
  },
  // Typosquatting patterns
  {
    pattern: /^0x1::(?:coin|aptos_coin).*(?:transfer|mint|burn)$/i,
    severity: 'LOW',
    category: 'PERMISSION',
    name: 'Core Module Function',
    description: 'Legitimate core framework function (not malicious).',
    tags: ['legitimate'],
  },
];

/**
 * Known Exploit Patterns
 *
 * Higher-level patterns that represent known exploit techniques.
 * These combine multiple signals to detect sophisticated attacks.
 */
const KNOWN_EXPLOIT_PATTERNS: ExploitPattern[] = [
  {
    id: 'exploit:flashloan_attack',
    name: 'Flash Loan Attack Pattern',
    description: 'Transaction pattern resembles flash loan attack: borrow, manipulate, repay in single tx.',
    severity: 'CRITICAL',
    category: 'EXPLOIT',
    criteria: {
      functionPatterns: [
        /flash.*loan|borrow.*flash/i,
      ],
      eventPatterns: [
        /flash.*borrow/i,
        /flash.*repay/i,
      ],
    },
    tags: ['flash-loan', 'defi-exploit'],
  },
  {
    id: 'exploit:price_manipulation',
    name: 'Price Manipulation Pattern',
    description: 'Transaction may be manipulating on-chain price oracles.',
    severity: 'CRITICAL',
    category: 'EXPLOIT',
    criteria: {
      functionPatterns: [
        /update.*price|set.*price|oracle.*update/i,
      ],
      eventPatterns: [
        /price.*update/i,
        /oracle.*update/i,
      ],
    },
    reportUrl: 'https://github.com/SunWeb3Sec/DeFiHackLabs',
    tags: ['oracle-manipulation', 'defi-exploit'],
  },
  {
    id: 'exploit:infinite_approval',
    name: 'Infinite Token Approval',
    description: 'Transaction requests unlimited token spending approval.',
    severity: 'HIGH',
    category: 'EXPLOIT',
    criteria: {
      functionPatterns: [
        /approve|allowance/i,
      ],
      argumentPatterns: [
        /^18446744073709551615$/, // u64::MAX
        /^340282366920938463463374607431768211455$/, // u128::MAX
      ],
    },
    tags: ['approval-exploit', 'token-drain'],
  },
  {
    id: 'exploit:ownership_transfer',
    name: 'Ownership Transfer to Attacker',
    description: 'Transaction transfers contract ownership, potentially to attacker.',
    severity: 'CRITICAL',
    category: 'RUG_PULL',
    criteria: {
      functionPatterns: [
        /transfer.*owner|set.*owner|change.*admin/i,
      ],
    },
    tags: ['ownership-hijack', 'admin-abuse'],
  },
];

/**
 * Module impersonation patterns
 * Scammers often create modules with names similar to popular protocols
 */
const MODULE_IMPERSONATION_PATTERNS: Array<{
  legitimatePattern: RegExp;
  legitimateAddresses: string[];
  description: string;
}> = [
  {
    legitimatePattern: /aptos_coin|apt_coin|AptosCoin/i,
    legitimateAddresses: ['0x1'],
    description: 'Aptos native coin module should only be at 0x1',
  },
  {
    legitimatePattern: /aptos_framework|framework/i,
    legitimateAddresses: ['0x1'],
    description: 'Aptos framework modules should only be at 0x1',
  },
  {
    legitimatePattern: /liquidswap|pontem/i,
    // Add real addresses when known
    legitimateAddresses: [],
    description: 'LiquidSwap DEX - verify correct deployment address',
  },
];

/**
 * Check if an address is in the known malicious database
 */
export function checkMaliciousAddress(
  address: string,
  network: Network
): MaliciousAddress | null {
  const normalizedAddress = address.toLowerCase();

  for (const entry of KNOWN_MALICIOUS_ADDRESSES) {
    if (entry.address.toLowerCase() === normalizedAddress) {
      if (entry.network === 'all' || entry.network === network) {
        return entry;
      }
    }
  }

  return null;
}

/**
 * Check if a function signature matches known malicious patterns
 */
export function checkMaliciousFunctionSignature(
  functionName: string
): MaliciousFunctionSignature | null {
  for (const sig of MALICIOUS_FUNCTION_SIGNATURES) {
    if (sig.pattern.test(functionName)) {
      // Skip if it's marked as legitimate
      if (sig.tags.includes('legitimate')) {
        return null;
      }
      return sig;
    }
  }

  return null;
}

/**
 * Check for known exploit patterns
 */
export function checkExploitPatterns(data: {
  functionName: string;
  arguments: unknown[];
  events?: Array<{ type: string }>;
}): ExploitPattern | null {
  for (const pattern of KNOWN_EXPLOIT_PATTERNS) {
    let matched = false;

    // Check function patterns
    if (pattern.criteria.functionPatterns) {
      for (const fp of pattern.criteria.functionPatterns) {
        if (fp.test(data.functionName)) {
          matched = true;
          break;
        }
      }
    }

    // Check argument patterns
    if (pattern.criteria.argumentPatterns && data.arguments) {
      for (const ap of pattern.criteria.argumentPatterns) {
        for (const arg of data.arguments) {
          if (typeof arg === 'string' && ap.test(arg)) {
            matched = true;
            break;
          }
        }
      }
    }

    // Check event patterns
    if (pattern.criteria.eventPatterns && data.events) {
      for (const ep of pattern.criteria.eventPatterns) {
        for (const event of data.events) {
          if (ep.test(event.type)) {
            matched = true;
            break;
          }
        }
      }
    }

    if (matched) {
      return pattern;
    }
  }

  return null;
}

/**
 * Check for module impersonation
 */
export function checkModuleImpersonation(
  moduleAddress: string,
  moduleName: string
): DetectedIssue | null {
  for (const pattern of MODULE_IMPERSONATION_PATTERNS) {
    if (pattern.legitimatePattern.test(moduleName)) {
      // Check if address is in legitimate list
      const isLegitimate = pattern.legitimateAddresses.some(
        (addr) => addr.toLowerCase() === moduleAddress.toLowerCase()
      );

      if (!isLegitimate && pattern.legitimateAddresses.length > 0) {
        return {
          patternId: 'scam_db:impersonation',
          category: 'RUG_PULL',
          severity: 'CRITICAL',
          title: 'Potential Module Impersonation',
          description: `The module name "${moduleName}" at address ${moduleAddress} may be impersonating a legitimate protocol. ${pattern.description}. Legitimate addresses: ${pattern.legitimateAddresses.join(', ')}`,
          recommendation: 'Verify the contract address matches the official protocol deployment. Check official documentation for correct addresses.',
          confidence: CONFIDENCE_LEVELS.HIGH,
          source: 'pattern' as const,
          evidence: {
            moduleAddress,
            moduleName,
            legitimateAddresses: pattern.legitimateAddresses,
            verifiedFromScamDb: true,
          },
        };
      }
    }
  }

  return null;
}

/**
 * Main function: Check all scam database entries
 */
export function checkScamDatabase(data: {
  network: Network;
  moduleAddress: string;
  moduleName: string;
  functionName: string;
  arguments: unknown[];
  events?: Array<{ type: string }>;
}): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  // 1. Check malicious addresses
  const maliciousAddr = checkMaliciousAddress(data.moduleAddress, data.network);
  if (maliciousAddr) {
    issues.push({
      patternId: `scam_db:address:${maliciousAddr.name.replace(/\s+/g, '_').toLowerCase()}`,
      category: maliciousAddr.category,
      severity: maliciousAddr.severity,
      title: `Known Malicious Address: ${maliciousAddr.name}`,
      description: `${maliciousAddr.description} Reported: ${maliciousAddr.reportedAt}. Source: ${maliciousAddr.source}`,
      recommendation: 'DO NOT interact with this address. It has been flagged as malicious.',
      confidence: CONFIDENCE_LEVELS.VERY_HIGH,
      source: 'pattern' as const,
      evidence: {
        address: data.moduleAddress,
        name: maliciousAddr.name,
        source: maliciousAddr.source,
        tags: maliciousAddr.tags,
        verifiedFromScamDb: true,
      },
    });
  }

  // 2. Check malicious function signatures
  const maliciousSig = checkMaliciousFunctionSignature(data.functionName);
  if (maliciousSig) {
    issues.push({
      patternId: `scam_db:signature:${maliciousSig.name.replace(/\s+/g, '_').toLowerCase()}`,
      category: maliciousSig.category,
      severity: maliciousSig.severity,
      title: `Suspicious Function: ${maliciousSig.name}`,
      description: maliciousSig.description,
      recommendation: 'Review this function carefully. The name pattern is commonly used in scams.',
      confidence: CONFIDENCE_LEVELS.HIGH,
      source: 'pattern' as const,
      evidence: {
        functionName: data.functionName,
        patternName: maliciousSig.name,
        tags: maliciousSig.tags,
        verifiedFromScamDb: true,
      },
    });
  }

  // 3. Check exploit patterns
  const exploitPattern = checkExploitPatterns({
    functionName: data.functionName,
    arguments: data.arguments,
    events: data.events,
  });
  if (exploitPattern) {
    issues.push({
      patternId: exploitPattern.id,
      category: exploitPattern.category,
      severity: exploitPattern.severity,
      title: `Known Exploit Pattern: ${exploitPattern.name}`,
      description: exploitPattern.description,
      recommendation: 'This transaction matches a known exploit pattern. Proceed with extreme caution.',
      confidence: CONFIDENCE_LEVELS.HIGH,
      source: 'pattern' as const,
      evidence: {
        patternId: exploitPattern.id,
        patternName: exploitPattern.name,
        tags: exploitPattern.tags,
        cve: exploitPattern.cve,
        reportUrl: exploitPattern.reportUrl,
        verifiedFromScamDb: true,
      },
    });
  }

  // 4. Check module impersonation
  const impersonationIssue = checkModuleImpersonation(data.moduleAddress, data.moduleName);
  if (impersonationIssue) {
    issues.push(impersonationIssue);
  }

  return issues;
}

/**
 * Get statistics about the scam database
 */
export function getScamDatabaseStats(): {
  totalAddresses: number;
  totalSignatures: number;
  totalExploitPatterns: number;
  totalImpersonationPatterns: number;
  lastUpdated: string;
} {
  return {
    totalAddresses: KNOWN_MALICIOUS_ADDRESSES.length,
    totalSignatures: MALICIOUS_FUNCTION_SIGNATURES.length,
    totalExploitPatterns: KNOWN_EXPLOIT_PATTERNS.length,
    totalImpersonationPatterns: MODULE_IMPERSONATION_PATTERNS.length,
    lastUpdated: new Date().toISOString(),
  };
}

export {
  KNOWN_MALICIOUS_ADDRESSES,
  MALICIOUS_FUNCTION_SIGNATURES,
  KNOWN_EXPLOIT_PATTERNS,
  MODULE_IMPERSONATION_PATTERNS,
};
