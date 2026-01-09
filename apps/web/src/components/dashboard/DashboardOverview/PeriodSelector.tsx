'use client';

import type { DashboardPeriod } from '@movewatch/shared';

interface PeriodSelectorProps {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}

const periods: { value: DashboardPeriod; label: string }[] = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1">
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === period.value
              ? 'bg-primary-500 text-white'
              : 'text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
