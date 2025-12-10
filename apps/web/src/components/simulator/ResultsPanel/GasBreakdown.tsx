'use client';

import type { GasBreakdown as GasBreakdownType } from '@movewatch/shared';

interface GasBreakdownProps {
  gasUsed: number;
  gasBreakdown: GasBreakdownType;
}

export function GasBreakdown({ gasUsed, gasBreakdown }: GasBreakdownProps) {
  const computePercent = gasUsed > 0 ? (gasBreakdown.computation / gasUsed) * 100 : 0;
  const storagePercent = 100 - computePercent;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-slate-300">Gas Breakdown</h3>

      {/* Total Gas */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">Total Gas Used</span>
        <span className="font-mono text-lg text-slate-100">{gasUsed.toLocaleString()}</span>
      </div>

      {/* Visual Bar */}
      <div className="space-y-2">
        <div className="h-4 bg-slate-700 rounded-full overflow-hidden flex">
          <div
            className="bg-blue-500 h-full transition-all duration-500"
            style={{ width: `${computePercent}%` }}
            title={`Computation: ${gasBreakdown.computation}`}
          />
          <div
            className="bg-green-500 h-full transition-all duration-500"
            style={{ width: `${storagePercent}%` }}
            title={`Storage: ${gasBreakdown.storage}`}
          />
        </div>

        {/* Legend */}
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-slate-400">
              Computation: <span className="text-slate-300">{gasBreakdown.computation.toLocaleString()}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-slate-400">
              Storage: <span className="text-slate-300">{gasBreakdown.storage.toLocaleString()}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Estimated Cost */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Estimated Cost</span>
          <span className="text-sm font-mono text-slate-300">
            ~{(gasUsed * 100 / 100000000).toFixed(6)} MOVE
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Based on gas unit price of 100
        </p>
      </div>
    </div>
  );
}
