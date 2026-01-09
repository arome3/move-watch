'use client';

import type { EventEmittedCondition } from '@movewatch/shared';

interface EventConfigProps {
  value: EventEmittedCondition;
  onChange: (condition: EventEmittedCondition) => void;
  errors?: Record<string, string>;
}

export function EventConfig({ value, onChange, errors = {} }: EventConfigProps) {
  const handleFiltersChange = (filtersJson: string) => {
    try {
      const filters = filtersJson ? JSON.parse(filtersJson) : undefined;
      onChange({ ...value, filters });
    } catch {
      // Keep the raw string in state for editing, even if invalid
      onChange({ ...value, filters: filtersJson as unknown as Record<string, unknown> });
    }
  };

  const getFiltersString = () => {
    if (!value.filters) return '';
    if (typeof value.filters === 'string') return value.filters;
    return JSON.stringify(value.filters, null, 2);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-dark-400">
        Get notified when a specific event is emitted on-chain.
      </p>

      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Event Type <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={value.eventType}
          onChange={(e) => onChange({ ...value, eventType: e.target.value })}
          placeholder="0x1::coin::WithdrawEvent"
          className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono
                     text-dark-100 placeholder:text-dark-600
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-colors
                     ${errors.eventType ? 'border-red-500' : 'border-dark-700'}`}
        />
        {errors.eventType && (
          <p className="mt-1 text-xs text-red-400">{errors.eventType}</p>
        )}
        <p className="mt-1 text-xs text-dark-500">
          Full type path of the event to monitor
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Filters <span className="text-dark-500">(optional)</span>
        </label>
        <textarea
          value={getFiltersString()}
          onChange={(e) => handleFiltersChange(e.target.value)}
          placeholder={`{
  "amount": { "gte": 1000000000 }
}`}
          rows={4}
          className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono
                     text-dark-100 placeholder:text-dark-600
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-colors resize-none
                     ${errors.filters ? 'border-red-500' : 'border-dark-700'}`}
        />
        {errors.filters && (
          <p className="mt-1 text-xs text-red-400">{errors.filters}</p>
        )}
        <p className="mt-1 text-xs text-dark-500">
          JSON object to filter events. Supports operators: gte, lte, gt, lt, eq
        </p>
      </div>
    </div>
  );
}
