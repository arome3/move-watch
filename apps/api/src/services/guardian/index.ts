/**
 * Guardian Risk Analyzer Service
 * AI-powered transaction security analysis for Movement Network
 *
 * Features:
 * - Pattern-based detection for known exploit patterns
 * - LLM analysis for complex/ambiguous cases
 * - x402 micropayment integration
 * - Shareable analysis results
 */

// Main analyzer functions
export {
  analyzeTransaction,
  getGuardianCheckByShareId,
} from './riskAnalyzer.js';

// Pattern matching
export {
  buildAnalysisData,
  analyzeWithPatterns,
  calculateRiskScore,
  deduplicateIssues,
} from './patternMatcher.js';

// LLM analysis
export {
  analyzeWithLLM,
  shouldUseLLM,
  calculateComplexity,
} from './llmAnalyzer.js';

// Pattern registry
export {
  ALL_PATTERNS,
  PATTERN_STATS,
  getPatternsByCategory,
  getPatternById,
  getPatternSummary,
} from './patterns/index.js';

// Demo transactions
export {
  DEMO_TRANSACTIONS,
  getDemoTransactions,
  getDemoTransactionById,
  getDemoTransactionsByCategory,
} from './demoTransactions.js';

// Scam database
export {
  checkScamDatabase,
  getScamDatabaseStats,
  KNOWN_MALICIOUS_ADDRESSES,
  MALICIOUS_FUNCTION_SIGNATURES,
  KNOWN_EXPLOIT_PATTERNS,
} from './scamDatabase.js';

// Bytecode analyzer
export {
  analyzeModuleBytecode,
  fetchModuleABI,
  verifyFunctionExists,
} from './bytecodeAnalyzer.js';

// Execution trace analyzer
export {
  analyzeExecutionTrace,
  analyzeTokenFlows,
  analyzeEventSequence,
  analyzeGasUsage,
} from './executionTraceAnalyzer.js';

// Move Prover integration (formal verification)
export {
  checkMoveProverAvailability,
  analyzeSpecAnnotations,
  generateFormalVerificationRecommendations,
  analyzeFormalVerification,
  getMoveProverInfo,
  PROVER_CATCHABLE_VULNERABILITIES,
} from './moveProverIntegration.js';

// Market data service (token price/volume context)
export {
  getTokenMarketData,
  analyzeMarketContext,
  getMarketDataStats,
  KNOWN_TOKENS,
  RISK_THRESHOLDS,
} from './marketDataService.js';

// Threat intelligence database (real attack patterns from DeFiHackLabs)
export {
  THREAT_SIGNATURES,
  ATTACK_PATTERNS,
  KNOWN_MALICIOUS_ENTITIES,
  VERIFIED_PROTOCOLS,
  getThreatSignaturesByCategory,
  getThreatSignaturesBySeverity,
  getThreatSignaturesByTag,
  isVerifiedProtocol,
  getThreatDatabaseStats,
} from './threatIntelligence.js';

// Signature & approval analyzer (Permit, setOwner, unlimited approvals)
export {
  analyzeSignatures,
  isHighRiskFunction,
  getApprovalStatistics,
} from './signatureAnalyzer.js';

// Semantic ABI analyzer (14+ Move vulnerability categories)
export {
  analyzeModuleSemantics,
  extractFunctionABIInfo,
} from './semanticAnalyzer.js';

// NEW: Red Pill attack detection
export {
  analyzeRedPillVulnerability,
  getHardenedSimulationConfig,
  fetchRealBlockchainEnvironment,
  detectRedPillPatterns,
  mightAccessEnvironment,
} from './redPillDetector.js';

// NEW: Semantic state change analyzer (what actually happens)
export {
  analyzeStateChanges,
  generateHumanReadableSummary,
  detectDrainPattern,
} from './stateChangeAnalyzer.js';

// NEW: Real-time threat feed integrator
export {
  queryThreatFeeds,
  threatFeedToIssues,
  queryMultipleAddresses,
  getThreatFeedStats,
} from './threatFeedIntegrator.js';

// NEW: Real malicious addresses from documented incidents
export {
  REAL_MALICIOUS_ADDRESSES,
  VULNERABLE_CONTRACT_PATTERNS,
  checkMaliciousAddress,
  checkVulnerablePatterns,
  maliciousAddressToIssue,
  vulnerablePatternToIssue,
  getRealDatabaseStats,
  DATABASE_DISCLAIMER,
} from './realMaliciousAddresses.js';

// ============================================================================
// NEW: Industry-Grade Static Analysis (8/10 Improvements)
// ============================================================================

// Move bytecode parser (instruction-level analysis)
export {
  analyzeModuleBytecode as analyzeModuleBytecodeAdvanced,
  getBytecodeAnalysisSummary,
  MoveOpcode,
  OPCODE_INFO,
} from './moveBytecodeParser.js';

// Privilege escalation detector (CFG-based)
export {
  analyzePrivilegeEscalation,
  isHighRiskFunctionName,
  getPrivilegeSummary,
  PRIVILEGE_PATTERNS,
  HIGH_RISK_FUNCTION_PATTERNS,
} from './privilegeEscalationDetector.js';

// Integer overflow detector (Cetus-type vulnerabilities)
export {
  analyzeIntegerOverflow,
  quickOverflowCheck,
  VULNERABLE_LIBRARIES,
  DANGEROUS_ARITHMETIC_PATTERNS,
  SAFE_PATTERNS,
} from './integerOverflowDetector.js';

// Cross-chain threat database
export {
  CROSS_CHAIN_ADDRESSES,
  PROTOCOL_VULNERABILITIES,
  checkCrossChainAddress,
  findRelatedAddresses,
  getAddressesByActorType,
  getSanctionedAddresses,
  getCrossChainDatabaseStats,
  crossChainMatchToIssue,
  searchByTags,
  getRecentIncidents,
} from './crossChainThreatDatabase.js';

// Live threat feed service
export {
  queryAllThreatFeeds,
  queryAddressBatch,
  threatFeedResponseToIssue,
  getThreatFeedStats as getLiveThreatFeedStats,
  clearThreatFeedCache,
  isSanctionedAddress,
  CACHE_TTL,
  RATE_LIMITS,
} from './liveThreatFeed.js';

// Advanced pattern detector (CFG + temporal + dataflow)
export {
  runAdvancedPatternDetection,
  detectTemporalPatterns,
  getAdvancedPatternStats,
  ADVANCED_PATTERNS,
  TEMPORAL_PATTERNS,
} from './advancedPatternDetector.js';

// Types
export type {
  AnalysisData,
  PatternMatchResult,
  RiskPatternDefinition,
  DetectedIssue,
  LLMAnalysisRequest,
  LLMAnalysisResponse,
} from './types.js';

// Additional types from new analyzers
export type {
  ThreatSignature,
  AttackPattern,
  KnownMaliciousEntity,
} from './threatIntelligence.js';

export type {
  SignatureAnalysisResult,
} from './signatureAnalyzer.js';

export type {
  MoveModuleABI,
  MoveFunctionABI,
  MoveStructABI,
} from './semanticAnalyzer.js';

// Additional types from new analyzers
export type {
  RedPillAnalysisResult,
  RedPillPattern,
  BlockchainEnvironment,
} from './redPillDetector.js';

export type {
  SemanticAnalysisResult,
  BalanceChange,
  PermissionChange,
  ResourceChange,
} from './stateChangeAnalyzer.js';

export type {
  ThreatFeedResult,
  ThreatInfo,
  HoneypotAnalysis,
} from './threatFeedIntegrator.js';

export type {
  MaliciousAddressEntry,
  VulnerableContractPattern,
} from './realMaliciousAddresses.js';

// Types from new industry-grade analyzers
export type {
  ModuleAnalysis,
  FunctionAnalysis,
  StructAnalysis,
  ControlFlowGraph,
  BasicBlock,
  ParsedInstruction,
  OverflowRisk,
} from './moveBytecodeParser.js';

export type {
  PrivilegeEscalationResult,
  PrivilegePattern,
  SignerFlowAnalysis,
  EscalationPath,
  AdminFunctionAnalysis,
} from './privilegeEscalationDetector.js';

export type {
  IntegerOverflowResult,
  VulnerableLibrary,
  ShiftOperationRisk,
  DowncastRisk,
  LoopArithmeticRisk,
  VulnerableLibraryUsage,
} from './integerOverflowDetector.js';

export type {
  CrossChainAddress,
  ProtocolVulnerability,
  SupportedChain,
  ThreatActorType,
} from './crossChainThreatDatabase.js';

export type {
  ThreatFeedResponse,
  ThreatSourceResult,
  ThreatSource,
} from './liveThreatFeed.js';

export type {
  AdvancedPattern,
  PatternContext,
  PatternMatch,
  TemporalPattern,
  DataFlowPath,
} from './advancedPatternDetector.js';

// ============================================================================
// NEW: AI-First Analysis (SmartGuard-style multi-stage AI)
// ============================================================================

// Multi-stage AI analyzer (Triage → CoT → Extended Thinking)
export {
  analyzeWithAI,
  MOVE_VULNERABILITY_KNOWLEDGE,
  SAFE_PATTERNS as AI_SAFE_PATTERNS,
  ESCALATION_THRESHOLDS,
} from './aiAnalyzer.js';

export type {
  AIAnalysisRequest,
  AIAnalysisResult,
  TriageResult,
  CoTResult,
  ExtendedResult,
} from './aiAnalyzer.js';

// Agentic analyzer (autonomous tool-use investigation)
export {
  runAgenticAnalysis,
  quickAgentCheck,
  AGENT_TOOLS,
  AGENT_SYSTEM_PROMPT,
} from './agenticAnalyzer.js';

export type {
  AgenticAnalysisRequest,
  AgenticAnalysisResult,
} from './agenticAnalyzer.js';

// Semantic similarity matcher (catches renamed/obfuscated exploits)
export {
  matchExploitSignatures,
  matchExploitSignaturesCached,
  semanticMatchesToIssues,
  quickSemanticCheck,
  extractSemanticFeatures,
  EXPLOIT_SIGNATURES,
} from './semanticMatcher.js';

export type {
  SemanticMatchResult,
  SemanticAnalysisInput,
} from './semanticMatcher.js';
