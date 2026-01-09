'use client';

import type { FunctionCallCondition } from '@movewatch/shared';

interface FunctionCallConfigProps {
  value: FunctionCallCondition;
  onChange: (condition: FunctionCallCondition) => void;
  errors?: Record<string, string>;
}

export function FunctionCallConfig({ value, onChange, errors = {} }: FunctionCallConfigProps) {
  return (
    <div className="space-y-4">
      <div className="bg-dark-800/50 rounded-lg p-3 border border-dark-700">
        <p className="text-xs text-dark-400">
          Monitor when a specific function is called on a module. Useful for tracking contract usage,
          detecting specific operations, or auditing function invocations.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1.5">
          Module Address <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={value.moduleAddress}
          onChange={(e) => onChange({ ...value, moduleAddress: e.target.value })}
          placeholder="0x1"
          className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                   placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                   font-mono text-sm"
        />
        {errors.moduleAddress && (
          <p className="mt-1 text-xs text-red-400">{errors.moduleAddress}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-1.5">
            Module Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={value.moduleName}
            onChange={(e) => onChange({ ...value, moduleName: e.target.value })}
            placeholder="coin"
            className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                     placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                     font-mono text-sm"
          />
          {errors.moduleName && (
            <p className="mt-1 text-xs text-red-400">{errors.moduleName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-1.5">
            Function Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={value.functionName}
            onChange={(e) => onChange({ ...value, functionName: e.target.value })}
            placeholder="transfer"
            className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                     placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                     font-mono text-sm"
          />
          {errors.functionName && (
            <p className="mt-1 text-xs text-red-400">{errors.functionName}</p>
          )}
        </div>
      </div>

      {/* Full path preview */}
      {value.moduleAddress && value.moduleName && value.functionName && (
        <div className="bg-dark-900/50 rounded-lg p-3 border border-dark-700/50">
          <p className="text-xs text-dark-500 mb-1">Full function path:</p>
          <code className="text-sm text-primary-400 font-mono">
            {value.moduleAddress}::{value.moduleName}::{value.functionName}
          </code>
        </div>
      )}

      <div className="border-t border-dark-700 pt-4">
        <p className="text-sm font-medium text-dark-300 mb-3">Track Options</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.trackSuccess ?? true}
              onChange={(e) => onChange({ ...value, trackSuccess: e.target.checked })}
              className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500
                       focus:ring-primary-500/50 focus:ring-offset-0"
            />
            <span className="text-sm text-dark-300">Successful calls</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.trackFailed ?? false}
              onChange={(e) => onChange({ ...value, trackFailed: e.target.checked })}
              className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500
                       focus:ring-primary-500/50 focus:ring-offset-0"
            />
            <span className="text-sm text-dark-300">Failed calls</span>
          </label>
        </div>
      </div>

      <div className="border-t border-dark-700 pt-4">
        <p className="text-sm font-medium text-dark-300 mb-3">Optional Filters</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-dark-400 mb-1.5">
              Sender Address
            </label>
            <input
              type="text"
              value={value.filters?.sender || ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  filters: { ...value.filters, sender: e.target.value || undefined },
                })
              }
              placeholder="0x... (optional)"
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                       placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                       font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-400 mb-1.5">
              Min Gas Used
            </label>
            <input
              type="number"
              value={value.filters?.minGas || ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  filters: {
                    ...value.filters,
                    minGas: e.target.value ? parseInt(e.target.value) : undefined,
                  },
                })
              }
              placeholder="0"
              min={0}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                       placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                       text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
