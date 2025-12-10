'use client';

import type { SimulationError } from '@movewatch/shared';

interface ErrorDisplayProps {
  error: SimulationError;
}

export function ErrorDisplay({ error }: ErrorDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Error Message */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-red-400">{error.code}</h4>
            <p className="mt-1 text-sm text-red-300">{error.message}</p>
          </div>
        </div>
      </div>

      {/* Suggestion */}
      {error.suggestion && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-400">Suggestion</h4>
              <p className="mt-1 text-sm text-amber-300">{error.suggestion}</p>
            </div>
          </div>
        </div>
      )}

      {/* VM Status (collapsible) */}
      <details className="group">
        <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300 transition-colors">
          View raw VM status
        </summary>
        <pre className="mt-2 p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-400 overflow-x-auto">
          {error.vmStatus}
        </pre>
      </details>
    </div>
  );
}
