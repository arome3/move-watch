'use client';

import { useState } from 'react';
import { useSimulatorStore } from '@/stores/simulator';

export function ArgumentsEditor() {
  const { argumentsJson, setArgumentsJson, errors } = useSimulatorStore();
  const [isFocused, setIsFocused] = useState(false);

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(argumentsJson);
      setArgumentsJson(JSON.stringify(parsed, null, 2));
    } catch {
      // Invalid JSON, can't format
    }
  };

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(argumentsJson);
      setArgumentsJson(JSON.stringify(parsed));
    } catch {
      // Invalid JSON, can't minify
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="arguments" className="block text-sm font-medium text-slate-300">
          Function Arguments (JSON)
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleFormat}
            className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            Format
          </button>
          <button
            type="button"
            onClick={handleMinify}
            className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            Minify
          </button>
        </div>
      </div>

      <div className="relative">
        <textarea
          id="arguments"
          value={argumentsJson}
          onChange={(e) => setArgumentsJson(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder='["arg1", "arg2"]'
          rows={5}
          className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm font-mono text-slate-100
                     placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500
                     focus:border-transparent transition-colors resize-none
                     ${errors.argumentsJson ? 'border-red-500' : 'border-slate-700'}`}
        />

        {/* Line numbers overlay */}
        {isFocused && (
          <div className="absolute top-0 left-0 pointer-events-none opacity-0">
            {/* Could add line numbers here if desired */}
          </div>
        )}
      </div>

      {errors.argumentsJson ? (
        <p className="text-xs text-red-400">{errors.argumentsJson}</p>
      ) : (
        <p className="text-xs text-slate-500">
          Enter function arguments as a JSON array
        </p>
      )}

      {/* Example hint */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2">
        <p className="text-xs text-slate-500">
          Example: <code className="text-primary-400">["0xaddress...", "1000000"]</code>
        </p>
      </div>
    </div>
  );
}
