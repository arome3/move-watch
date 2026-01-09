/**
 * Agentic Security Analyzer
 *
 * Based on Anthropic Red Team's approach: AI agents that autonomously investigate
 * transactions using tools for bytecode analysis, threat lookups, and simulation.
 *
 * The agent can:
 * 1. Fetch and analyze module bytecode
 * 2. Query cross-chain threat databases
 * 3. Look up address histories
 * 4. Analyze similar transactions
 * 5. Check for known exploit patterns
 *
 * Reference: https://red.anthropic.com/2025/smart-contracts/
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock, TextBlock, ToolUseBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { DetectedIssue, AnalysisData } from './types.js';
import type { RiskSeverity } from '@movewatch/shared';
import { getMovementClient } from '../../lib/movement.js';
import { validateCategory, validateSeverity } from './utils.js';

// Import our existing analyzers as tools
import { analyzeModuleBytecode, fetchModuleABI } from './bytecodeAnalyzer.js';
import { analyzeModuleBytecode as analyzeModuleBytecodeAdvanced } from './moveBytecodeParser.js';
import { checkCrossChainAddress, findRelatedAddresses } from './crossChainThreatDatabase.js';
import { analyzeIntegerOverflow } from './integerOverflowDetector.js';
import { analyzePrivilegeEscalation } from './privilegeEscalationDetector.js';
import { checkMaliciousAddress } from './realMaliciousAddresses.js';
import { queryAllThreatFeeds } from './liveThreatFeed.js';
import type { Network } from '@movewatch/shared';

// ============================================================================
// Configuration
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const AGENT_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOOL_ITERATIONS = 5;
const AGENT_TIMEOUT_MS = 60000; // 1 minute max

// ============================================================================
// Types
// ============================================================================

export interface AgenticAnalysisRequest {
  functionName: string;
  moduleAddress: string;
  moduleName?: string;
  typeArguments: string[];
  arguments: unknown[];
  sender?: string;
  network?: Network;
  previousFindings?: DetectedIssue[];
}

export interface AgenticAnalysisResult {
  success: boolean;
  issues: DetectedIssue[];
  toolsUsed: string[];
  iterations: number;
  reasoning: string;
  rawToolResults: Record<string, unknown>;
  analysisTimeMs: number;
}

// ============================================================================
// Tool Definitions
// ============================================================================

const AGENT_TOOLS: Tool[] = [
  {
    name: 'fetch_module_abi',
    description: `Fetch the ABI (Application Binary Interface) of a Move module to understand its structure, functions, and types. Use this to analyze what functions a module exposes and what parameters they accept.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        moduleAddress: {
          type: 'string',
          description: 'The address of the module (e.g., "0x1" or full address)',
        },
        moduleName: {
          type: 'string',
          description: 'The name of the module (e.g., "coin", "aptos_coin")',
        },
      },
      required: ['moduleAddress', 'moduleName'],
    },
  },
  {
    name: 'analyze_bytecode',
    description: `Perform deep bytecode analysis on a Move module. This extracts control flow, identifies dangerous operations (shifts, arithmetic), and detects potential overflow vulnerabilities like the Cetus hack.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        moduleAddress: {
          type: 'string',
          description: 'The address of the module',
        },
        moduleName: {
          type: 'string',
          description: 'The name of the module',
        },
      },
      required: ['moduleAddress', 'moduleName'],
    },
  },
  {
    name: 'check_address_threats',
    description: `Check if an address is associated with known threats, exploits, or sanctioned entities. Queries both local databases and external threat feeds.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        address: {
          type: 'string',
          description: 'The blockchain address to check',
        },
        checkCrossChain: {
          type: 'boolean',
          description: 'Whether to check cross-chain threat databases (slower but more thorough)',
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'find_related_addresses',
    description: `Find addresses related to a given address across chains. Useful for tracking attacker wallets that may have been used in other exploits.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        address: {
          type: 'string',
          description: 'The address to find relations for',
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'analyze_overflow_risk',
    description: `Specifically analyze a module for integer overflow vulnerabilities, including the shift-based overflows that caused the $223M Cetus hack.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        moduleAddress: {
          type: 'string',
          description: 'The address of the module',
        },
        moduleName: {
          type: 'string',
          description: 'The name of the module',
        },
      },
      required: ['moduleAddress', 'moduleName'],
    },
  },
  {
    name: 'analyze_privilege_escalation',
    description: `Analyze a module for privilege escalation vulnerabilities - paths where unprivileged users could gain admin access or execute privileged operations.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        moduleAddress: {
          type: 'string',
          description: 'The address of the module',
        },
        moduleName: {
          type: 'string',
          description: 'The name of the module',
        },
      },
      required: ['moduleAddress', 'moduleName'],
    },
  },
  {
    name: 'get_transaction_history',
    description: `Get recent transaction history for an address to identify patterns like repeated interactions with known malicious contracts.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        address: {
          type: 'string',
          description: 'The address to get history for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of transactions to retrieve (default 10)',
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'conclude_analysis',
    description: `Use this when you have gathered enough information to make a final security assessment. Summarize your findings.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: {
          type: 'string',
          description: 'Summary of your security analysis',
        },
        riskLevel: {
          type: 'string',
          enum: ['SAFE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          description: 'Overall risk level',
        },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              severity: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              recommendation: { type: 'string' },
              evidence: { type: 'string' },
            },
            required: ['category', 'severity', 'title', 'description'],
          },
          description: 'List of security issues found',
        },
      },
      required: ['summary', 'riskLevel', 'issues'],
    },
  },
];

// ============================================================================
// Tool Execution
// ============================================================================

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  network: Network = 'testnet'
): Promise<string> {
  try {
    switch (toolName) {
      case 'fetch_module_abi': {
        const abi = await fetchModuleABI(
          network,
          toolInput.moduleAddress as string,
          toolInput.moduleName as string
        );
        if (!abi || !abi.abi) {
          return JSON.stringify({ error: 'Module not found or ABI unavailable' });
        }
        const moduleAbi = abi.abi;
        return JSON.stringify({
          functions: moduleAbi.exposed_functions?.map((f) => ({
            name: f.name,
            visibility: f.visibility,
            is_entry: f.is_entry,
            params: f.params,
          })),
          structs: moduleAbi.structs?.map((s) => ({
            name: s.name,
            abilities: s.abilities,
            fields: s.fields?.map((f) => f.name),
          })),
        });
      }

      case 'analyze_bytecode': {
        const analysis = await analyzeModuleBytecodeAdvanced(
          toolInput.moduleAddress as string,
          toolInput.moduleName as string,
          network
        );
        if (!analysis) {
          return JSON.stringify({ error: 'Bytecode analysis failed' });
        }
        return JSON.stringify({
          functions: analysis.functions?.length || 0,
          hasUnsafeOperations: analysis.functions?.some((f) =>
            f.instructions?.some((i) =>
              i.opcodeName === 'SHL' || i.opcodeName === 'SHR' || i.opcodeName === 'MOVE_FROM'
            )
          ),
          summary: `Analyzed ${analysis.functions?.length || 0} functions`,
        });
      }

      case 'check_address_threats': {
        const address = toolInput.address as string;
        const results: Record<string, unknown> = {};

        // Check local malicious database
        const localCheck = checkMaliciousAddress(address);
        results.localDatabase = localCheck;

        // Check cross-chain if requested
        if (toolInput.checkCrossChain) {
          const crossChain = checkCrossChainAddress(address);
          results.crossChain = crossChain;
        }

        // Query live threat feeds (if available)
        try {
          const liveFeeds = await queryAllThreatFeeds(address, network);
          results.liveFeeds = {
            isMalicious: liveFeeds.isMalicious,
            riskScore: liveFeeds.riskScore,
            sources: liveFeeds.sources?.map((s) => s.source),
          };
        } catch {
          results.liveFeeds = { error: 'Live feed query failed' };
        }

        return JSON.stringify(results);
      }

      case 'find_related_addresses': {
        const related = findRelatedAddresses(toolInput.address as string);
        return JSON.stringify({
          found: related.length,
          addresses: related.slice(0, 5), // Limit for context
        });
      }

      case 'analyze_overflow_risk': {
        const overflowResult = await analyzeIntegerOverflow(
          toolInput.moduleAddress as string,
          toolInput.moduleName as string,
          network
        );
        return JSON.stringify({
          hasOverflowRisk: overflowResult.hasOverflowRisk,
          riskLevel: overflowResult.riskLevel,
          shiftOperations: overflowResult.shiftOperations?.length || 0,
          unsafeDowncasts: overflowResult.downcastOperations?.length || 0,
          vulnerableLibraries: overflowResult.vulnerableLibraryUsage?.map((v) => v.libraryName),
        });
      }

      case 'analyze_privilege_escalation': {
        const privResult = await analyzePrivilegeEscalation(
          toolInput.moduleAddress as string,
          toolInput.moduleName as string,
          network
        );
        return JSON.stringify({
          hasEscalationRisk: privResult.hasEscalation,
          adminFunctions: privResult.adminFunctions?.map((f) => f.name),
          escalationPaths: privResult.escalationPaths?.length || 0,
        });
      }

      case 'get_transaction_history': {
        try {
          const client = getMovementClient(network);
          const transactions = await client.getAccountTransactions({
            accountAddress: toolInput.address as string,
            options: { limit: (toolInput.limit as number) || 10 },
          });

          return JSON.stringify({
            count: transactions.length,
            recent: transactions.slice(0, 5).map((tx: Record<string, unknown>) => ({
              type: tx.type,
              success: tx.success,
              function: (tx.payload as Record<string, unknown>)?.function,
            })),
          });
        } catch {
          return JSON.stringify({ error: 'Failed to fetch transaction history' });
        }
      }

      case 'conclude_analysis': {
        // This is a special tool that signals completion
        return JSON.stringify({ concluded: true, ...toolInput });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    return JSON.stringify({
      error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

// ============================================================================
// Agent System Prompt
// ============================================================================

const AGENT_SYSTEM_PROMPT = `You are a blockchain security agent investigating a Movement Network transaction for potential risks.

Your goal is to thoroughly investigate the transaction using the available tools and determine if it's safe or malicious.

## Investigation Strategy:

1. **Start with threat checks** - Check if any addresses involved are known threats
2. **Analyze the module** - If interacting with a contract, analyze its bytecode for vulnerabilities
3. **Look for overflow risks** - Especially important given the Cetus hack ($223M from shift overflow)
4. **Check privilege escalation** - Could this lead to unauthorized access?
5. **Conclude** - When you have enough information, use conclude_analysis

## Known Attack Patterns to Watch For:

- **Cetus-style overflow**: Shift operations (<<, >>) without bounds checking
- **Flash loan attacks**: Borrow → manipulate → profit → repay in one tx
- **Oracle manipulation**: Price updates immediately before swaps
- **Rug pull setup**: Admin functions, pause mechanisms, upgradeable proxies
- **Approval exploits**: Unlimited token approvals

## Important:

- Be thorough but efficient - don't call tools unnecessarily
- Cross-reference findings - multiple indicators strengthen confidence
- Consider the CONTEXT - a function called "emergency_withdraw" in a DAO is different from one in a honeypot
- When uncertain, investigate more rather than making assumptions

Use conclude_analysis when you're ready to provide your final assessment.`;

// ============================================================================
// Main Agentic Analysis
// ============================================================================

/**
 * Run agentic security analysis
 *
 * The agent autonomously investigates the transaction using available tools,
 * deciding what to analyze based on the transaction context.
 */
export async function runAgenticAnalysis(
  request: AgenticAnalysisRequest
): Promise<AgenticAnalysisResult> {
  const startTime = Date.now();
  const toolsUsed: string[] = [];
  const rawToolResults: Record<string, unknown> = {};

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      issues: [],
      toolsUsed: [],
      iterations: 0,
      reasoning: 'API key not configured',
      rawToolResults: {},
      analysisTimeMs: Date.now() - startTime,
    };
  }

  // Build initial prompt
  const initialPrompt = buildAgentPrompt(request);

  const messages: MessageParam[] = [
    { role: 'user', content: initialPrompt },
  ];

  let iterations = 0;
  let concluded = false;
  let finalResult: Record<string, unknown> | null = null;

  try {
    // Agentic loop
    while (iterations < MAX_TOOL_ITERATIONS && !concluded) {
      // Check timeout
      if (Date.now() - startTime > AGENT_TIMEOUT_MS) {
        break;
      }

      iterations++;

      const response = await anthropic.messages.create({
        model: AGENT_MODEL,
        max_tokens: 4096,
        system: AGENT_SYSTEM_PROMPT,
        tools: AGENT_TOOLS,
        messages,
      });

      // Process response
      const assistantContent: ContentBlock[] = [];
      const toolUses: ToolUseBlock[] = [];

      for (const block of response.content) {
        assistantContent.push(block);
        if (block.type === 'tool_use') {
          toolUses.push(block);
        }
      }

      // Add assistant response to messages
      messages.push({ role: 'assistant', content: assistantContent });

      // If no tool uses, we're done
      if (toolUses.length === 0) {
        break;
      }

      // Execute tools and collect results
      const toolResults: ToolResultBlockParam[] = [];

      for (const toolUse of toolUses) {
        toolsUsed.push(toolUse.name);

        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          request.network || 'testnet'
        );

        rawToolResults[`${toolUse.name}_${iterations}`] = JSON.parse(result);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });

        // Check if this was conclude_analysis
        if (toolUse.name === 'conclude_analysis') {
          concluded = true;
          finalResult = toolUse.input as Record<string, unknown>;
        }
      }

      // Add tool results to messages
      messages.push({ role: 'user', content: toolResults });

      // Check stop reason
      if (response.stop_reason === 'end_turn' && toolUses.length === 0) {
        break;
      }
    }

    // Extract issues from final result
    const issues: DetectedIssue[] = [];

    if (finalResult?.issues) {
      const issueList = finalResult.issues as Array<Record<string, unknown>>;
      for (const issue of issueList) {
        issues.push({
          patternId: `ai:agent:${(issue.category as string || 'unknown').toLowerCase()}`,
          category: validateCategory(issue.category as string),
          severity: validateSeverity(issue.severity as string),
          title: (issue.title as string) || 'Agent Finding',
          description: (issue.description as string) || '',
          recommendation: (issue.recommendation as string) || '',
          confidence: 0.85, // Agent findings have good confidence
          source: 'llm',
          evidence: issue.evidence ? { text: issue.evidence as string } : undefined,
        });
      }
    }

    return {
      success: concluded,
      issues,
      toolsUsed: [...new Set(toolsUsed)], // Deduplicate
      iterations,
      reasoning: (finalResult?.summary as string) || 'Analysis completed',
      rawToolResults,
      analysisTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Agentic analysis failed:', error);
    return {
      success: false,
      issues: [],
      toolsUsed,
      iterations,
      reasoning: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      rawToolResults,
      analysisTimeMs: Date.now() - startTime,
    };
  }
}

function buildAgentPrompt(request: AgenticAnalysisRequest): string {
  let prompt = `Investigate this Movement Network transaction for security risks:\n\n`;

  prompt += `## Transaction Details\n`;
  prompt += `- Function: ${request.functionName}\n`;
  prompt += `- Module Address: ${request.moduleAddress}\n`;
  if (request.moduleName) {
    prompt += `- Module Name: ${request.moduleName}\n`;
  }
  prompt += `- Type Arguments: ${JSON.stringify(request.typeArguments)}\n`;
  prompt += `- Arguments: ${JSON.stringify(request.arguments, null, 2)}\n`;
  if (request.sender) {
    prompt += `- Sender: ${request.sender}\n`;
  }
  prompt += `- Network: ${request.network || 'testnet'}\n`;

  if (request.previousFindings && request.previousFindings.length > 0) {
    prompt += `\n## Previous Analysis Findings\n`;
    prompt += `Pattern matching already found these issues:\n`;
    for (const finding of request.previousFindings) {
      prompt += `- [${finding.severity}] ${finding.title}: ${finding.description}\n`;
    }
    prompt += `\nInvestigate these and look for additional risks.\n`;
  }

  prompt += `\nUse the available tools to investigate thoroughly, then conclude with your assessment.`;

  return prompt;
}

// ============================================================================
// Quick Agent Check (for high-value/suspicious transactions)
// ============================================================================

/**
 * Quick agentic check for specific concerns
 *
 * This is a lighter-weight version that focuses on specific investigation tasks
 * rather than full autonomous investigation.
 */
export async function quickAgentCheck(
  request: AgenticAnalysisRequest,
  focusAreas: ('overflow' | 'privileges' | 'threats' | 'bytecode')[]
): Promise<DetectedIssue[]> {
  const issues: DetectedIssue[] = [];
  const network = request.network || 'testnet';

  // Extract module name from function if not provided
  const moduleName = request.moduleName ||
    request.functionName.split('::')[1] ||
    'unknown';

  for (const focus of focusAreas) {
    try {
      switch (focus) {
        case 'overflow': {
          const result = await analyzeIntegerOverflow(
            request.moduleAddress,
            moduleName,
            network
          );
          if (result.hasOverflowRisk) {
            issues.push({
              patternId: 'ai:quick:overflow',
              category: 'EXPLOIT',
              severity: 'CRITICAL' as RiskSeverity,
              title: 'Integer Overflow Risk Detected',
              description: `Module has ${result.shiftOperations?.length || 0} risky shift operations and ${result.downcastOperations?.length || 0} unsafe downcasts`,
              recommendation: 'Verify arithmetic operations are bounds-checked',
              confidence: 0.8,
              source: 'llm',
            });
          }
          break;
        }

        case 'privileges': {
          const result = await analyzePrivilegeEscalation(
            request.moduleAddress,
            moduleName,
            network
          );
          if (result.hasEscalation) {
            issues.push({
              patternId: 'ai:quick:privilege',
              category: 'PERMISSION',
              severity: 'HIGH' as RiskSeverity,
              title: 'Privilege Escalation Risk',
              description: `Found ${result.escalationPaths?.length || 0} potential escalation paths`,
              recommendation: 'Review access control and signer requirements',
              confidence: 0.75,
              source: 'llm',
            });
          }
          break;
        }

        case 'threats': {
          // Check module address
          const moduleCheck = checkMaliciousAddress(request.moduleAddress);
          if (moduleCheck) {
            issues.push({
              patternId: 'ai:quick:malicious',
              category: 'EXPLOIT',
              severity: 'CRITICAL' as RiskSeverity,
              title: 'Known Malicious Address',
              description: `Module address matches known malicious entity`,
              recommendation: 'Do not interact with this contract',
              confidence: 0.95,
              source: 'llm',
            });
          }

          // Check sender if provided
          if (request.sender) {
            const senderCheck = checkMaliciousAddress(request.sender);
            if (senderCheck) {
              issues.push({
                patternId: 'ai:quick:malicious-sender',
                category: 'EXPLOIT',
                severity: 'HIGH' as RiskSeverity,
                title: 'Sender Associated with Threats',
                description: 'Transaction sender matches known threat database',
                recommendation: 'Verify sender identity and intent',
                confidence: 0.9,
                source: 'llm',
              });
            }
          }
          break;
        }

        case 'bytecode': {
          const analysis = await analyzeModuleBytecodeAdvanced(
            request.moduleAddress,
            moduleName,
            network
          );
          if (analysis) {
            // Check for potential risks from bytecode analysis
            if (analysis.totalOverflowRisks > 0) {
              issues.push({
                patternId: 'ai:quick:bytecode:overflow',
                category: 'EXPLOIT',
                severity: 'HIGH' as RiskSeverity,
                title: 'Potential Overflow Operations',
                description: `Module contains ${analysis.totalOverflowRisks} operations that could potentially overflow`,
                recommendation: 'Verify arithmetic operations have proper bounds checking',
                confidence: 0.7,
                source: 'llm',
              });
            }
            if (analysis.totalResourceRisks > 0) {
              issues.push({
                patternId: 'ai:quick:bytecode:resource',
                category: 'PERMISSION',
                severity: 'MEDIUM' as RiskSeverity,
                title: 'Resource Access Patterns',
                description: `Module has ${analysis.totalResourceRisks} resource access patterns that warrant review`,
                recommendation: 'Review resource access control',
                confidence: 0.6,
                source: 'llm',
              });
            }
            if (analysis.hasPrivilegedFunctions) {
              issues.push({
                patternId: 'ai:quick:bytecode:privileged',
                category: 'PERMISSION',
                severity: 'MEDIUM' as RiskSeverity,
                title: 'Privileged Functions Detected',
                description: 'Module contains functions that require elevated permissions',
                recommendation: 'Verify signer requirements for privileged operations',
                confidence: 0.65,
                source: 'llm',
              });
            }
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Quick agent check failed for ${focus}:`, error);
    }
  }

  return issues;
}

// ============================================================================
// Exports
// ============================================================================

export { AGENT_TOOLS, AGENT_SYSTEM_PROMPT };
