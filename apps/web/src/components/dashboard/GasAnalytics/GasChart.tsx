'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { DashboardPeriod } from '@movewatch/shared';

interface DataPoint {
  timestamp: string;
  average: number;
  min: number;
  max: number;
  count: number;
}

interface GasChartProps {
  data: DataPoint[];
  period: DashboardPeriod;
}

export function GasChart({ data, period }: GasChartProps) {
  const formatXAxis = (timestamp: string) => {
    const date = new Date(timestamp);
    if (period === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  const formatTooltipValue = (value: number) => value.toLocaleString();

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-slate-400">
        <p>No gas data available for this period</p>
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatXAxis}
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tickFormatter={formatYAxis}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={formatTooltipValue}
            labelFormatter={(label) =>
              new Date(label).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            }
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="line"
            wrapperStyle={{ paddingBottom: '10px' }}
          />
          <Line
            type="monotone"
            dataKey="average"
            name="Average"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6' }}
          />
          <Line
            type="monotone"
            dataKey="max"
            name="Max"
            stroke="#ef4444"
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="min"
            name="Min"
            stroke="#22c55e"
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
