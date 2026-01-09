'use client';

import type { GasSpikeCondition } from '@movewatch/shared';

interface GasSpikeConfigProps {
  value: GasSpikeCondition;
  onChange: (condition: GasSpikeCondition) => void;
  errors?: Record<string, string>;
}

export function GasSpikeConfig({ value, onChange, errors = {} }: GasSpikeConfigProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-dark-400">
        Get notified when gas usage exceeds normal levels for a module.
      </p>

      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Module Address <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={value.moduleAddress}
          onChange={(e) =>
            onChange({ ...value, moduleAddress: e.target.value })
          }
          placeholder="0x1::coin"
          className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono
                     text-dark-100 placeholder:text-dark-600
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-colors
                     ${errors.moduleAddress ? 'border-red-500' : 'border-dark-700'}`}
        />
        {errors.moduleAddress && (
          <p className="mt-1 text-xs text-red-400">{errors.moduleAddress}</p>
        )}
        <p className="mt-1 text-xs text-dark-500">
          Format: 0x[address]::[module_name]
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Threshold Multiplier <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={value.thresholdMultiplier}
            onChange={(e) =>
              onChange({ ...value, thresholdMultiplier: parseFloat(e.target.value) })
            }
            className="flex-1 h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-16 text-center font-mono text-dark-100">
            {value.thresholdMultiplier}x
          </span>
        </div>
        {errors.thresholdMultiplier && (
          <p className="mt-1 text-xs text-red-400">{errors.thresholdMultiplier}</p>
        )}
        <p className="mt-1 text-xs text-dark-500">
          Alert when gas usage is {value.thresholdMultiplier}x above average
        </p>
      </div>

      <div className="bg-dark-800/50 rounded-lg p-3 border border-dark-700">
        <p className="text-xs text-dark-400">
          <strong className="text-dark-300">How it works:</strong> We track the
          average gas usage for the module over time. When a transaction uses{' '}
          {value.thresholdMultiplier}x more gas than the average, you'll be notified.
        </p>
      </div>
    </div>
  );
}
