// Network types
export type Network = 'mainnet' | 'testnet' | 'devnet';

// Simulation Request
export interface SimulationRequest {
  network: Network;
  sender?: string;
  payload: {
    function: string; // e.g., "0x1::coin::transfer"
    type_arguments: string[];
    arguments: unknown[];
  };
  options?: {
    max_gas_amount?: number;
    gas_unit_price?: number;
  };
}

// Simulation Response
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
}

// Gas Breakdown
export interface GasBreakdown {
  computation: number;
  storage: number;
}

// State Change
export interface StateChange {
  type: 'create' | 'modify' | 'delete';
  resource: string;
  address: string;
  before?: unknown;
  after?: unknown;
}

// Simulation Event
export interface SimulationEvent {
  type: string;
  data: unknown;
  sequenceNumber: number;
}

// Simulation Error
export interface SimulationError {
  code: string;
  message: string;
  vmStatus: string;
  suggestion?: string;
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
export type AlertConditionType = 'tx_failed' | 'balance_threshold' | 'event_emitted' | 'gas_spike';

// Notification channel types
export type ChannelType = 'discord' | 'slack' | 'telegram' | 'webhook';

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

// Union type for all conditions
export type AlertCondition =
  | TxFailedCondition
  | BalanceThresholdCondition
  | EventEmittedCondition
  | GasSpikeCondition;

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

// Union type for all channel configs
export type ChannelConfig =
  | { type: 'discord'; config: DiscordChannelConfig }
  | { type: 'slack'; config: SlackChannelConfig }
  | { type: 'telegram'; config: TelegramChannelConfig }
  | { type: 'webhook'; config: WebhookChannelConfig };

// ============================================================================
// ALERT API REQUEST/RESPONSE TYPES
// ============================================================================

// Create alert request
export interface CreateAlertRequest {
  name: string;
  network?: Network;
  condition: AlertCondition;
  channels: ChannelConfig[];
  cooldownSeconds?: number;
}

// Update alert request
export interface UpdateAlertRequest {
  name?: string;
  enabled?: boolean;
  network?: Network;
  condition?: AlertCondition;
  channels?: ChannelConfig[];
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
    type: ChannelType;
    configured: boolean;
    enabled: boolean;
  }>;
  cooldownSeconds: number;
  lastTriggeredAt: string | null;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
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
