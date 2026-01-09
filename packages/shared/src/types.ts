// Network types
export type Network = 'mainnet' | 'testnet' | 'devnet';

// Simulation Request - Enhanced with fork capabilities
export interface SimulationRequest {
  network: Network;
  sender?: string;
  senderPublicKey?: string; // Hex-encoded Ed25519 public key (for simulating with user's account)
  payload: {
    function: string; // e.g., "0x1::coin::transfer"
    type_arguments: string[];
    arguments: unknown[];
  };
  options?: {
    max_gas_amount?: number;
    gas_unit_price?: number;
    // Fork simulation options
    ledger_version?: string;        // Simulate at specific ledger version (historical state)
    state_overrides?: StateOverride[]; // Override account state for testing
  };
}

// State override for fork simulation
export interface StateOverride {
  address: string;
  resource_type: string;           // e.g., "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
  data: Record<string, unknown>;   // Resource data to override
}

// Fork simulation metadata
export interface ForkMetadata {
  forkedFrom: Network;
  ledgerVersion: string;
  ledgerTimestamp: string;
  stateOverrides?: number;        // Number of state overrides applied
}

// Simulation Response - Enhanced with debugging capabilities
export interface SimulationResponse {
  id: string;
  shareId: string;
  success: boolean;
  gasUsed?: number;
  gasBreakdown?: GasBreakdown;
  stateChanges?: StateChange[];
  events?: SimulationEvent[];
  error?: SimulationError;
  shareUrl: string;
  // Additional fields for shared simulation view (populated on GET /sim/:shareId)
  network?: Network;
  functionName?: string;
  typeArguments?: string[];
  arguments?: unknown[];
  sender?: string;
  createdAt?: string;
  expiresAt?: string;
  // Enhanced debugging fields
  executionTrace?: ExecutionTrace;
  warnings?: SimulationWarning[];
  recommendations?: string[];
  // Fork simulation metadata
  forkMetadata?: ForkMetadata;
  // Human-readable transaction explanation
  explanation?: TransactionExplanation;
}

// Human-readable transaction explanation
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

// Execution trace showing the flow of the transaction
export interface ExecutionTrace {
  entryFunction: string;
  totalGas: number;
  executionTimeEstimateMs?: number;
  steps: ExecutionStep[];
  callGraph?: CallGraphNode;
  // Trace source metadata - indicates data quality
  traceSource?: {
    type: 'cli_profile' | 'api_reconstructed';  // cli_profile = real, api_reconstructed = approximated
    isApproximated: boolean;                     // true if gas per step is estimated
    message?: string;                            // User-facing explanation
  };
}

// Individual execution step
export interface ExecutionStep {
  index: number;
  type: ExecutionStepType;
  module: string;
  function?: string;
  description: string;
  gasUsed: number;
  cumulativeGas: number;
  data?: unknown;           // Step-specific data (e.g., event data, resource data)
  children?: ExecutionStep[];
}

// Types of execution steps
export type ExecutionStepType =
  | 'FUNCTION_CALL'
  | 'RESOURCE_READ'
  | 'RESOURCE_WRITE'
  | 'RESOURCE_CREATE'
  | 'RESOURCE_DELETE'
  | 'EVENT_EMIT'
  | 'ASSERTION'
  | 'ABORT';

// Call graph node for visualization
export interface CallGraphNode {
  module: string;
  function: string;
  gasUsed: number;
  percentage: number;
  children: CallGraphNode[];
}

// Simulation warning (non-fatal issues)
export interface SimulationWarning {
  code: string;
  severity: 'info' | 'warning' | 'caution';
  message: string;
  details?: string;
}

// Gas Breakdown - Enhanced with per-operation details
export interface GasBreakdown {
  total: number;
  computation: number;
  storage: number;
  // Per-operation breakdown (when available)
  operations?: GasOperation[];
  // By category
  byCategory?: {
    execution: number;      // VM execution
    io: number;             // Read/write operations
    storage: number;        // Storage allocation/deallocation
    intrinsic: number;      // Base transaction cost
    dependencies: number;   // Module loading
  };
  // Enhanced gas estimation with confidence
  estimate?: GasEstimate;
  // Gas optimization suggestions
  optimizations?: GasOptimization[];
  // Efficiency score compared to similar transactions
  efficiencyScore?: GasEfficiencyScore;
  // Storage cost projections
  storageCosts?: StorageCostProjection;
}

// Gas estimate with confidence intervals
export interface GasEstimate {
  predicted: number;           // Best estimate
  lower: number;              // Lower bound (95% confidence)
  upper: number;              // Upper bound (95% confidence)
  confidence: number;         // Confidence level (0-1)
  methodology: 'static' | 'historical' | 'ml';  // How estimate was calculated
  factors: string[];          // Factors affecting uncertainty
}

// Gas optimization suggestion
export interface GasOptimization {
  id: string;
  category: 'storage' | 'computation' | 'io' | 'pattern';
  severity: 'info' | 'suggestion' | 'warning';
  title: string;
  description: string;
  potentialSavings?: number;           // Estimated gas savings
  potentialSavingsPercent?: number;    // As percentage of total
  codeLocation?: {
    module: string;
    operation: string;
  };
  recommendation: string;
}

// Gas efficiency score
export interface GasEfficiencyScore {
  score: number;              // 0-100 (100 = most efficient)
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  comparison: {
    percentile: number;       // How this compares to similar txns (e.g., top 25%)
    averageForType: number;   // Average gas for this function type
    medianForType: number;    // Median gas for this function type
    sampleSize?: number;      // Number of transactions used for comparison
    isEstimate?: boolean;     // True if using fallback estimates (no real data available)
  };
  breakdown: {
    computeEfficiency: number;   // 0-100
    storageEfficiency: number;   // 0-100
    ioEfficiency: number;        // 0-100
  };
}

// Storage cost projection
export interface StorageCostProjection {
  allocationCost: number;     // Cost of new storage allocation (in gas)
  allocationCostMove: string; // Cost in MOVE tokens
  deallocationRefund: number; // Potential refund from cleanup (in gas)
  deallocationRefundMove: string;
  netStorageCost: number;     // Net storage impact
  newResourcesCreated: number;
  resourcesDeleted: number;
  bytesAllocated: number;
  bytesFreed: number;
}

// Individual gas operation
export interface GasOperation {
  operation: string;        // e.g., "call", "load_resource", "write_resource"
  module?: string;          // Module being called
  function?: string;        // Function name
  gasUsed: number;
  percentage: number;       // Percentage of total gas
  depth: number;            // Call stack depth (for hierarchy)
}

// State Change with human-readable diff support
export interface StateChange {
  type: 'create' | 'modify' | 'delete';
  resource: string;
  address: string;
  before?: unknown;
  after?: unknown;
  // Human-readable diff for display
  diff?: StateChangeDiff;
}

// Human-readable diff for state changes
export interface StateChangeDiff {
  summary: string;  // e.g., "Balance: 1,000 APT → 999 APT (-1 APT)"
  fields: FieldDiff[];
}

export interface FieldDiff {
  path: string;       // e.g., "coin.value"
  label: string;      // Human-readable label, e.g., "Balance"
  before?: string;    // Formatted value
  after?: string;     // Formatted value
  change?: string;    // e.g., "-1,000" or "+500"
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
}

// Simulation Event
export interface SimulationEvent {
  type: string;
  data: unknown;
  sequenceNumber: number;
}

// Simulation Error - Enhanced with detailed debugging info
export interface SimulationError {
  code: string;
  message: string;
  vmStatus: string;
  suggestion?: string;
  // Enhanced debugging fields
  decoded?: DecodedError;
  stackTrace?: StackFrame[];
  failurePoint?: FailurePoint;
}

// Decoded Move error with module-specific context
export interface DecodedError {
  moduleAddress: string;
  moduleName: string;
  abortCode?: number;         // Numeric abort code from Move
  errorName?: string;         // Human-readable error name (e.g., "EINSUFFICIENT_BALANCE")
  errorDescription?: string;  // Detailed description of the error
  category: ErrorCategory;
  sourceLocation?: {
    module: string;
    function: string;
    line?: number;            // If source map available
  };
}

// Error categories for classification
export type ErrorCategory =
  | 'AUTHENTICATION'    // Auth key, signature issues
  | 'AUTHORIZATION'     // Permission, ownership issues
  | 'RESOURCE'          // Resource existence, state issues
  | 'BALANCE'           // Insufficient funds
  | 'ARGUMENT'          // Invalid arguments
  | 'STATE'             // Invalid state transitions
  | 'LIMIT'             // Exceeds limits
  | 'MODULE'            // Module/function not found
  | 'GAS'               // Out of gas
  | 'ABORT'             // Generic Move abort
  | 'UNKNOWN';

// Stack frame for execution trace
export interface StackFrame {
  depth: number;
  moduleAddress: string;
  moduleName: string;
  functionName: string;
  typeArguments?: string[];
  gasAtEntry?: number;
  gasAtExit?: number;
  status: 'completed' | 'aborted' | 'in_progress';
}

// Point of failure in execution
export interface FailurePoint {
  moduleAddress: string;
  moduleName: string;
  functionName: string;
  instruction?: string;       // VM instruction that failed
  gasConsumedBeforeFailure: number;
}

// Shared Simulation (for GET /sim/:shareId)
export interface SharedSimulation {
  id: string;
  shareId: string;
  network: Network;
  functionName: string;
  typeArguments: string[];
  arguments: unknown[];
  success: boolean;
  gasUsed?: number;
  gasBreakdown?: GasBreakdown;
  stateChanges?: StateChange[];
  events?: SimulationEvent[];
  executionTrace?: ExecutionTrace;
  error?: SimulationError;
  createdAt: string;
  expiresAt: string;
}

// API Error Response
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// User Tier (for future auth)
export type Tier = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';

// ============================================================================
// ALERTS SYSTEM TYPES
// ============================================================================

// Alert condition types
export type AlertConditionType =
  | 'tx_failed'
  | 'balance_threshold'
  | 'event_emitted'
  | 'gas_spike'
  | 'function_call'
  | 'token_transfer'
  | 'large_transaction';

// Notification channel types
export type ChannelType = 'discord' | 'slack' | 'telegram' | 'webhook' | 'email' | 'action';

// Threshold comparison operators
export type ThresholdOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte';

// ============================================================================
// CONDITION CONFIGURATIONS
// ============================================================================

// Failed transaction condition
export interface TxFailedCondition {
  type: 'tx_failed';
  moduleAddress: string;
  functionName?: string;
}

// Balance threshold condition
export interface BalanceThresholdCondition {
  type: 'balance_threshold';
  address: string;
  tokenType: string;
  threshold: string; // BigInt as string for precision
  operator: ThresholdOperator;
}

// Event emitted condition
export interface EventEmittedCondition {
  type: 'event_emitted';
  eventType: string;
  filters?: Record<string, unknown>;
}

// Gas spike condition
export interface GasSpikeCondition {
  type: 'gas_spike';
  moduleAddress: string;
  thresholdMultiplier: number; // e.g., 2.0 = 2x average
}

// Function call condition - triggers when a specific function is invoked
export interface FunctionCallCondition {
  type: 'function_call';
  moduleAddress: string;
  moduleName: string;
  functionName: string;
  trackSuccess?: boolean;  // Default true - track successful calls
  trackFailed?: boolean;   // Default false - also track failed calls
  filters?: {
    sender?: string;       // Filter by sender address
    minGas?: number;       // Minimum gas used
  };
}

// Token transfer condition - monitors coin/token movements
export interface TokenTransferCondition {
  type: 'token_transfer';
  tokenType: string;         // e.g., "0x1::aptos_coin::AptosCoin"
  direction: 'in' | 'out' | 'both';
  address: string;           // Address to monitor
  minAmount?: string;        // Minimum transfer amount (BigInt as string)
  maxAmount?: string;        // Maximum transfer amount
}

// Large transaction condition - alerts on high-value transfers
export interface LargeTransactionCondition {
  type: 'large_transaction';
  tokenType: string;         // Token to monitor
  threshold: string;         // Minimum amount to trigger (BigInt as string)
  addresses?: string[];      // Optional: only monitor specific addresses
}

// Union type for all conditions
export type AlertCondition =
  | TxFailedCondition
  | BalanceThresholdCondition
  | EventEmittedCondition
  | GasSpikeCondition
  | FunctionCallCondition
  | TokenTransferCondition
  | LargeTransactionCondition;

// ============================================================================
// CHANNEL CONFIGURATIONS
// ============================================================================

// Discord webhook configuration
export interface DiscordChannelConfig {
  webhookUrl: string;
}

// Slack webhook configuration
export interface SlackChannelConfig {
  webhookUrl: string;
}

// Telegram bot configuration
export interface TelegramChannelConfig {
  botToken: string;
  chatId: string;
}

// Custom webhook configuration
export interface WebhookChannelConfig {
  url: string;
  authHeader?: string;
  authValue?: string;
}

// Email notification configuration
export interface EmailChannelConfig {
  email: string;
}

// Action execution channel configuration
// Allows alerts to trigger serverless actions
export interface ActionChannelConfig {
  actionId: string;      // The action to execute
  actionName?: string;   // Action name for display (populated on fetch)
  passAlertData?: boolean; // Pass alert/event data to action context (default: true)
}

// Union type for all channel configs
export type ChannelConfig =
  | { type: 'discord'; config: DiscordChannelConfig }
  | { type: 'slack'; config: SlackChannelConfig }
  | { type: 'telegram'; config: TelegramChannelConfig }
  | { type: 'webhook'; config: WebhookChannelConfig }
  | { type: 'email'; config: EmailChannelConfig }
  | { type: 'action'; config: ActionChannelConfig };

// ============================================================================
// ALERT API REQUEST/RESPONSE TYPES
// ============================================================================

// Create alert request - now uses channelIds to reference existing channels
export interface CreateAlertRequest {
  name: string;
  network?: Network;
  condition: AlertCondition;
  channelIds: string[];  // References to existing NotificationChannel IDs
  cooldownSeconds?: number;
}

// Update alert request
export interface UpdateAlertRequest {
  name?: string;
  enabled?: boolean;
  network?: Network;
  condition?: AlertCondition;
  channelIds?: string[];  // References to existing NotificationChannel IDs
  cooldownSeconds?: number;
}

// Alert response (list and detail)
export interface AlertResponse {
  id: string;
  name: string;
  enabled: boolean;
  network: Network;
  conditionType: AlertConditionType;
  conditionConfig: AlertCondition;
  channels: Array<{
    id: string;
    name: string;  // Channel name for display
    type: ChannelType;
    configured: boolean;
    enabled: boolean;  // Per-alert enable/disable
  }>;
  cooldownSeconds: number;
  lastTriggeredAt: string | null;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// NOTIFICATION CHANNEL TYPES (Standalone, reusable across alerts)
// ============================================================================

// Notification channel response
export interface NotificationChannelResponse {
  id: string;
  name: string;
  type: ChannelType;
  config: ChannelConfig['config'];  // Channel-specific config (without type discriminator)
  alertCount: number;
  createdAt: string;
  updatedAt: string;
}

// Create notification channel request
export interface CreateNotificationChannelRequest {
  name: string;
  type: ChannelType;
  config: ChannelConfig['config'];
}

// Update notification channel request
export interface UpdateNotificationChannelRequest {
  name?: string;
  config?: ChannelConfig['config'];
}

// Notification channels list response
export interface NotificationChannelsListResponse {
  channels: NotificationChannelResponse[];
  total: number;
}

// Alert trigger response
export interface AlertTriggerResponse {
  id: string;
  eventData: unknown;
  transactionHash: string | null;
  notificationsSent: ChannelType[];
  notificationErrors?: Record<string, string>;
  triggeredAt: string;
}

// Paginated triggers response
export interface AlertTriggersResponse {
  triggers: AlertTriggerResponse[];
  total: number;
  limit: number;
  offset: number;
}

// Test notification result
export interface TestNotificationResult {
  channel: ChannelType;
  success: boolean;
  latencyMs?: number;
  error?: string;
}

// Parsed error information for failed transactions
export interface ParsedErrorInfo {
  code: string;
  name: string;
  description: string;
  category: string;
  suggestion: string;
}

// Notification payload (internal use)
export interface NotificationPayload {
  alertId: string;
  alertName: string;
  conditionType: AlertConditionType;
  eventType: string;
  eventData: unknown;
  transactionHash: string | null;
  timestamp: string;
  link: string;
  // Enhanced error information for failed transactions
  errorInfo?: ParsedErrorInfo;
}

// ============================================================================
// MONITORING DASHBOARD TYPES
// ============================================================================

// Dashboard time period selection
export type DashboardPeriod = '24h' | '7d' | '30d';

// Dashboard overview statistics
export interface DashboardStats {
  period: DashboardPeriod;
  transactions: {
    total: number;
    success: number;
    failed: number;
    successRate: number;
    trend: number; // percentage change from previous period
  };
  gas: {
    total: number;
    average: number;
    p95: number;
    trend: number; // percentage change from previous period
  };
  alerts: {
    active: number;
    triggered: number;
  };
}

// Transaction list item (for table view)
export interface TransactionListItem {
  hash: string;
  version: string;
  network: Network;
  moduleAddress: string;
  functionName: string;
  success: boolean;
  vmStatus?: string;
  gasUsed: number;
  sender: string;
  timestamp: string;
}

// Transaction detail (for expanded view)
export interface TransactionDetail extends TransactionListItem {
  sequenceNumber: number;
  events: EventListItem[];
}

// Event list item
export interface EventListItem {
  eventType: string;
  data: unknown;
  sequenceNumber: number;
  timestamp: string;
  transactionHash?: string;
}

// Gas analytics data
export interface GasAnalytics {
  period: DashboardPeriod;
  dataPoints: Array<{
    timestamp: string;
    average: number;
    min: number;
    max: number;
    count: number;
  }>;
  stats: {
    min: number;
    max: number;
    average: number;
    p95: number;
    total: number;
  };
  byFunction: Array<{
    functionName: string;
    moduleAddress: string;
    totalGas: number;
    avgGas: number;
    count: number;
  }>;
  anomalies: Array<{
    timestamp: string;
    gasUsed: number;
    transactionHash: string;
    functionName: string;
  }>;
}

// ============================================================================
// WATCHED CONTRACT TYPES
// ============================================================================

// Watched contract response
export interface WatchedContractResponse {
  id: string;
  moduleAddress: string;
  name: string | null;
  network: Network;
  createdAt: string;
  updatedAt: string;
}

// Create watched contract request
export interface CreateWatchedContractRequest {
  moduleAddress: string;
  name?: string;
  network: Network;
}

// ============================================================================
// PAGINATED RESPONSES
// ============================================================================

// Paginated transactions response
export interface PaginatedTransactionsResponse {
  transactions: TransactionListItem[];
  total: number;
  limit: number;
  offset: number;
}

// Paginated events response
export interface PaginatedEventsResponse {
  events: EventListItem[];
  total: number;
  limit: number;
  offset: number;
}

// Transaction filter options
export interface TransactionFilterOptions {
  moduleAddress?: string;
  status?: 'success' | 'failed';
  search?: string;
  limit?: number;
  offset?: number;
}

// Event filter options
export interface EventFilterOptions {
  moduleAddress?: string;
  eventType?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// WEB3 ACTIONS TYPES
// ============================================================================

// Action trigger types
export type ActionTriggerType = 'event' | 'block' | 'schedule' | 'webhook';

// Execution status
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout';

// ============================================================================
// TRIGGER CONFIGURATIONS
// ============================================================================

// Event trigger configuration
export interface EventTriggerConfig {
  type: 'event';
  eventType: string;  // e.g., "0x1::coin::DepositEvent"
  moduleAddress?: string;
  filters?: Record<string, FilterCondition>;
}

// Block trigger configuration
export interface BlockTriggerConfig {
  type: 'block';
  interval: number;  // Every N blocks
}

// Schedule trigger configuration
export interface ScheduleTriggerConfig {
  type: 'schedule';
  cron: string;  // Cron expression
  timezone: string;
}

// Webhook trigger configuration
// Allows external services to trigger actions via HTTP POST
export interface WebhookTriggerConfig {
  type: 'webhook';
  // Secret token for webhook authentication (auto-generated)
  webhookSecret?: string;
  // Optional: Require specific headers for additional auth
  requireHeaders?: Record<string, string>;
  // Optional: IP whitelist (CIDR notation supported)
  allowedIps?: string[];
}

// Filter condition for event triggers
export interface FilterCondition {
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  value: unknown;
}

// Union type for all trigger configs
export type TriggerConfig = EventTriggerConfig | BlockTriggerConfig | ScheduleTriggerConfig | WebhookTriggerConfig;

// ============================================================================
// ACTION API REQUEST/RESPONSE TYPES
// ============================================================================

// Create action request
export interface CreateActionRequest {
  name: string;
  description?: string;
  code: string;
  network?: Network;
  triggerType: ActionTriggerType;
  triggerConfig: TriggerConfig;
  maxExecutionMs?: number;
  memoryLimitMb?: number;
  cooldownSeconds?: number;
  secrets?: Array<{ name: string; value: string }>;
}

// Update action request
export interface UpdateActionRequest {
  name?: string;
  description?: string;
  code?: string;
  enabled?: boolean;
  network?: Network;
  triggerType?: ActionTriggerType;
  triggerConfig?: TriggerConfig;
  maxExecutionMs?: number;
  memoryLimitMb?: number;
  cooldownSeconds?: number;
}

// Action response (list and detail)
export interface ActionResponse {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  network: Network;
  code: string;
  triggerType: ActionTriggerType;
  triggerConfig: TriggerConfig;
  maxExecutionMs: number;
  memoryLimitMb: number;
  cooldownSeconds: number;
  lastExecutedAt: string | null;
  executionCount: number;
  successCount: number;
  failureCount: number;
  secretNames: string[];  // Only names, not values
  createdAt: string;
  updatedAt: string;
}

// Action list item (for list view, without code)
export interface ActionListItem {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  network: Network;
  triggerType: ActionTriggerType;
  lastExecutedAt: string | null;
  executionCount: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
}

// Action execution response
export interface ActionExecutionResponse {
  id: string;
  actionId: string;
  status: ExecutionStatus;
  triggerData: unknown;
  transactionHash: string | null;
  result: unknown;
  logs: string[];
  error: { message: string; stack?: string } | null;
  durationMs: number | null;
  memoryUsedMb: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// Paginated executions response
export interface ActionExecutionsResponse {
  executions: ActionExecutionResponse[];
  total: number;
  limit: number;
  offset: number;
}

// Test execution request
export interface TestActionRequest {
  triggerData?: unknown;
}

// Test execution result
export interface TestActionResult {
  executionId: string;
  status: 'success' | 'failed' | 'timeout';
  duration: number;
  output?: unknown;
  logs: string[];
  error?: string;
}

// Secret response (only name, never value)
export interface ActionSecretResponse {
  name: string;
  configured: boolean;
  createdAt: string;
  updatedAt: string;
}

// Add/update secret request
export interface SetSecretRequest {
  name: string;
  value: string;
}

// ============================================================================
// ACTION EXECUTION CONTEXT (for runtime)
// ============================================================================

// Context passed to user action code
export interface ActionExecutionContext {
  actionId: string;
  executionId: string;
  network: Network;
  triggerType: ActionTriggerType;
  triggerData: unknown;
  secrets: Record<string, string>;
}

// ============================================================================
// X402 PAYMENT TYPES
// ============================================================================

// Payment status
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'expired';

// Payment required response (402 header content)
export interface PaymentRequired {
  version: '1.0';
  network: 'movement-testnet' | 'movement-mainnet';
  payTo: string;
  asset: 'MOVE';
  amount: string;           // Amount in octas (smallest unit)
  amountFormatted: string;  // Human-readable (e.g., "0.001 MOVE")
  resource: string;         // API endpoint
  description: string;      // Human-readable description
  validUntil: string;       // ISO timestamp
  instructions: {
    type: 'transfer';
    to: string;
    amount: string;
    memo?: string;
  };
}

// Payment payload (X-Payment header content)
// The client submits the transaction on-chain and sends the hash for verification
export interface PaymentPayload {
  transactionHash: string;    // On-chain transaction hash
  senderAddress: string;      // Sender wallet address
  amount: string;             // Amount in octas
  recipient: string;          // Recipient address
  nonce: string;              // Unique nonce to prevent replay
  timestamp: number;          // Unix timestamp
}

// Payment response (X-Payment-Response header content)
export interface PaymentResponse {
  transactionHash: string;
  amount: string;
  status: 'confirmed';
}

// Payment record (from database)
export interface Payment {
  id: string;
  userId?: string;
  payerAddress: string;
  amount: string;
  amountFormatted: string;
  transactionHash?: string;
  network: Network;
  status: PaymentStatus;
  endpoint: string;
  requestId: string;
  priceOctas: string;
  priceUsd?: number;
  verifiedAt?: string;
  confirmedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// Usage quota record
export interface UsageQuota {
  id: string;
  userId?: string;
  walletAddress?: string;
  simulationsToday: number;
  guardianChecks: number;
  alertsCreated: number;
  actionsExecuted: number;
  monitoringCalls: number;
  lastResetDate: string;
}

// Endpoint pricing configuration
export interface EndpointPricing {
  endpoint: string;
  priceOctas: string;
  priceFormatted: string;
  priceUsd?: number;
  freeLimit: number;
  freePeriod: 'day' | 'month';
  description: string;
  enabled: boolean;
}

// ============================================================================
// X402 API REQUEST/RESPONSE TYPES
// ============================================================================

// List payments response
export interface PaymentsListResponse {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
}

// Usage quota response
export interface UsageQuotaResponse {
  quota: {
    simulationsToday: number;
    simulationsLimit: number;
    guardianChecks: number;
    guardianLimit: number;
    alertsCreated: number;
    alertsLimit: number;
    actionsExecuted: number;
    actionsLimit: number;
    monitoringCalls: number;
    monitoringLimit: number;
  };
  resetAt: string;
}

// Pricing list response
export interface PricingListResponse {
  pricing: EndpointPricing[];
  paymentAddress: string;
  network: 'movement-testnet' | 'movement-mainnet';
}

// Payment verification result (internal)
export interface PaymentVerificationResult {
  valid: boolean;
  payerAddress?: string;
  error?: string;
}

// Payment settlement result (internal)
export interface PaymentSettlementResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

// Record payment request (internal)
export interface RecordPaymentRequest {
  userId?: string;
  payerAddress: string;
  amount: string;
  amountFormatted: string;
  transactionHash: string;
  endpoint: string;
  requestId: string;
  priceOctas: string;
  priceUsd?: number;
}

// ============================================================================
// GUARDIAN RISK ANALYZER TYPES
// ============================================================================

// Risk severity levels
export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Risk categories
export type RiskCategory = 'EXPLOIT' | 'RUG_PULL' | 'EXCESSIVE_COST' | 'PERMISSION';

// Guardian check request
export interface GuardianCheckRequest {
  network: Network;
  functionName: string;       // e.g., "0x1::coin::transfer"
  typeArguments: string[];
  arguments: unknown[];
  sender?: string;
  simulationId?: string;      // Optional: pass existing simulation result
}

// Simulation status for Guardian analysis
export type GuardianSimulationStatus = 'success' | 'failed' | 'skipped';

// LLM status for Guardian analysis
export type GuardianLlmStatus = 'used' | 'skipped' | 'rate_limited' | 'error';

// Analysis warning type
export type GuardianWarningType =
  | 'simulation_failed'
  | 'llm_skipped'
  | 'llm_error'
  | 'llm_rate_limited'
  | 'stale_result'
  | 'bytecode_verification_failed'
  | 'partial_analysis'
  | 'simulation_not_hardened'  // Red Pill attack protection not available
  | 'threat_feed_unavailable'  // Threat intelligence API unavailable
  | 'critical_vulnerability'   // Critical vulnerability detected (e.g., Cetus-type overflow)
  | 'ai_analysis_warning';     // AI-first analysis warning/info

// Analysis warning severity
export type GuardianWarningSeverity = 'info' | 'warning' | 'error';

// Analysis warning
export interface GuardianAnalysisWarning {
  type: GuardianWarningType;
  message: string;
  severity: GuardianWarningSeverity;
}

// Guardian check response
export interface GuardianCheckResponse {
  id: string;
  shareId: string;
  overallRisk: RiskSeverity;
  riskScore: number;          // 0-100
  issues: GuardianIssueResponse[];
  analysisTime: {
    patternMatchMs: number;
    llmAnalysisMs?: number;
    totalMs: number;
  };
  usedLlm: boolean;
  shareUrl: string;
  createdAt: string;
  // New fields for analysis integrity
  simulationStatus: GuardianSimulationStatus;
  simulationError?: string;
  analysisComplete: boolean;  // True if all analysis steps succeeded
  llmStatus: GuardianLlmStatus;
  warnings: GuardianAnalysisWarning[];
  // Bytecode verification results (actual on-chain verification)
  bytecodeVerification?: GuardianBytecodeVerification;
}

// Bytecode verification results from on-chain analysis
export interface GuardianBytecodeVerification {
  status: 'verified' | 'module_not_found' | 'function_not_found' | 'skipped' | 'error';
  moduleExists: boolean;
  functionExists: boolean;
  error?: string;
  metadata?: {
    moduleAddress: string;
    moduleName: string;
    totalFunctions: number;
    entryFunctions: number;
    hasResourceAbilities: boolean;
    friendModules: string[];
  };
  functionInfo?: {
    name: string;
    visibility: 'public' | 'private' | 'friend' | 'script';
    isEntry: boolean;
    isView: boolean;
    params: string[];
    returnTypes: string[];
  };
  // Issues detected from actual bytecode analysis (high confidence)
  verifiedOnChain: boolean;
}

// Guardian issue response
export interface GuardianIssueResponse {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  description: string;
  recommendation: string;
  evidence?: unknown;
  confidence: number;         // 0.0-1.0
  source: 'pattern' | 'llm';
}

// Shared Guardian check (for GET /guardian/check/:shareId)
export interface SharedGuardianCheck {
  id: string;
  shareId: string;
  network: Network;
  functionName: string;
  typeArguments: string[];
  arguments: unknown[];
  sender?: string;
  overallRisk: RiskSeverity;
  riskScore: number;
  issues: GuardianIssueResponse[];
  usedLlm: boolean;
  createdAt: string;
  expiresAt: string;
}

// Demo transaction for testing
export interface DemoTransaction {
  id: string;
  name: string;
  description: string;
  category: 'safe' | 'exploit' | 'rugpull' | 'suspicious';
  network: Network;
  functionPath: string;
  typeArguments: string[];
  arguments: unknown[];
  sender?: string;
  expectedRisk: RiskSeverity;
  expectedIssues: string[];
}

// Risk pattern definition (for pattern registry)
export interface RiskPattern {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  name: string;
  description: string;
}

// Pattern list response
export interface PatternsListResponse {
  patterns: RiskPattern[];
  total: number;
}

// Demo transactions list response
export interface DemoTransactionsResponse {
  transactions: DemoTransaction[];
}

// ============================================================================
// USER SETTINGS TYPES
// ============================================================================

// User profile response
export interface UserProfile {
  id: string;
  email: string | null;
  walletAddress: string | null;
  name: string | null;
  image: string | null;
  tier: Tier;
  emailVerified: string | null;
  createdAt: string;
}

// Update profile request
export interface UpdateProfileRequest {
  name?: string;
  image?: string;
}

// Notification preferences
export interface NotificationPreference {
  id: string;
  emailEnabled: boolean;
  emailAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

// Update notification preferences request
export interface UpdateNotificationPreferenceRequest {
  emailEnabled?: boolean;
  emailAddress?: string;
}

// ============================================================================
// API KEY TYPES
// ============================================================================

// API key response (masked, for listing)
export interface ApiKeyResponse {
  id: string;
  name: string | null;
  keyPrefix: string;  // "mw_live_abc123..."
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// Create API key request
export interface CreateApiKeyRequest {
  name?: string;
  expiresInDays?: number;  // Days until expiration (optional)
}

// Create API key response (includes full key once)
export interface CreateApiKeyResponse {
  id: string;
  key: string;  // Full key, shown only once!
  name: string | null;
  keyPrefix: string;
  expiresAt: string | null;
  createdAt: string;
}

// API keys list response
export interface ApiKeysListResponse {
  apiKeys: ApiKeyResponse[];
  total: number;
}

// ============================================================================
// MOVE 2 ANALYSIS TYPES
// ============================================================================

// Move 2 feature definition
export interface Move2Feature {
  id: string;
  name: string;
  version: '2.0' | '2.1' | '2.2' | '2.3';
  category: 'syntax' | 'types' | 'control_flow' | 'visibility' | 'safety';
  description: string;
  benefit: string;
  example?: string;
  learnMoreUrl?: string;
}

// Feature detection result
export interface Move2FeatureDetection {
  feature: Move2Feature;
  detected: boolean;
  occurrences: number;
  locations?: string[];
}

// Move 2 recommendation
export interface Move2Recommendation {
  type: 'upgrade' | 'optimization' | 'best_practice';
  title: string;
  description: string;
  feature?: string;
  priority: 'low' | 'medium' | 'high';
}

// Full Move 2 analysis result
export interface Move2Analysis {
  moduleAddress: string;
  moduleName: string;
  network: Network;
  move2Version: '2.0' | '2.1' | '2.2' | '2.3' | 'legacy';
  featuresDetected: Move2FeatureDetection[];
  summary: {
    totalFeatures: number;
    byVersion: Record<string, number>;
    byCategory: Record<string, number>;
  };
  recommendations: Move2Recommendation[];
  compatibility: {
    aptosMainnet: boolean;
    movementMainnet: boolean;
    movementTestnet: boolean;
  };
}

// ============================================================================
// GAS MODEL TYPES
// ============================================================================

// Gas model characteristic
export interface GasCharacteristic {
  name: string;
  value: string;
  description: string;
  impact: 'positive' | 'neutral' | 'negative';
}

// Fee component breakdown
export interface FeeComponent {
  name: string;
  description: string;
  formula?: string;
  percentage?: number;
}

// Gas pricing information
export interface GasPricing {
  minGasUnitPrice: number;
  recommendedGasUnitPrice: number;
  storagePerByte: number;
  executionMultiplier: number;
}

// Gas model details
export interface GasModelDetails {
  name: string;
  description: string;
  characteristics: GasCharacteristic[];
  feeComponents: FeeComponent[];
  pricing: GasPricing;
}

// Network comparison result
export interface NetworkComparisonResult {
  gasCostRatio: number;
  storageCostRatio: number;
  finalityTime: { movement: string; other: string };
  notes: string[];
}

// Full network comparison
export interface NetworkComparison {
  movementVsAptos: NetworkComparisonResult;
  movementVsSui: NetworkComparisonResult;
  summary: string;
}

// Gas optimization tip
export interface GasOptimizationTip {
  id: string;
  category: 'storage' | 'computation' | 'batching' | 'pattern';
  title: string;
  description: string;
  potentialSavings: string;
  applicable: boolean;
  reason?: string;
}

// Cost estimate
export interface CostEstimate {
  low: number;
  expected: number;
  high: number;
  formatted: string;
}

// Cost projection
export interface CostProjection {
  singleTx: CostEstimate;
  daily100Tx: CostEstimate;
  monthly: CostEstimate;
  currency: 'MOVE' | 'USD';
}

// Full gas model analysis
export interface GasModelAnalysis {
  network: Network;
  model: GasModelDetails;
  comparison?: NetworkComparison;
  optimizations: GasOptimizationTip[];
  costProjection: CostProjection;
}

// Movement-specific feature
export interface MovementFeature {
  id: string;
  name: string;
  description: string;
  benefit: string;
  available: boolean;
}
