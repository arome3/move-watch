'use client';

import { useQuery } from '@tanstack/react-query';
import { GasChart } from './GasChart';
import { GasStats } from './GasStats';
import { FunctionBreakdown } from './FunctionBreakdown';
import { AnomalyList } from './AnomalyList';
import { fetchGasAnalytics } from '@/lib/monitoringApi';
import type { DashboardPeriod, Network } from '@movewatch/shared';

interface GasAnalyticsProps {
  period: DashboardPeriod;
  network?: Network;
  moduleAddress?: string;
  sender?: string; // Filter by wallet address
}

export function GasAnalytics({
  period,
  network = 'testnet',
  moduleAddress,
  sender,
}: GasAnalyticsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['gas-analytics', period, network, moduleAddress, sender],
    queryFn: () => fetchGasAnalytics(period, network, moduleAddress, sender),
    refetchInterval: 60000, // Refresh every minute for gas analytics
  });

  if (isLoading) {
    return <GasAnalyticsSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="bg-dark-800 rounded-lg border border-dark-700 p-8 text-center">
        <p className="text-red-400">Failed to load gas analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Gas Analytics</h3>
        <span className="text-sm text-dark-400">
          {data.dataPoints.length} data points
        </span>
      </div>

      {/* Stats Summary */}
      <GasStats stats={data.stats} />

      {/* Main Chart */}
      <div className="bg-dark-800 rounded-lg border border-dark-700 p-4">
        <GasChart data={data.dataPoints} period={period} />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FunctionBreakdown data={data.byFunction} />
        <AnomalyList anomalies={data.anomalies} network={network} />
      </div>
    </div>
  );
}

function GasAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 bg-dark-700 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 bg-dark-800 rounded-lg border border-dark-700 animate-pulse"
          />
        ))}
      </div>
      <div className="h-80 bg-dark-800 rounded-lg border border-dark-700 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-dark-800 rounded-lg border border-dark-700 animate-pulse" />
        <div className="h-64 bg-dark-800 rounded-lg border border-dark-700 animate-pulse" />
      </div>
    </div>
  );
}

export { GasChart } from './GasChart';
export { GasStats } from './GasStats';
export { FunctionBreakdown } from './FunctionBreakdown';
export { AnomalyList } from './AnomalyList';
