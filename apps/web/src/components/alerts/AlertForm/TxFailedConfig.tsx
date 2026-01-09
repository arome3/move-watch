'use client';

import type { TxFailedCondition } from '@movewatch/shared';

interface TxFailedConfigProps {
  value: TxFailedCondition;
  onChange: (condition: TxFailedCondition) => void;
  errors?: Record<string, string>;
}

export function TxFailedConfig({ value, onChange, errors = {} }: TxFailedConfigProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-dark-400">
        Get notified when transactions fail for a specific module or function.
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
          Function Name <span className="text-dark-500">(optional)</span>
        </label>
        <input
          type="text"
          value={value.functionName || ''}
          onChange={(e) =>
            onChange({
              ...value,
              functionName: e.target.value || undefined,
            })
          }
          placeholder="transfer"
          className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono
                     text-dark-100 placeholder:text-dark-600
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-colors border-dark-700`}
        />
        <p className="mt-1 text-xs text-dark-500">
          Leave empty to monitor all functions in the module
        </p>
      </div>
    </div>
  );
}
