'use client';

import { useSimulatorStore } from '@/stores/simulator';

export function FunctionInput() {
  const {
    moduleAddress,
    moduleName,
    functionName,
    setModuleAddress,
    setModuleName,
    setFunctionName,
    errors,
  } = useSimulatorStore();

  return (
    <div className="space-y-4">
      {/* Module Address */}
      <div className="space-y-2">
        <label htmlFor="moduleAddress" className="block text-sm font-medium text-dark-300">
          Module Address
        </label>
        <input
          id="moduleAddress"
          type="text"
          value={moduleAddress}
          onChange={(e) => setModuleAddress(e.target.value)}
          placeholder="0x1"
          className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono text-dark-100
                     placeholder:text-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500
                     focus:border-transparent transition-colors
                     ${errors.moduleAddress ? 'border-red-500' : 'border-dark-700'}`}
        />
        {errors.moduleAddress && (
          <p className="text-xs text-red-400">{errors.moduleAddress}</p>
        )}
      </div>

      {/* Module Name & Function Name (side by side) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="moduleName" className="block text-sm font-medium text-dark-300">
            Module Name
          </label>
          <input
            id="moduleName"
            type="text"
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            placeholder="coin"
            className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono text-dark-100
                       placeholder:text-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500
                       focus:border-transparent transition-colors
                       ${errors.moduleName ? 'border-red-500' : 'border-dark-700'}`}
          />
          {errors.moduleName && (
            <p className="text-xs text-red-400">{errors.moduleName}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="functionName" className="block text-sm font-medium text-dark-300">
            Function Name
          </label>
          <input
            id="functionName"
            type="text"
            value={functionName}
            onChange={(e) => setFunctionName(e.target.value)}
            placeholder="transfer"
            className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono text-dark-100
                       placeholder:text-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500
                       focus:border-transparent transition-colors
                       ${errors.functionName ? 'border-red-500' : 'border-dark-700'}`}
          />
          {errors.functionName && (
            <p className="text-xs text-red-400">{errors.functionName}</p>
          )}
        </div>
      </div>

      {/* Function path preview */}
      <div className="bg-dark-900/50 border border-dark-800 rounded-lg px-3 py-2">
        <span className="text-xs text-dark-500">Function path: </span>
        <code className="text-xs text-primary-400 font-mono">
          {moduleAddress}::{moduleName}::{functionName}
        </code>
      </div>
    </div>
  );
}
