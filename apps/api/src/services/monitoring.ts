import { prisma } from '../lib/prisma.js';
import { getMovementClient, parseFunctionPath } from '../lib/movement.js';
import type {
  Network,
  DashboardPeriod,
  DashboardStats,
  TransactionListItem,
  TransactionDetail,
  EventListItem,
  GasAnalytics,
  WatchedContractResponse,
  CreateWatchedContractRequest,
  PaginatedTransactionsResponse,
  PaginatedEventsResponse,
  TransactionFilterOptions,
  EventFilterOptions,
} from '@movewatch/shared';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the start date for a given period
 */
function getPeriodStart(period: DashboardPeriod): Date {
  const now = new Date();
  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Get interval bucket size for a period (for time series)
 */
function getIntervalMs(period: DashboardPeriod): number {
  switch (period) {
    case '24h':
      return 60 * 60 * 1000; // 1 hour buckets
    case '7d':
      return 6 * 60 * 60 * 1000; // 6 hour buckets
    case '30d':
      return 24 * 60 * 60 * 1000; // 1 day buckets
  }
}

/**
 * Parse transaction from Aptos SDK response
 */
function parseTransaction(
  tx: Record<string, unknown>,
  network: Network
): TransactionListItem | null {
  try {
    // Only process user transactions
    if (tx.type !== 'user_transaction') return null;

    const payload = tx.payload as Record<string, unknown> | undefined;
    if (!payload?.function) return null;

    const functionPath = payload.function as string;
    const parts = functionPath.split('::');

    if (parts.length < 3) return null;

    const moduleAddress = `${parts[0]}::${parts[1]}`;
    const functionName = parts[2];

    return {
      hash: tx.hash as string,
      version: tx.version as string,
      network,
      moduleAddress,
      functionName,
      success: tx.success as boolean,
      vmStatus: tx.vm_status as string | undefined,
      gasUsed: parseInt((tx.gas_used as string) || '0', 10),
      sender: tx.sender as string,
      timestamp: new Date(
        parseInt((tx.timestamp as string) || '0', 10) / 1000
      ).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Parse events from transaction
 */
function parseEvents(tx: Record<string, unknown>): EventListItem[] {
  const events: EventListItem[] = [];
  const txEvents = tx.events as Array<Record<string, unknown>> | undefined;

  if (txEvents) {
    for (const event of txEvents) {
      events.push({
        eventType: event.type as string,
        data: event.data,
        sequenceNumber: parseInt((event.sequence_number as string) || '0', 10),
        timestamp: new Date(
          parseInt((tx.timestamp as string) || '0', 10) / 1000
        ).toISOString(),
        transactionHash: tx.hash as string,
      });
    }
  }

  return events;
}

/**
 * Calculate p95 from an array of numbers
 */
function calculateP95(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.95);
  return sorted[Math.min(index, sorted.length - 1)];
}

// ============================================================================
// WATCHED CONTRACTS CRUD
// ============================================================================

/**
 * Get all watched contracts for a user
 */
export async function getWatchedContracts(
  userId: string
): Promise<WatchedContractResponse[]> {
  const contracts = await prisma.watchedContract.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return contracts.map((c) => ({
    id: c.id,
    moduleAddress: c.moduleAddress,
    name: c.name,
    network: c.network.toLowerCase() as Network,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

/**
 * Add a watched contract
 */
export async function addWatchedContract(
  userId: string,
  data: CreateWatchedContractRequest
): Promise<WatchedContractResponse> {
  // Ensure user exists
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId },
    update: {},
  });

  const contract = await prisma.watchedContract.create({
    data: {
      userId,
      moduleAddress: data.moduleAddress,
      name: data.name,
      network: data.network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
    },
  });

  return {
    id: contract.id,
    moduleAddress: contract.moduleAddress,
    name: contract.name,
    network: contract.network.toLowerCase() as Network,
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  };
}

/**
 * Remove a watched contract
 */
export async function removeWatchedContract(
  userId: string,
  contractId: string
): Promise<boolean> {
  const contract = await prisma.watchedContract.findFirst({
    where: { id: contractId, userId },
  });

  if (!contract) return false;

  await prisma.watchedContract.delete({
    where: { id: contractId },
  });

  return true;
}

// ============================================================================
// DASHBOARD STATISTICS
// ============================================================================

/**
 * Get dashboard statistics by querying on-chain data
 */
export async function getDashboardStats(
  userId: string,
  period: DashboardPeriod,
  network: Network = 'testnet',
  moduleAddress?: string,
  sender?: string // Filter by wallet address
): Promise<DashboardStats> {
  const client = getMovementClient(network);
  const periodStart = getPeriodStart(period);

  // Get watched contracts for filtering (only if not filtering by sender)
  const watchedContracts = sender ? [] : await getWatchedContracts(userId);
  const moduleAddresses = moduleAddress
    ? [moduleAddress]
    : watchedContracts.map((c) => c.moduleAddress);

  // Fetch transactions from chain
  let transactions: TransactionListItem[] = [];

  try {
    let rawTxs: Record<string, unknown>[];

    if (sender) {
      // When filtering by wallet, use account-specific API
      rawTxs = (await client.getAccountTransactions({
        accountAddress: sender,
        options: { limit: 100 },
      })) as Record<string, unknown>[];
    } else {
      // Otherwise fetch recent network transactions
      rawTxs = (await client.getTransactions({
        options: { limit: 1000 },
      })) as Record<string, unknown>[];
    }

    // Parse and filter transactions
    for (const tx of rawTxs) {
      const parsed = parseTransaction(tx as Record<string, unknown>, network);
      if (parsed) {
        // Filter by module address if we have watched contracts (and no sender filter)
        if (
          !sender &&
          moduleAddresses.length > 0 &&
          !moduleAddresses.some((addr) =>
            parsed.moduleAddress.toLowerCase().includes(addr.toLowerCase())
          )
        ) {
          continue;
        }

        // Filter by time period
        if (new Date(parsed.timestamp) >= periodStart) {
          transactions.push(parsed);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching transactions for stats:', error);
  }

  // Calculate transaction stats
  const total = transactions.length;
  const success = transactions.filter((tx) => tx.success).length;
  const failed = total - success;
  const successRate = total > 0 ? (success / total) * 100 : 100;

  // Calculate gas stats
  const gasValues = transactions.map((tx) => tx.gasUsed);
  const totalGas = gasValues.reduce((a, b) => a + b, 0);
  const avgGas = gasValues.length > 0 ? totalGas / gasValues.length : 0;
  const p95Gas = calculateP95(gasValues);

  // Get alert stats from database
  const [activeAlerts, triggeredAlerts] = await Promise.all([
    prisma.alert.count({ where: { userId, enabled: true } }),
    prisma.alertTrigger.count({
      where: {
        alert: { userId },
        triggeredAt: { gte: periodStart },
      },
    }),
  ]);

  // For trends, we'd need historical data which we don't store
  // Setting to 0 for now (can be enhanced with Redis caching)
  return {
    period,
    transactions: {
      total,
      success,
      failed,
      successRate: Math.round(successRate * 10) / 10,
      trend: 0, // Would need historical comparison
    },
    gas: {
      total: totalGas,
      average: Math.round(avgGas),
      p95: p95Gas,
      trend: 0, // Would need historical comparison
    },
    alerts: {
      active: activeAlerts,
      triggered: triggeredAlerts,
    },
  };
}

// ============================================================================
// TRANSACTION QUERIES
// ============================================================================

/**
 * Get transactions with filtering and pagination
 */
export async function getTransactions(
  userId: string,
  network: Network = 'testnet',
  options: TransactionFilterOptions & { sender?: string } = {}
): Promise<PaginatedTransactionsResponse> {
  const { moduleAddress, status, search, limit = 50, offset = 0, sender } = options;

  const client = getMovementClient(network);

  // Get watched contracts for filtering (only if not filtering by sender)
  const watchedContracts = sender ? [] : await getWatchedContracts(userId);
  const moduleAddresses = moduleAddress
    ? [moduleAddress]
    : watchedContracts.map((c) => c.moduleAddress);

  let transactions: TransactionListItem[] = [];

  try {
    // If searching by hash, try to get specific transaction
    if (search && search.startsWith('0x')) {
      try {
        const tx = await client.getTransactionByHash({
          transactionHash: search,
        });
        const parsed = parseTransaction(tx as Record<string, unknown>, network);
        if (parsed) {
          // Still apply sender filter for hash search
          if (!sender || parsed.sender.toLowerCase() === sender.toLowerCase()) {
            transactions = [parsed];
          }
        }
      } catch {
        // Transaction not found, continue with empty results
      }
    } else {
      let rawTxs: Record<string, unknown>[];

      if (sender) {
        // When filtering by wallet, use account-specific API
        rawTxs = (await client.getAccountTransactions({
          accountAddress: sender,
          options: { limit: 200 },
        })) as Record<string, unknown>[];
      } else {
        // Otherwise fetch recent network transactions
        rawTxs = (await client.getTransactions({
          options: { limit: 500 },
        })) as Record<string, unknown>[];
      }

      // Parse and filter transactions
      for (const tx of rawTxs) {
        const parsed = parseTransaction(tx as Record<string, unknown>, network);
        if (parsed) {
          // Filter by module address (only if not filtering by sender)
          if (
            !sender &&
            moduleAddresses.length > 0 &&
            !moduleAddresses.some((addr) =>
              parsed.moduleAddress.toLowerCase().includes(addr.toLowerCase())
            )
          ) {
            continue;
          }

          // Filter by status
          if (status === 'success' && !parsed.success) continue;
          if (status === 'failed' && parsed.success) continue;

          // Filter by search (function name)
          if (
            search &&
            !parsed.functionName.toLowerCase().includes(search.toLowerCase())
          ) {
            continue;
          }

          transactions.push(parsed);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching transactions:', error);
  }

  // Sort by timestamp descending
  transactions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Apply pagination
  const total = transactions.length;
  const paginated = transactions.slice(offset, offset + limit);

  return {
    transactions: paginated,
    total,
    limit,
    offset,
  };
}

/**
 * Get transaction detail by hash
 */
export async function getTransactionDetail(
  hash: string,
  network: Network = 'testnet'
): Promise<TransactionDetail | null> {
  const client = getMovementClient(network);

  try {
    const tx = await client.getTransactionByHash({
      transactionHash: hash,
    });

    const txRecord = tx as Record<string, unknown>;
    const parsed = parseTransaction(txRecord, network);

    if (!parsed) return null;

    // Extract sequence number from transaction
    const sequenceNumber = parseInt(
      (txRecord.sequence_number as string) || '0',
      10
    );

    // Parse events
    const events = parseEvents(txRecord);

    return {
      ...parsed,
      sequenceNumber,
      events,
    };
  } catch (error) {
    console.error('Error fetching transaction detail:', error);
    return null;
  }
}

// ============================================================================
// EVENT QUERIES
// ============================================================================

/**
 * Get events with filtering and pagination
 */
export async function getEvents(
  userId: string,
  network: Network = 'testnet',
  options: EventFilterOptions & { sender?: string } = {}
): Promise<PaginatedEventsResponse> {
  const { moduleAddress, eventType, limit = 100, offset = 0, sender } = options;

  const client = getMovementClient(network);

  // Get watched contracts for filtering (only if not filtering by sender)
  const watchedContracts = sender ? [] : await getWatchedContracts(userId);
  const moduleAddresses = moduleAddress
    ? [moduleAddress]
    : watchedContracts.map((c) => c.moduleAddress);

  let events: EventListItem[] = [];

  try {
    let rawTxs: Record<string, unknown>[];

    if (sender) {
      // When filtering by wallet, use account-specific API
      rawTxs = (await client.getAccountTransactions({
        accountAddress: sender,
        options: { limit: 100 },
      })) as Record<string, unknown>[];
    } else {
      // Otherwise fetch recent network transactions
      rawTxs = (await client.getTransactions({
        options: { limit: 200 },
      })) as Record<string, unknown>[];
    }

    for (const tx of rawTxs) {
      const txRecord = tx as Record<string, unknown>;

      // Check if transaction is from watched contracts
      const payload = txRecord.payload as Record<string, unknown> | undefined;
      if (!payload?.function) continue;

      const functionPath = payload.function as string;
      const parts = functionPath.split('::');
      if (parts.length < 3) continue;

      const txModuleAddress = `${parts[0]}::${parts[1]}`;

      // Filter by module address (only if not filtering by sender)
      if (
        !sender &&
        moduleAddresses.length > 0 &&
        !moduleAddresses.some((addr) =>
          txModuleAddress.toLowerCase().includes(addr.toLowerCase())
        )
      ) {
        continue;
      }

      // Extract and filter events
      const txEvents = parseEvents(txRecord);
      for (const event of txEvents) {
        // Filter by event type
        if (
          eventType &&
          !event.eventType.toLowerCase().includes(eventType.toLowerCase())
        ) {
          continue;
        }

        events.push(event);
      }
    }
  } catch (error) {
    console.error('Error fetching events:', error);
  }

  // Sort by timestamp descending
  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Apply pagination
  const total = events.length;
  const paginated = events.slice(offset, offset + limit);

  return {
    events: paginated,
    total,
    limit,
    offset,
  };
}

// ============================================================================
// GAS ANALYTICS
// ============================================================================

/**
 * Get gas analytics with time series data
 */
export async function getGasAnalytics(
  userId: string,
  period: DashboardPeriod,
  network: Network = 'testnet',
  moduleAddress?: string,
  sender?: string // Filter by wallet address
): Promise<GasAnalytics> {
  const client = getMovementClient(network);
  const periodStart = getPeriodStart(period);
  const intervalMs = getIntervalMs(period);

  // Get watched contracts for filtering (only if not filtering by sender)
  const watchedContracts = sender ? [] : await getWatchedContracts(userId);
  const moduleAddresses = moduleAddress
    ? [moduleAddress]
    : watchedContracts.map((c) => c.moduleAddress);

  let transactions: TransactionListItem[] = [];

  try {
    let rawTxs: Record<string, unknown>[];

    if (sender) {
      // When filtering by wallet, use account-specific API
      rawTxs = (await client.getAccountTransactions({
        accountAddress: sender,
        options: { limit: 100 },
      })) as Record<string, unknown>[];
    } else {
      // Otherwise fetch recent network transactions
      rawTxs = (await client.getTransactions({
        options: { limit: 1000 },
      })) as Record<string, unknown>[];
    }

    for (const tx of rawTxs) {
      const parsed = parseTransaction(tx as Record<string, unknown>, network);
      if (parsed) {
        // Filter by module address (only if not filtering by sender)
        if (
          !sender &&
          moduleAddresses.length > 0 &&
          !moduleAddresses.some((addr) =>
            parsed.moduleAddress.toLowerCase().includes(addr.toLowerCase())
          )
        ) {
          continue;
        }

        // Filter by time period
        if (new Date(parsed.timestamp) >= periodStart) {
          transactions.push(parsed);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching transactions for gas analytics:', error);
  }

  // Calculate time series data points
  const buckets = new Map<
    number,
    { values: number[]; min: number; max: number }
  >();

  for (const tx of transactions) {
    const txTime = new Date(tx.timestamp).getTime();
    const bucketTime = Math.floor(txTime / intervalMs) * intervalMs;

    if (!buckets.has(bucketTime)) {
      buckets.set(bucketTime, { values: [], min: Infinity, max: -Infinity });
    }

    const bucket = buckets.get(bucketTime)!;
    bucket.values.push(tx.gasUsed);
    bucket.min = Math.min(bucket.min, tx.gasUsed);
    bucket.max = Math.max(bucket.max, tx.gasUsed);
  }

  const dataPoints = Array.from(buckets.entries())
    .map(([timestamp, bucket]) => ({
      timestamp: new Date(timestamp).toISOString(),
      average: Math.round(
        bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length
      ),
      min: bucket.min === Infinity ? 0 : bucket.min,
      max: bucket.max === -Infinity ? 0 : bucket.max,
      count: bucket.values.length,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Calculate overall stats
  const allGasValues = transactions.map((tx) => tx.gasUsed);
  const totalGas = allGasValues.reduce((a, b) => a + b, 0);
  const avgGas =
    allGasValues.length > 0 ? totalGas / allGasValues.length : 0;
  const minGas = allGasValues.length > 0 ? Math.min(...allGasValues) : 0;
  const maxGas = allGasValues.length > 0 ? Math.max(...allGasValues) : 0;
  const p95Gas = calculateP95(allGasValues);

  // Calculate by function breakdown
  const functionStats = new Map<
    string,
    { totalGas: number; count: number; moduleAddress: string }
  >();

  for (const tx of transactions) {
    const key = `${tx.moduleAddress}::${tx.functionName}`;
    if (!functionStats.has(key)) {
      functionStats.set(key, {
        totalGas: 0,
        count: 0,
        moduleAddress: tx.moduleAddress,
      });
    }
    const stats = functionStats.get(key)!;
    stats.totalGas += tx.gasUsed;
    stats.count++;
  }

  const byFunction = Array.from(functionStats.entries())
    .map(([key, stats]) => ({
      functionName: key.split('::').pop() || key,
      moduleAddress: stats.moduleAddress,
      totalGas: stats.totalGas,
      avgGas: Math.round(stats.totalGas / stats.count),
      count: stats.count,
    }))
    .sort((a, b) => b.totalGas - a.totalGas)
    .slice(0, 5);

  // Detect anomalies (> 2x average)
  const anomalyThreshold = avgGas * 2;
  const anomalies = transactions
    .filter((tx) => tx.gasUsed > anomalyThreshold)
    .map((tx) => ({
      timestamp: tx.timestamp,
      gasUsed: tx.gasUsed,
      transactionHash: tx.hash,
      functionName: tx.functionName,
    }))
    .sort((a, b) => b.gasUsed - a.gasUsed)
    .slice(0, 10);

  return {
    period,
    dataPoints,
    stats: {
      min: minGas,
      max: maxGas,
      average: Math.round(avgGas),
      p95: p95Gas,
      total: totalGas,
    },
    byFunction,
    anomalies,
  };
}
