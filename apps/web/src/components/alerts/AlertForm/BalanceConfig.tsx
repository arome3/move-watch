'use client';

import type { BalanceThresholdCondition, ThresholdOperator } from '@movewatch/shared';

interface BalanceConfigProps {
  value: BalanceThresholdCondition;
  onChange: (condition: BalanceThresholdCondition) => void;
  errors?: Record<string, string>;
}

const OPERATORS: { value: ThresholdOperator; label: string }[] = [
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'eq', label: '=' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
];

export function BalanceConfig({ value, onChange, errors = {} }: BalanceConfigProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Get notified when an account balance crosses a threshold.
      </p>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Account Address <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="0x1234...5678"
          className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm font-mono
                     text-slate-100 placeholder:text-slate-600
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-colors
                     ${errors.address ? 'border-red-500' : 'border-slate-700'}`}
        />
        {errors.address && (
          <p className="mt-1 text-xs text-red-400">{errors.address}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Token Type <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={value.tokenType}
          onChange={(e) => onChange({ ...value, tokenType: e.target.value })}
          placeholder="0x1::aptos_coin::AptosCoin"
          className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm font-mono
                     text-slate-100 placeholder:text-slate-600
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-colors
                     ${errors.tokenType ? 'border-red-500' : 'border-slate-700'}`}
        />
        {errors.tokenType && (
          <p className="mt-1 text-xs text-red-400">{errors.tokenType}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Full type path of the token to monitor
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Operator <span className="text-red-400">*</span>
          </label>
          <select
            value={value.operator}
            onChange={(e) =>
              onChange({ ...value, operator: e.target.value as ThresholdOperator })
            }
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm
                       text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500
                       focus:border-transparent transition-colors"
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                Balance {op.label} Threshold
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Threshold <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={value.threshold}
            onChange={(e) => onChange({ ...value, threshold: e.target.value })}
            placeholder="1000000000"
            className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm font-mono
                       text-slate-100 placeholder:text-slate-600
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       transition-colors
                       ${errors.threshold ? 'border-red-500' : 'border-slate-700'}`}
          />
          {errors.threshold && (
            <p className="mt-1 text-xs text-red-400">{errors.threshold}</p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Note: Threshold is in the smallest unit (e.g., 1 MOVE = 100000000 octas)
      </p>
    </div>
  );
}
