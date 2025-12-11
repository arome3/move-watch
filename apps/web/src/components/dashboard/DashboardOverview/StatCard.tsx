'use client';

import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number | null;
  invertTrend?: boolean; // If true, negative trend is good (e.g., gas usage)
  subtext?: string;
  icon?: ReactNode;
  status?: 'success' | 'warning' | 'error' | 'neutral';
}

export function StatCard({
  title,
  value,
  trend,
  invertTrend = false,
  subtext,
  icon,
  status = 'neutral',
}: StatCardProps) {
  // Determine trend direction and color
  const getTrendColor = () => {
    if (trend === null || trend === undefined || trend === 0) return 'text-slate-400';

    const isPositive = invertTrend ? trend < 0 : trend > 0;
    return isPositive ? 'text-green-400' : 'text-red-400';
  };

  const getTrendArrow = () => {
    if (trend === null || trend === undefined || trend === 0) return null;
    return trend > 0 ? '↑' : '↓';
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'border-green-500/30 bg-green-500/5';
      case 'warning':
        return 'border-yellow-500/30 bg-yellow-500/5';
      case 'error':
        return 'border-red-500/30 bg-red-500/5';
      default:
        return 'border-slate-700';
    }
  };

  return (
    <div
      className={`bg-slate-800 rounded-lg border p-4 ${getStatusColor()}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-400 uppercase tracking-wide">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{value}</span>
            {trend !== null && trend !== undefined && trend !== 0 && (
              <span className={`text-sm font-medium ${getTrendColor()}`}>
                {getTrendArrow()} {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
          {subtext && (
            <p className="mt-1 text-sm text-slate-500">{subtext}</p>
          )}
        </div>
        {icon && (
          <div className="text-slate-400">{icon}</div>
        )}
      </div>
    </div>
  );
}
