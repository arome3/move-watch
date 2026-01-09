'use client';

import { useQuery } from '@tanstack/react-query';
import { StatCard } from './StatCard';
import { PeriodSelector } from './PeriodSelector';
import { RefreshButton } from './RefreshButton';
import { fetchDashboardStats } from '@/lib/monitoringApi';
import type { DashboardPeriod, Network } from '@movewatch/shared';

interface DashboardOverviewProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  network?: Network;
  moduleAddress?: string;
  sender?: string; // Filter by wallet address
}

export function DashboardOverview({
  period,
  onPeriodChange,
  network = 'testnet',
  moduleAddress,
  sender,
}: DashboardOverviewProps) {
  const { data: stats, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard-stats', period, network, moduleAddress, sender],
    queryFn: () => fetchDashboardStats(period, network, moduleAddress, sender),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const handlePeriodChange = (newPeriod: DashboardPeriod) => {
    onPeriodChange(newPeriod);
  };

  if (isLoading || !stats) {
    return <DashboardOverviewSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-semibold text-white">Overview</h2>
        <div className="flex items-center gap-4">
          <PeriodSelector value={period} onChange={handlePeriodChange} />
          <RefreshButton
            onRefresh={refetch}
            lastUpdated={dataUpdatedAt}
            autoRefreshInterval={30000}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Transactions"
          value={stats.transactions.total.toLocaleString()}
          trend={stats.transactions.trend}
          icon={<TransactionIcon />}
        />
        <StatCard
          title="Success Rate"
          value={`${stats.transactions.successRate.toFixed(1)}%`}
          trend={null}
          status={stats.transactions.successRate >= 95 ? 'success' : stats.transactions.successRate >= 80 ? 'warning' : 'error'}
          icon={<CheckIcon />}
        />
        <StatCard
          title="Avg Gas Used"
          value={stats.gas.average.toLocaleString()}
          trend={stats.gas.trend}
          invertTrend // Lower gas is better
          icon={<GasIcon />}
        />
        <StatCard
          title="Alerts Triggered"
          value={stats.alerts.triggered}
          subtext={`${stats.alerts.active} active`}
          status={stats.alerts.triggered > 0 ? 'warning' : 'success'}
          icon={<AlertIcon />}
        />
      </div>
    </div>
  );
}

// Skeleton loader
function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-dark-800 rounded animate-pulse" />
        <div className="h-10 w-64 bg-dark-800 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 bg-dark-800 rounded-lg border border-dark-700 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

// Icons
function TransactionIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function GasIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

export { StatCard } from './StatCard';
export { PeriodSelector } from './PeriodSelector';
export { RefreshButton } from './RefreshButton';
