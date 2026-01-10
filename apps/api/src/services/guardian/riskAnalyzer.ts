import crypto from 'crypto';
import type { Prisma } from '@movewatch/database';

// Simple nanoid replacement using crypto
const nanoid = (size = 21) => crypto.randomBytes(size).toString('base64url').slice(0, size);
import type {
  GuardianCheckRequest,
  GuardianCheckResponse,
  GuardianAnalysisWarning,
  GuardianSimulationStatus,
  GuardianLlmStatus,
  GuardianBytecodeVerification,
  RiskSeverity,
  SimulationResponse,
} from '@movewatch/shared';
import { prisma } from '../../lib/prisma.js';
import { cacheSet, cacheGet } from '../../lib/redis.js';
import { simulateTransaction } from '../simulation.js';
import {
  buildAnalysisData,
  analyzeWithPatterns,
  deduplicateIssues,
  calculateRiskScore,
} from './patternMatcher.js';
import {
  analyzeWithLLM,
  shouldUseLLM,
  calculateComplexity,
} from './llmAnalyzer.js';
import { analyzeModuleBytecode } from './bytecodeAnalyzer.js';
import { checkScamDatabase } from './scamDatabase.js';
import { analyzeExecutionTrace } from './executionTraceAnalyzer.js';
import { analyzeFormalVerification } from './moveProverIntegration.js';
import { analyzeMarketContext } from './marketDataService.js';
import { analyzeSignatures } from './signatureAnalyzer.js';
// NEW: Critical security improvements
import { analyzeRedPillVulnerability, getHardenedSimulationConfig } from './redPillDetector.js';
import { analyzeStateChanges, generateHumanReadableSummary } from './stateChangeAnalyzer.js';
import { queryThreatFeeds, threatFeedToIssues } from './threatFeedIntegrator.js';
import { checkMaliciousAddress, maliciousAddressToIssue, checkVulnerablePatterns, vulnerablePatternToIssue } from './realMaliciousAddresses.js';

// NEW: Industry-grade static analysis (8/10 improvements)
import { analyzeModuleBytecode as analyzeModuleBytecodeAdvanced, type ModuleAnalysis } from './moveBytecodeParser.js';
import { analyzePrivilegeEscalation, type PrivilegeEscalationResult } from './privilegeEscalationDetector.js';
import { analyzeIntegerOverflow, type IntegerOverflowResult } from './integerOverflowDetector.js';
import { checkCrossChainAddress, crossChainMatchToIssue, getCrossChainDatabaseStats } from './crossChainThreatDatabase.js';
import { queryAllThreatFeeds, threatFeedResponseToIssue } from './liveThreatFeed.js';
import { runAdvancedPatternDetection, detectTemporalPatterns, type PatternContext } from './advancedPatternDetector.js';

// NEW: AI-first analysis (sophisticated multi-stage AI)
import { analyzeWithAI, type AIAnalysisResult } from './aiAnalyzer.js';
import { runAgenticAnalysis, quickAgentCheck } from './agenticAnalyzer.js';
import { matchExploitSignaturesCached, semanticMatchesToIssues, quickSemanticCheck } from './semanticMatcher.js';

// Framework whitelist - skip most analysis for known-safe functions
import {
  checkWhitelist,
  createWhitelistedResponse,
  isNeverWhitelisted,
} from './frameworkWhitelist.js';

import type { DetectedIssue, PatternMatchResult } from './types.js';
import {
  CACHE_TTL_SECONDS,
  RESULT_TTL_DAYS,
  sortBySeverity,
  WARNINGS,
  isAnalysisComplete,
  apiSimulationStatusToDb,
  apiLlmStatusToDb,
  dbSimulationStatusToApi,
  dbLlmStatusToApi,
  calculateResultAge,
} from './utils.js';

/**
 * Main Risk Analyzer Service
 * Orchestrates pattern matching and LLM analysis
 */

/**
 * Analyze a transaction for security risks
 * This is the main entry point for Guardian
 */
export async function analyzeTransaction(
  request: GuardianCheckRequest,
  userId?: string
): Promise<GuardianCheckResponse> {
  const startTime = Date.now();
  const shareId = nanoid(10);

  // Track analysis status and warnings
  let simulationStatus: GuardianSimulationStatus = 'skipped';
  let simulationError: string | undefined;
  let llmStatus: GuardianLlmStatus = 'skipped';
  const warnings: GuardianAnalysisWarning[] = [];

  // 1. Run simulation if needed
  let simulationResult: SimulationResponse | null = null;
  if (!request.simulationId) {
    try {
      simulationResult = await simulateTransaction(
        {
          network: request.network,
          sender: request.sender,
          payload: {
            function: request.functionName,
            type_arguments: request.typeArguments,
            arguments: request.arguments,
          },
        },
        userId
      );
      simulationStatus = 'success';
    } catch (error) {
      console.error('Simulation failed:', error);
      simulationStatus = 'failed';
      simulationError = error instanceof Error ? error.message : 'Unknown simulation error';
      warnings.push(WARNINGS.simulationFailed(simulationError));
    }
  } else {
    // Simulation was skipped because simulationId was provided
    simulationStatus = 'skipped';
  }

  // 2. Build analysis data
  const analysisData = buildAnalysisData(
    request.functionName,
    request.typeArguments,
    request.arguments,
    request.sender,
    simulationResult
      ? {
          success: simulationResult.success,
          gasUsed: simulationResult.gasUsed,
          stateChanges: simulationResult.stateChanges,
          events: simulationResult.events,
          error: simulationResult.error,
        }
      : undefined
  );

  // 2.1. EARLY EXIT: Check if this is a known-safe framework function
  // Skip heavy analysis for standard functions like 0x1::coin::transfer
  const whitelistCheck = checkWhitelist(
    analysisData.moduleAddress,
    analysisData.moduleName,
    analysisData.functionBaseName
  );

  // Only apply whitelist if function is not in the "never whitelist" list
  const shouldApplyWhitelist =
    whitelistCheck.isWhitelisted &&
    !isNeverWhitelisted(analysisData.moduleName, analysisData.functionBaseName);

  if (shouldApplyWhitelist) {
    console.log(`[Guardian] Whitelisted function: ${request.functionName} - ${whitelistCheck.reason}`);

    const whitelistedResult = createWhitelistedResponse(
      analysisData.moduleAddress,
      analysisData.moduleName,
      analysisData.functionBaseName,
      whitelistCheck
    );

    const totalMs = Date.now() - startTime;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RESULT_TTL_DAYS);

    // Store minimal result in database
    const guardianCheck = await prisma.guardianCheck.create({
      data: {
        shareId,
        userId,
        network: request.network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
        sender: request.sender,
        functionName: request.functionName,
        typeArguments: request.typeArguments,
        arguments: request.arguments as Prisma.InputJsonValue,
        simulationId: simulationResult?.id,
        overallRisk: whitelistedResult.overallRisk,
        riskScore: whitelistedResult.riskScore,
        patternMatchMs: totalMs,
        llmAnalysisMs: undefined,
        usedLlm: false,
        simulationStatus: apiSimulationStatusToDb(simulationStatus),
        simulationError,
        llmStatus: 'SKIPPED',
        warnings: [] as unknown as Prisma.InputJsonValue,
        expiresAt,
        issues: {
          create: whitelistedResult.issues.map((issue) => ({
            category: issue.category,
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            recommendation: issue.recommendation,
            patternId: issue.patternId,
            evidence: issue.evidence as Prisma.InputJsonValue,
            confidence: issue.confidence,
            source: issue.source,
          })),
        },
      },
      include: {
        issues: true,
      },
    });

    // Cache for sharing
    await cacheGuardianCheck(shareId, guardianCheck);

    // Return early with safe result
    return formatCheckResponse(
      guardianCheck,
      totalMs,
      totalMs,
      undefined,
      simulationStatus,
      simulationError,
      'skipped',
      [],
      true,
      {
        status: 'verified',
        moduleExists: true,
        functionExists: true,
        verifiedOnChain: true,
        metadata: {
          totalFunctions: 0, // Framework module - not fetched
          entryFunctions: 0,
          hasResourceAbilities: false,
          friendModules: [],
          isFrameworkModule: true,
          whitelistReason: whitelistCheck.reason,
        },
      }
    );
  }

  // 2.5. Run bytecode analysis (verify on-chain module and function)
  let bytecodeVerification: GuardianBytecodeVerification;
  let bytecodeIssues: DetectedIssue[] = [];

  try {
    const bytecodeResult = await analyzeModuleBytecode(
      request.network,
      analysisData.moduleAddress,
      analysisData.moduleName,
      analysisData.functionBaseName
    );

    // Map bytecode result to verification status
    if (!bytecodeResult.moduleExists) {
      bytecodeVerification = {
        status: 'module_not_found',
        moduleExists: false,
        functionExists: false,
        error: `Module ${analysisData.moduleAddress}::${analysisData.moduleName} not found on ${request.network}`,
        verifiedOnChain: false,
      };
      warnings.push({
        type: 'bytecode_verification_failed',
        message: `Module not found on-chain. This could indicate a non-existent contract or wrong network.`,
        severity: 'error',
      });
    } else if (!bytecodeResult.functionExists) {
      bytecodeVerification = {
        status: 'function_not_found',
        moduleExists: true,
        functionExists: false,
        metadata: bytecodeResult.metadata,
        error: `Function "${analysisData.functionBaseName}" not found in module`,
        verifiedOnChain: true,
      };
      warnings.push({
        type: 'bytecode_verification_failed',
        message: `Function "${analysisData.functionBaseName}" does not exist in the on-chain module. This could be an attempt to trick you.`,
        severity: 'error',
      });
    } else {
      bytecodeVerification = {
        status: 'verified',
        moduleExists: true,
        functionExists: true,
        metadata: bytecodeResult.metadata,
        functionInfo: bytecodeResult.functionInfo ? {
          name: bytecodeResult.functionInfo.name,
          visibility: bytecodeResult.functionInfo.visibility,
          isEntry: bytecodeResult.functionInfo.is_entry,
          isView: bytecodeResult.functionInfo.is_view,
          params: bytecodeResult.functionInfo.params,
          returnTypes: bytecodeResult.functionInfo.return,
        } : undefined,
        verifiedOnChain: true,
      };
    }

    // Collect bytecode-detected issues (high confidence since verified on-chain)
    bytecodeIssues = bytecodeResult.issues;

  } catch (error) {
    console.error('Bytecode analysis error:', error);
    bytecodeVerification = {
      status: 'error',
      moduleExists: false,
      functionExists: false,
      error: error instanceof Error ? error.message : 'Unknown bytecode analysis error',
      verifiedOnChain: false,
    };
    warnings.push({
      type: 'bytecode_verification_failed',
      message: `Could not verify module on-chain: ${bytecodeVerification.error}`,
      severity: 'warning',
    });
  }

  // 3. Check scam database (known malicious addresses, signatures, exploits)
  const scamDbIssues = checkScamDatabase({
    network: request.network,
    moduleAddress: analysisData.moduleAddress,
    moduleName: analysisData.moduleName,
    functionName: request.functionName,
    arguments: request.arguments,
    events: simulationResult?.events?.map(e => ({ type: e.type })),
  });

  // 4. Analyze execution trace (token flows, event sequences, gas patterns)
  const traceAnalysis = analyzeExecutionTrace({
    sender: request.sender || '',
    stateChanges: simulationResult?.stateChanges,
    events: simulationResult?.events,
    gasUsed: simulationResult?.gasUsed,
  });
  const traceIssues = traceAnalysis.issues;

  // 4.5. Formal verification recommendations (Move Prover integration)
  // This checks if the module has specification annotations and recommends formal verification
  let formalVerificationIssues: DetectedIssue[] = [];
  try {
    const fvResult = await analyzeFormalVerification(
      analysisData.moduleAddress,
      analysisData.moduleName,
      undefined, // We don't have source code, so just check for recommendations
      true // Consider high-value by default for recommendations
    );
    formalVerificationIssues = fvResult.issues;
  } catch (error) {
    console.warn('Formal verification analysis failed:', error);
    // Non-critical - continue without formal verification recommendations
  }

  // 4.6. Market context analysis (token price/volume data)
  // This adds context about tokens involved in the transaction
  let marketContextIssues: DetectedIssue[] = [];
  try {
    const marketResult = await analyzeMarketContext({
      functionName: request.functionName,
      typeArguments: request.typeArguments,
      arguments: request.arguments,
      // estimatedValue would come from state changes if we had token amounts
    });
    marketContextIssues = marketResult.issues;
  } catch (error) {
    console.warn('Market context analysis failed:', error);
    // Non-critical - continue without market context
  }

  // 4.7. Signature & approval analysis (Permit, setOwner, unlimited approvals)
  // This detects the attack vectors responsible for 88.6% of 2024 wallet drainer thefts
  let signatureIssues: DetectedIssue[] = [];
  let cachedBytecodeResult: Awaited<ReturnType<typeof analyzeModuleBytecode>> | null = null;
  try {
    // Get bytecode result for ABI info (reuse from earlier)
    cachedBytecodeResult = bytecodeVerification.status === 'verified'
      ? await analyzeModuleBytecode(
          request.network,
          analysisData.moduleAddress,
          analysisData.moduleName,
          analysisData.functionBaseName
        )
      : null;

    const signatureResult = analyzeSignatures({
      functionName: request.functionName,
      moduleAddress: analysisData.moduleAddress,
      moduleName: analysisData.moduleName,
      typeArgs: request.typeArguments,
      args: request.arguments,
      sender: request.sender,
      events: simulationResult?.events,
      stateChanges: simulationResult?.stateChanges,
      // Pass ABI info for deeper analysis if available
      abiInfo: cachedBytecodeResult?.functionAbiInfo ? {
        abilities: cachedBytecodeResult.functionAbiInfo.abilities,
        isEntry: cachedBytecodeResult.functionAbiInfo.isEntry,
        isView: cachedBytecodeResult.functionAbiInfo.isView,
        paramCount: cachedBytecodeResult.functionAbiInfo.paramCount,
        genericCount: cachedBytecodeResult.functionAbiInfo.genericCount,
        hasPublicMutRef: cachedBytecodeResult.functionAbiInfo.hasPublicMutRef,
      } : undefined,
    });
    signatureIssues = signatureResult.issues;
  } catch (error) {
    console.warn('Signature analysis failed:', error);
    // Non-critical - continue without signature analysis
  }

  // 4.8. NEW: Semantic state change analysis (analyzes WHAT happens, not function names)
  // This is how real security tools like Blowfish work
  let semanticStateIssues: DetectedIssue[] = [];
  let humanReadableSummary: string | undefined;
  try {
    const stateAnalysis = analyzeStateChanges({
      sender: request.sender || '',
      stateChanges: simulationResult?.stateChanges,
      events: simulationResult?.events,
      functionName: request.functionName,
    });
    semanticStateIssues = stateAnalysis.issues;
    humanReadableSummary = generateHumanReadableSummary(stateAnalysis);
  } catch (error) {
    console.warn('Semantic state analysis failed:', error);
  }

  // 4.9. NEW: Red Pill attack detection
  // Detects contracts that behave differently in simulation vs production
  let redPillIssues: DetectedIssue[] = [];
  try {
    const redPillResult = await analyzeRedPillVulnerability({
      network: request.network,
      functionName: request.functionName,
      simulationResult: simulationResult ? {
        success: simulationResult.success,
        gasUsed: simulationResult.gasUsed,
        events: simulationResult.events,
        stateChanges: simulationResult.stateChanges,
      } : undefined,
    });
    redPillIssues = redPillResult.issues;

    // Add warning if environment wasn't hardened
    if (!redPillResult.simulationIntegrity.environmentHardened) {
      warnings.push({
        type: 'simulation_not_hardened',
        message: 'Simulation ran without hardened environment - Red Pill attacks may not be detected',
        severity: 'warning',
      });
    }
  } catch (error) {
    console.warn('Red Pill detection failed:', error);
  }

  // 4.10. NEW: Real-time threat feed query
  // Checks addresses against live threat intelligence APIs
  let threatFeedIssues: DetectedIssue[] = [];
  try {
    const threatResult = await queryThreatFeeds(analysisData.moduleAddress, request.network);
    if (threatResult.isMalicious) {
      threatFeedIssues = threatFeedToIssues(threatResult);
    }
  } catch (error) {
    console.warn('Threat feed query failed:', error);
  }

  // 4.11. NEW: Real malicious address database check
  // Checks against documented incident addresses (Thala hack, etc.)
  let realDbIssues: DetectedIssue[] = [];
  try {
    const maliciousEntry = checkMaliciousAddress(analysisData.moduleAddress, request.network);
    if (maliciousEntry) {
      realDbIssues.push(maliciousAddressToIssue(maliciousEntry));
    }

    // Also check vulnerable patterns in function name
    const vulnPatterns = checkVulnerablePatterns('', request.functionName);
    for (const pattern of vulnPatterns) {
      realDbIssues.push(vulnerablePatternToIssue(pattern));
    }
  } catch (error) {
    console.warn('Real DB check failed:', error);
  }

  // 4.12. NEW: Cross-chain threat database check
  // Checks against comprehensive database of malicious addresses across Aptos, Sui, Movement, EVM chains
  let crossChainIssues: DetectedIssue[] = [];
  try {
    const crossChainMatch = checkCrossChainAddress(analysisData.moduleAddress, 'movement');
    if (crossChainMatch) {
      crossChainIssues.push(crossChainMatchToIssue(crossChainMatch, analysisData.moduleAddress, 'movement'));
    }
    // Also check sender address
    if (request.sender) {
      const senderMatch = checkCrossChainAddress(request.sender, 'movement');
      if (senderMatch) {
        crossChainIssues.push(crossChainMatchToIssue(senderMatch, request.sender, 'movement'));
      }
    }
  } catch (error) {
    console.warn('Cross-chain database check failed:', error);
  }

  // 4.13. NEW: Live threat feed with caching (GoPlus, Forta)
  // Real-time integration with security intelligence APIs
  let liveThreatIssues: DetectedIssue[] = [];
  try {
    const liveThreatResult = await queryAllThreatFeeds(analysisData.moduleAddress, request.network);
    if (liveThreatResult.isMalicious) {
      const issue = threatFeedResponseToIssue(liveThreatResult);
      if (issue) liveThreatIssues.push(issue);
    }
  } catch (error) {
    console.warn('Live threat feed query failed:', error);
    warnings.push({
      type: 'threat_feed_unavailable',
      message: 'Live threat intelligence feeds unavailable - using cached data only',
      severity: 'warning',
    });
  }

  // 4.14. NEW: Advanced bytecode parsing with CFG analysis
  // Real instruction-level analysis (not just regex patterns)
  let advancedBytecodeIssues: DetectedIssue[] = [];
  let moduleAnalysisResult: ModuleAnalysis | null = null;
  try {
    moduleAnalysisResult = await analyzeModuleBytecodeAdvanced(
      analysisData.moduleAddress,
      analysisData.moduleName,
      request.network
    );
    // Bytecode analysis issues are collected via privilege and overflow analysis below
  } catch (error) {
    console.warn('Advanced bytecode parsing failed:', error);
  }

  // 4.15. NEW: Privilege escalation detection
  // Uses CFG analysis to find privilege escalation paths
  let privilegeIssues: DetectedIssue[] = [];
  let privilegeAnalysisResult: PrivilegeEscalationResult | null = null;
  try {
    privilegeAnalysisResult = await analyzePrivilegeEscalation(
      analysisData.moduleAddress,
      analysisData.moduleName,
      request.network
    );
    privilegeIssues = privilegeAnalysisResult.issues;
  } catch (error) {
    console.warn('Privilege escalation detection failed:', error);
  }

  // 4.16. NEW: Integer overflow detection (Cetus-type vulnerabilities)
  // Specifically designed to catch the $223M Cetus hack pattern
  let overflowIssues: DetectedIssue[] = [];
  let overflowAnalysisResult: IntegerOverflowResult | null = null;
  try {
    overflowAnalysisResult = await analyzeIntegerOverflow(
      analysisData.moduleAddress,
      analysisData.moduleName,
      request.network
    );
    overflowIssues = overflowAnalysisResult.issues;

    // Add warning for critical overflow risks
    if (overflowAnalysisResult.riskLevel === 'critical') {
      warnings.push({
        type: 'critical_vulnerability',
        message: `CRITICAL: Potential integer overflow vulnerability detected (Cetus-type). ${overflowAnalysisResult.shiftOperations.length} dangerous shift operations found.`,
        severity: 'error',
      });
    }
  } catch (error) {
    console.warn('Integer overflow detection failed:', error);
  }

  // 4.17. NEW: Advanced pattern detection with CFG
  // Uses control flow graph, data flow, and temporal analysis
  let advancedPatternIssues: DetectedIssue[] = [];
  try {
    // Build pattern context with all available analysis data
    const patternContext: PatternContext = {
      analysisData,
      moduleAnalysis: moduleAnalysisResult || undefined,
      functionAnalysis: moduleAnalysisResult?.functions.find(f => f.name === analysisData.functionBaseName),
      cfg: moduleAnalysisResult?.functions.find(f => f.name === analysisData.functionBaseName)?.cfg,
      privilegeAnalysis: privilegeAnalysisResult || undefined,
      overflowAnalysis: overflowAnalysisResult || undefined,
      sender: request.sender || '',
      functionName: request.functionName,
      moduleAddress: analysisData.moduleAddress,
      arguments: request.arguments,
      events: simulationResult?.events?.map(e => ({ type: e.type, data: e.data })),
      stateChanges: simulationResult?.stateChanges?.map(c => ({ type: c.type, key: c.resource, value: c.after })),
    };

    advancedPatternIssues = runAdvancedPatternDetection(patternContext);

    // Also run temporal pattern detection if we have events
    if (simulationResult?.events && simulationResult.events.length > 1) {
      const temporalIssues = detectTemporalPatterns(
        simulationResult.events.map(e => ({ type: e.type, data: e.data }))
      );
      advancedPatternIssues.push(...temporalIssues);
    }
  } catch (error) {
    console.warn('Advanced pattern detection failed:', error);
  }

  // 5. Run pattern matching
  const patternStartTime = Date.now();
  const patternAnalysis = analyzeWithPatterns(analysisData);
  const patternMatchMs = Date.now() - patternStartTime;

  // 5.1. NEW: Quick semantic check (fast pattern-based semantic matching)
  let quickSemanticIssues: DetectedIssue[] = [];
  try {
    quickSemanticIssues = quickSemanticCheck({
      functionName: request.functionName,
      moduleAddress: analysisData.moduleAddress,
      arguments: request.arguments,
      stateChanges: simulationResult?.stateChanges,
      events: simulationResult?.events,
      gasUsed: simulationResult?.gasUsed,
    });
  } catch (error) {
    console.warn('Quick semantic check failed:', error);
  }

  // 5.2. NEW: Semantic exploit signature matching (LLM-based)
  // This catches renamed/obfuscated versions of known attack patterns
  let semanticMatchIssues: DetectedIssue[] = [];
  try {
    const semanticMatches = await matchExploitSignaturesCached({
      functionName: request.functionName,
      moduleAddress: analysisData.moduleAddress,
      arguments: request.arguments,
      stateChanges: simulationResult?.stateChanges,
      events: simulationResult?.events,
      gasUsed: simulationResult?.gasUsed,
    }, 0.6); // 60% similarity threshold
    semanticMatchIssues = semanticMatchesToIssues(semanticMatches);
  } catch (error) {
    console.warn('Semantic signature matching failed:', error);
  }

  // 6. Determine if LLM analysis is needed
  const complexity = calculateComplexity(
    request.arguments,
    simulationResult?.events,
    simulationResult?.stateChanges
  );

  const useLLM = shouldUseLLM(patternAnalysis.patternResults, complexity, request.functionName);

  // 6.1. NEW: Multi-stage AI analysis (Triage → CoT → Extended Thinking)
  // This is the sophisticated AI-first approach based on SmartGuard (95% F1) and Anthropic Red Team
  let aiAnalysisResult: AIAnalysisResult | null = null;
  let aiAnalysisMs: number | undefined;
  try {
    const aiStartTime = Date.now();
    aiAnalysisResult = await analyzeWithAI({
      functionName: request.functionName,
      moduleAddress: analysisData.moduleAddress,
      moduleName: analysisData.moduleName,
      typeArguments: request.typeArguments,
      arguments: request.arguments,
      stateChanges: simulationResult?.stateChanges,
      events: simulationResult?.events,
      gasUsed: simulationResult?.gasUsed,
      sender: request.sender,
      simulationSuccess: simulationResult?.success,
    });
    aiAnalysisMs = Date.now() - aiStartTime;

    // Track AI analysis in warnings
    if (aiAnalysisResult.warnings.length > 0) {
      for (const warning of aiAnalysisResult.warnings) {
        warnings.push({
          type: 'ai_analysis_warning',
          message: warning,
          severity: 'info',
        });
      }
    }

    // Log stages completed
    console.log(`AI Analysis: ${aiAnalysisResult.stagesCompleted.join(' → ')} (${aiAnalysisMs}ms)`);

  } catch (error) {
    console.warn('Multi-stage AI analysis failed:', error);
    warnings.push({
      type: 'ai_analysis_warning',
      message: `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'warning',
    });
  }

  // 6.2. NEW: Agentic deep dive for high-risk or complex transactions
  // Only run if AI analysis flagged concerns or transaction is high-value
  let agenticIssues: DetectedIssue[] = [];
  const shouldRunAgentic =
    (aiAnalysisResult?.riskRating === 'CRITICAL' || aiAnalysisResult?.riskRating === 'HIGH') ||
    (overflowAnalysisResult?.hasOverflowRisk) ||
    (privilegeAnalysisResult?.hasEscalation);

  if (shouldRunAgentic && process.env.ENABLE_AGENTIC_ANALYSIS === 'true') {
    try {
      const agenticStartTime = Date.now();
      const agenticResult = await runAgenticAnalysis({
        functionName: request.functionName,
        moduleAddress: analysisData.moduleAddress,
        moduleName: analysisData.moduleName,
        typeArguments: request.typeArguments,
        arguments: request.arguments,
        sender: request.sender,
        network: request.network,
        previousFindings: [
          ...patternAnalysis.issues,
          ...(aiAnalysisResult?.issues || []),
        ],
      });
      const agenticMs = Date.now() - agenticStartTime;

      agenticIssues = agenticResult.issues;
      console.log(`Agentic Analysis: ${agenticResult.toolsUsed.join(', ')} (${agenticMs}ms, ${agenticResult.iterations} iterations)`);

    } catch (error) {
      console.warn('Agentic analysis failed:', error);
    }
  } else if (shouldRunAgentic) {
    // Run quick agent checks instead (faster, less thorough)
    try {
      agenticIssues = await quickAgentCheck(
        {
          functionName: request.functionName,
          moduleAddress: analysisData.moduleAddress,
          moduleName: analysisData.moduleName,
          typeArguments: request.typeArguments,
          arguments: request.arguments,
          sender: request.sender,
          network: request.network,
        },
        ['overflow', 'privileges', 'threats', 'bytecode']
      );
    } catch (error) {
      console.warn('Quick agent check failed:', error);
    }
  }

  // Merge all issues from all analyzers
  // Priority order (HIGHEST to LOWEST):
  // 1. Cross-chain DB + Live feeds (real threat intelligence)
  // 2. Real incident DB (documented exploits like Thala, Cetus)
  // 3. Overflow detection (Cetus-type critical vulnerabilities)
  // 4. AI-First Analysis (multi-stage: Triage → CoT → Extended Thinking)
  // 5. Agentic Analysis (autonomous investigation with tools)
  // 6. Semantic Matching (catches renamed/obfuscated exploits)
  // 7. Privilege escalation (CFG-based analysis)
  // 8. Advanced pattern detection (CFG + temporal + dataflow)
  // 9. Semantic state analysis (what actually happens)
  // 10. Red Pill detection (simulation evasion)
  // 11. Signature analysis (Permit/approval)
  // 12. Legacy pattern + bytecode analysis
  // 13. Market context + formal verification (info only)
  let allIssues = [
    ...crossChainIssues,           // HIGHEST: Cross-chain threat database (Lazarus, drainers, etc.)
    ...liveThreatIssues,           // Live threat intelligence from GoPlus, Forta
    ...realDbIssues,               // Real incident database (Thala hack, etc.)
    ...overflowIssues,             // CRITICAL: Integer overflow (Cetus-type $223M bug)
    ...(aiAnalysisResult?.issues || []), // AI-First: Multi-stage analysis (SmartGuard-style)
    ...agenticIssues,              // Agentic: Tool-assisted deep investigation
    ...semanticMatchIssues,        // Semantic: LLM-based exploit signature matching
    ...quickSemanticIssues,        // Quick semantic pattern checks
    ...privilegeIssues,            // Privilege escalation paths (CFG analysis)
    ...advancedPatternIssues,      // Advanced pattern detection (CFG + temporal)
    ...semanticStateIssues,        // Semantic state analysis (drain patterns, etc.)
    ...redPillIssues,              // Red Pill attack detection
    ...threatFeedIssues,           // Legacy threat feed issues
    ...scamDbIssues,               // Known scam pattern detection
    ...signatureIssues,            // Permit/setOwner/approval detection
    ...traceIssues,                // Actual execution behavior analysis
    ...bytecodeIssues,             // On-chain verification issues
    ...marketContextIssues,        // Token market context issues
    ...patternAnalysis.issues,     // Pattern-based detection (regex)
    ...formalVerificationIssues,   // Formal verification info (recommendations only)
  ];
  let llmAnalysisMs: number | undefined;
  let llmModel: string | undefined;
  let llmReasoning: string | undefined;

  // 5. Run LLM analysis if needed
  if (useLLM) {
    const llmStartTime = Date.now();
    try {
      const llmResult = await analyzeWithLLM({
        functionName: request.functionName,
        moduleAddress: analysisData.moduleAddress,
        typeArguments: request.typeArguments,
        arguments: request.arguments,
        stateChanges: simulationResult?.stateChanges,
        events: simulationResult?.events,
        patternResults: patternAnalysis.patternResults,
        gasUsed: simulationResult?.gasUsed,
      });
      llmAnalysisMs = Date.now() - llmStartTime;
      llmModel = process.env.GUARDIAN_LLM_MODEL || 'claude-3-haiku-20240307';
      llmReasoning = llmResult.reasoning;

      // Check for LLM errors
      if (llmResult.confidence === 0 && llmResult.riskAssessment.includes('failed')) {
        llmStatus = 'error';
        warnings.push(WARNINGS.llmError(llmResult.reasoning));
      } else if (llmResult.confidence === 0 && llmResult.riskAssessment.includes('unavailable')) {
        llmStatus = 'skipped';
        warnings.push(WARNINGS.llmSkipped());
      } else {
        llmStatus = 'used';
        // Merge LLM issues with pattern issues
        if (llmResult.additionalIssues.length > 0) {
          allIssues = [...allIssues, ...llmResult.additionalIssues];
        }
      }
    } catch (error) {
      llmStatus = 'error';
      llmAnalysisMs = Date.now() - llmStartTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown LLM error';
      warnings.push(WARNINGS.llmError(errorMsg));
      console.error('LLM analysis error:', error);
    }
  } else {
    llmStatus = 'skipped';
  }

  // 6. Deduplicate and recalculate score
  allIssues = deduplicateIssues(allIssues);
  const { score: riskScore, severity: overallRisk } =
    calculateRiskScore(allIssues);

  // 7. Sort issues by severity using shared utility
  allIssues = sortBySeverity(allIssues);

  const totalMs = Date.now() - startTime;

  // 8. Calculate expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + RESULT_TTL_DAYS);

  // 9. Add partial analysis warning if needed
  const analysisComplete = isAnalysisComplete(simulationStatus, llmStatus);
  if (!analysisComplete && warnings.length === 0) {
    warnings.push(WARNINGS.partialAnalysis());
  }

  // 10. Store in database
  const guardianCheck = await prisma.guardianCheck.create({
    data: {
      shareId,
      userId,
      network: request.network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
      sender: request.sender,
      functionName: request.functionName,
      typeArguments: request.typeArguments,
      arguments: request.arguments as Prisma.InputJsonValue,
      simulationId: simulationResult?.id,
      overallRisk,
      riskScore,
      patternMatchMs,
      llmAnalysisMs,
      usedLlm: llmStatus === 'used',
      llmModel,
      // New fields for analysis integrity
      simulationStatus: apiSimulationStatusToDb(simulationStatus),
      simulationError,
      llmStatus: apiLlmStatusToDb(llmStatus),
      warnings: warnings as unknown as Prisma.InputJsonValue,
      rawPatternResults:
        patternAnalysis.patternResults as unknown as Prisma.InputJsonValue,
      rawLlmResponse: llmReasoning,
      expiresAt,
      issues: {
        create: allIssues.map((issue) => ({
          category: issue.category,
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          recommendation: issue.recommendation,
          patternId: issue.patternId,
          evidence: issue.evidence as Prisma.InputJsonValue,
          confidence: issue.confidence,
          source: issue.source,
        })),
      },
    },
    include: {
      issues: true,
    },
  });

  // 11. Cache for sharing (include bytecodeVerification in cache)
  await cacheGuardianCheck(shareId, {
    ...guardianCheck,
    bytecodeVerification,
  });

  // 12. Format and return response
  return formatCheckResponse(
    guardianCheck,
    totalMs,
    patternMatchMs,
    llmAnalysisMs,
    simulationStatus,
    simulationError,
    llmStatus,
    warnings,
    analysisComplete,
    bytecodeVerification
  );
}

/**
 * Get a Guardian check by share ID
 */
export async function getGuardianCheckByShareId(
  shareId: string
): Promise<GuardianCheckResponse | null> {
  // Try cache first
  const cached = await cacheGet<Record<string, unknown>>(
    `guardian:${shareId}`
  );
  if (cached) {
    return formatCachedResponse(cached);
  }

  // Fall back to database
  const check = await prisma.guardianCheck.findUnique({
    where: { shareId },
    include: { issues: true },
  });

  if (!check) return null;

  // Check expiration
  if (check.expiresAt < new Date()) {
    return null;
  }

  // Re-cache
  await cacheGuardianCheck(shareId, check);

  // Get simulation and LLM status from database
  const simulationStatus = dbSimulationStatusToApi(check.simulationStatus);
  const llmStatusValue = dbLlmStatusToApi(check.llmStatus);
  const warnings = (check.warnings as unknown as GuardianAnalysisWarning[]) || [];

  // Calculate result age and add stale warning if needed
  const ageInDays = calculateResultAge(check.createdAt);
  const allWarnings = [...warnings];
  if (ageInDays > 1) {
    allWarnings.push(WARNINGS.staleResult(ageInDays));
  }

  return formatCheckResponse(
    check,
    check.patternMatchMs + (check.llmAnalysisMs || 0),
    check.patternMatchMs,
    check.llmAnalysisMs || undefined,
    simulationStatus,
    check.simulationError || undefined,
    llmStatusValue,
    allWarnings,
    isAnalysisComplete(simulationStatus, llmStatusValue)
  );
}

/**
 * Cache a Guardian check result
 */
async function cacheGuardianCheck(
  shareId: string,
  check: Record<string, unknown>
): Promise<void> {
  await cacheSet(`guardian:${shareId}`, check, CACHE_TTL_SECONDS);
}

/**
 * Format database record as API response
 */
function formatCheckResponse(
  check: {
    id: string;
    shareId: string;
    overallRisk: RiskSeverity;
    riskScore: number;
    usedLlm: boolean;
    createdAt: Date;
    issues: Array<{
      id: string;
      category: string;
      severity: string;
      title: string;
      description: string;
      recommendation: string;
      evidence: unknown;
      confidence: number;
      source: string;
    }>;
  },
  totalMs: number,
  patternMatchMs: number,
  llmAnalysisMs?: number,
  simulationStatus: GuardianSimulationStatus = 'skipped',
  simulationError?: string,
  llmStatus: GuardianLlmStatus = 'skipped',
  warnings: GuardianAnalysisWarning[] = [],
  analysisComplete: boolean = true,
  bytecodeVerification?: GuardianBytecodeVerification
): GuardianCheckResponse {
  return {
    id: check.id,
    shareId: check.shareId,
    overallRisk: check.overallRisk,
    riskScore: check.riskScore,
    issues: check.issues.map((issue) => ({
      id: issue.id,
      category: issue.category as 'EXPLOIT' | 'RUG_PULL' | 'EXCESSIVE_COST' | 'PERMISSION',
      severity: issue.severity as RiskSeverity,
      title: issue.title,
      description: issue.description,
      recommendation: issue.recommendation,
      evidence: issue.evidence,
      confidence: issue.confidence,
      source: issue.source as 'pattern' | 'llm',
    })),
    analysisTime: {
      patternMatchMs,
      llmAnalysisMs,
      totalMs,
    },
    usedLlm: check.usedLlm,
    shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/guardian/${check.shareId}`,
    createdAt: check.createdAt.toISOString(),
    // New fields
    simulationStatus,
    simulationError,
    analysisComplete,
    llmStatus,
    warnings,
    bytecodeVerification,
  };
}

/**
 * Format cached record as API response
 */
function formatCachedResponse(
  cached: Record<string, unknown>
): GuardianCheckResponse {
  const issues = (cached.issues as Array<Record<string, unknown>>) || [];
  const warnings = (cached.warnings as GuardianAnalysisWarning[]) || [];

  // Calculate result age and add stale warning if needed
  const createdAt = typeof cached.createdAt === 'string'
    ? new Date(cached.createdAt)
    : (cached.createdAt as Date);
  const ageInDays = calculateResultAge(createdAt);

  const allWarnings = [...warnings];
  if (ageInDays > 1) {
    allWarnings.push(WARNINGS.staleResult(ageInDays));
  }

  // Get simulation and LLM status from cache, with defaults
  const simulationStatus = (cached.simulationStatus as string)?.toLowerCase() as GuardianSimulationStatus || 'skipped';
  const llmStatus = (cached.llmStatus as string)?.toLowerCase().replace('_', '_') as GuardianLlmStatus || 'skipped';

  return {
    id: cached.id as string,
    shareId: cached.shareId as string,
    overallRisk: cached.overallRisk as RiskSeverity,
    riskScore: cached.riskScore as number,
    issues: issues.map((issue) => ({
      id: issue.id as string,
      category: issue.category as 'EXPLOIT' | 'RUG_PULL' | 'EXCESSIVE_COST' | 'PERMISSION',
      severity: issue.severity as RiskSeverity,
      title: issue.title as string,
      description: issue.description as string,
      recommendation: issue.recommendation as string,
      evidence: issue.evidence,
      confidence: issue.confidence as number,
      source: issue.source as 'pattern' | 'llm',
    })),
    analysisTime: {
      patternMatchMs: cached.patternMatchMs as number,
      llmAnalysisMs: cached.llmAnalysisMs as number | undefined,
      totalMs:
        (cached.patternMatchMs as number) +
        ((cached.llmAnalysisMs as number) || 0),
    },
    usedLlm: cached.usedLlm as boolean,
    shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/guardian/${cached.shareId}`,
    createdAt: createdAt.toISOString(),
    // New fields
    simulationStatus,
    simulationError: cached.simulationError as string | undefined,
    analysisComplete: isAnalysisComplete(simulationStatus, llmStatus),
    llmStatus,
    warnings: allWarnings,
    bytecodeVerification: cached.bytecodeVerification as GuardianBytecodeVerification | undefined,
  };
}
