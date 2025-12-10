'use client';

import { useState } from 'react';
import { useSimulatorStore } from '@/stores/simulator';
import { NetworkSelector } from './NetworkSelector';
import { FunctionInput } from './FunctionInput';
import { TypeArguments } from './TypeArguments';
import { ArgumentsEditor } from './ArgumentsEditor';
import { GasOptions } from './GasOptions';

interface TransactionBuilderProps {
  onSimulate: () => Promise<void>;
  isLoading: boolean;
}

export function TransactionBuilder({ onSimulate, isLoading }: TransactionBuilderProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { isValid } = useSimulatorStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;
    await onSimulate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-50">Transaction Builder</h2>
          <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">
            Entry Function
          </span>
        </div>

        {/* Network Selection */}
        <NetworkSelector />

        {/* Function Path */}
        <FunctionInput />

        {/* Type Arguments */}
        <TypeArguments />

        {/* Function Arguments */}
        <ArgumentsEditor />

        {/* Advanced Options (collapsible) */}
        <div className="border-t border-slate-700 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Advanced Options
          </button>

          {showAdvanced && <GasOptions />}
        </div>
      </div>

      {/* Simulate Button */}
      <button
        type="submit"
        disabled={!isValid || isLoading}
        className={`w-full py-3 px-4 rounded-xl font-medium text-sm transition-all
                   ${
                     isValid && !isLoading
                       ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/25'
                       : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                   }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Simulating...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
            Simulate Transaction
          </span>
        )}
      </button>

      {/* Keyboard shortcut hint */}
      <p className="text-center text-xs text-slate-500">
        Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">Cmd</kbd> +{' '}
        <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">Enter</kbd> to simulate
      </p>
    </form>
  );
}
