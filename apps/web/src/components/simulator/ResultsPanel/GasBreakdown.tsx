'use client';

import { useState } from 'react';
import type {
  GasBreakdown as GasBreakdownType,
  GasOperation,
  GasOptimization,
  GasEfficiencyScore,
  GasEstimate,
  StorageCostProjection,
} from '@movewatch/shared';

interface GasBreakdownProps {
  gasUsed: number;
  gasBreakdown: GasBreakdownType;
}

const categoryColors: Record<string, { bg: string; bar: string }> = {
  execution: { bg: 'bg-blue-500/20', bar: 'bg-blue-500' },
  io: { bg: 'bg-cyan-500/20', bar: 'bg-cyan-500' },
  storage: { bg: 'bg-green-500/20', bar: 'bg-green-500' },
  intrinsic: { bg: 'bg-purple-500/20', bar: 'bg-purple-500' },
  dependencies: { bg: 'bg-orange-500/20', bar: 'bg-orange-500' },
};

const operationTypeColors: Record<string, string> = {
  call: 'text-blue-400',
  load_resource: 'text-cyan-400',
  write_resource: 'text-green-400',
  create_resource: 'text-emerald-400',
  delete_resource: 'text-red-400',
  emit_event: 'text-purple-400',
  vector_op: 'text-yellow-400',
  table_op: 'text-orange-400',
};

const severityColors: Record<string, { bg: string; border: string; text: string }> = {
  warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  suggestion: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  info: { bg: 'bg-dark-800', border: 'border-dark-700', text: 'text-dark-400' },
};

const gradeColors: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-green-500/20', text: 'text-green-400' },
  B: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  C: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  D: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  F: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

function OperationItem({ operation, totalGas }: { operation: GasOperation; totalGas: number }) {
  const colorClass = operationTypeColors[operation.operation] || 'text-dark-400';
  const displayName = operation.function
    ? `${operation.module || ''}::${operation.function}`
    : operation.operation.replace(/_/g, ' ');

  return (
    <div className="flex items-center justify-between py-2 border-b border-dark-800 last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className={`text-xs font-medium px-2 py-0.5 rounded bg-dark-900 ${colorClass}`}>
          {operation.operation.replace(/_/g, ' ')}
        </span>
        <span className="text-sm text-dark-400 truncate font-mono" title={displayName}>
          {displayName}
        </span>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
        <span className="text-sm font-mono text-dark-300">{operation.gasUsed.toLocaleString()}</span>
        <span className="text-xs text-dark-500 w-12 text-right">{operation.percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function ConfidenceInterval({ estimate }: { estimate: GasEstimate }) {
  const confidencePercent = Math.round(estimate.confidence * 100);
  const range = estimate.upper - estimate.lower;

  return (
    <div className="bg-dark-900/50 border border-dark-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-dark-500 uppercase tracking-wider">Gas Estimate</span>
        <span className={`text-xs px-2 py-0.5 rounded ${
          confidencePercent >= 90 ? 'bg-green-500/20 text-green-400' :
          confidencePercent >= 80 ? 'bg-blue-500/20 text-blue-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          {confidencePercent}% confidence
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-lg text-dark-100">{estimate.predicted.toLocaleString()}</span>
        <span className="text-sm text-dark-400">
          ± {Math.round(range / 2).toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-dark-500">
        <span>Range:</span>
        <span className="font-mono">{estimate.lower.toLocaleString()}</span>
        <span>—</span>
        <span className="font-mono">{estimate.upper.toLocaleString()}</span>
      </div>
      {estimate.factors.length > 0 && (
        <div className="pt-2 border-t border-dark-800">
          <p className="text-xs text-dark-500 mb-1">Factors affecting estimate:</p>
          <ul className="text-xs text-dark-400 space-y-0.5">
            {estimate.factors.map((factor, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-dark-600">•</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EfficiencyScoreCard({ score }: { score: GasEfficiencyScore }) {
  const gradeStyle = gradeColors[score.grade];
  const isEstimate = score.comparison.isEstimate;
  const sampleSize = score.comparison.sampleSize ?? 0;
  const hasRealData = sampleSize >= 10;

  return (
    <div className="bg-dark-900/50 border border-dark-800 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500 uppercase tracking-wider">Efficiency Score</span>
          {isEstimate ? (
            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
              Estimated
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
              Real Data
            </span>
          )}
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${gradeStyle.bg}`}>
          <span className={`text-lg font-bold ${gradeStyle.text}`}>{score.grade}</span>
          <span className={`text-sm ${gradeStyle.text}`}>{score.score}/100</span>
        </div>
      </div>

      <div className="text-sm text-dark-400">
        This transaction is in the <span className="text-dark-200 font-medium">top {score.comparison.percentile}%</span> for
        gas efficiency compared to similar transactions.
        {isEstimate && (
          <span className="text-yellow-400/70 text-xs ml-1">
            (based on estimated benchmarks)
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dark-800">
        <div className="text-center">
          <div className="text-xs text-dark-500 mb-1">Compute</div>
          <div className={`text-sm font-mono ${
            score.breakdown.computeEfficiency >= 80 ? 'text-green-400' :
            score.breakdown.computeEfficiency >= 50 ? 'text-yellow-400' :
            'text-red-400'
          }`}>{score.breakdown.computeEfficiency}%</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-dark-500 mb-1">Storage</div>
          <div className={`text-sm font-mono ${
            score.breakdown.storageEfficiency >= 80 ? 'text-green-400' :
            score.breakdown.storageEfficiency >= 50 ? 'text-yellow-400' :
            'text-red-400'
          }`}>{score.breakdown.storageEfficiency}%</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-dark-500 mb-1">I/O</div>
          <div className={`text-sm font-mono ${
            score.breakdown.ioEfficiency >= 80 ? 'text-green-400' :
            score.breakdown.ioEfficiency >= 50 ? 'text-yellow-400' :
            'text-red-400'
          }`}>{score.breakdown.ioEfficiency}%</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-dark-500 pt-2 border-t border-dark-800">
        <span>Avg for type: {score.comparison.averageForType.toLocaleString()}</span>
        <span>Median: {score.comparison.medianForType.toLocaleString()}</span>
      </div>

      {/* Data source indicator */}
      <div className="flex items-center justify-center text-[10px] text-dark-600 pt-1">
        {hasRealData ? (
          <span>Based on {sampleSize.toLocaleString()} real transactions</span>
        ) : (
          <span>Benchmarks will improve as more network data is collected</span>
        )}
      </div>
    </div>
  );
}

function OptimizationsList({ optimizations }: { optimizations: GasOptimization[] }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-dark-500 uppercase tracking-wider">Optimization Suggestions</div>
      {optimizations.map((opt) => {
        const style = severityColors[opt.severity];
        return (
          <div
            key={opt.id}
            className={`${style.bg} border ${style.border} rounded-lg p-3 space-y-2`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                  {opt.category}
                </span>
                <span className="text-sm font-medium text-dark-200">{opt.title}</span>
              </div>
              {opt.potentialSavings && (
                <span className="text-xs text-green-400 whitespace-nowrap">
                  Save ~{opt.potentialSavings.toLocaleString()} gas
                  {opt.potentialSavingsPercent && ` (${opt.potentialSavingsPercent}%)`}
                </span>
              )}
            </div>
            <p className="text-xs text-dark-400">{opt.description}</p>
            <p className="text-xs text-dark-300 italic">{opt.recommendation}</p>
            {opt.codeLocation && (
              <p className="text-xs text-dark-500 font-mono">
                Location: {opt.codeLocation.module}::{opt.codeLocation.operation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StorageCostsCard({ costs }: { costs: StorageCostProjection }) {
  const hasAllocation = costs.bytesAllocated > 0;
  const hasDeallocation = costs.bytesFreed > 0;

  return (
    <div className="bg-dark-900/50 border border-dark-800 rounded-lg p-3 space-y-3">
      <div className="text-xs text-dark-500 uppercase tracking-wider">Storage Cost Projection</div>

      <div className="grid grid-cols-2 gap-4">
        {hasAllocation && (
          <div>
            <div className="text-xs text-dark-500 mb-1">Allocation</div>
            <div className="text-sm text-red-400 font-mono">+{costs.allocationCost.toLocaleString()} gas</div>
            <div className="text-xs text-dark-500">{costs.bytesAllocated} bytes</div>
            <div className="text-xs text-dark-500">{costs.newResourcesCreated} resource(s)</div>
          </div>
        )}
        {hasDeallocation && (
          <div>
            <div className="text-xs text-dark-500 mb-1">Refund (50%)</div>
            <div className="text-sm text-green-400 font-mono">-{costs.deallocationRefund.toLocaleString()} gas</div>
            <div className="text-xs text-dark-500">{costs.bytesFreed} bytes freed</div>
            <div className="text-xs text-dark-500">{costs.resourcesDeleted} resource(s)</div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-dark-800">
        <span className="text-sm text-dark-400">Net Storage Cost</span>
        <div className="text-right">
          <span className={`text-sm font-mono ${costs.netStorageCost >= 0 ? 'text-red-400' : 'text-green-400'}`}>
            {costs.netStorageCost >= 0 ? '+' : ''}{costs.netStorageCost.toLocaleString()} gas
          </span>
          <div className="text-xs text-dark-500">
            ~{costs.netStorageCost >= 0 ? costs.allocationCostMove : costs.deallocationRefundMove} MOVE
          </div>
        </div>
      </div>
    </div>
  );
}

export function GasBreakdown({ gasUsed, gasBreakdown }: GasBreakdownProps) {
  const [view, setView] = useState<'summary' | 'operations' | 'optimize'>('summary');

  const computePercent = gasUsed > 0 ? (gasBreakdown.computation / gasUsed) * 100 : 0;
  const storagePercent = 100 - computePercent;

  // Use enhanced breakdown if available
  const hasEnhancedBreakdown = gasBreakdown.byCategory !== undefined;
  const hasOperations = gasBreakdown.operations && gasBreakdown.operations.length > 0;
  const hasEstimate = gasBreakdown.estimate !== undefined;
  const hasOptimizations = gasBreakdown.optimizations && gasBreakdown.optimizations.length > 0;
  const hasEfficiencyScore = gasBreakdown.efficiencyScore !== undefined;
  const hasStorageCosts = gasBreakdown.storageCosts !== undefined;
  const hasOptimizeTab = hasEstimate || hasOptimizations || hasEfficiencyScore || hasStorageCosts;

  return (
    <div className="space-y-4">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-dark-300">Gas Breakdown</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('summary')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              view === 'summary'
                ? 'bg-primary-500/20 text-primary-400'
                : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
            }`}
          >
            Summary
          </button>
          {hasOperations && (
            <button
              onClick={() => setView('operations')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                view === 'operations'
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
              }`}
            >
              Operations ({gasBreakdown.operations?.length})
            </button>
          )}
          {hasOptimizeTab && (
            <button
              onClick={() => setView('optimize')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                view === 'optimize'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
              }`}
            >
              Optimize
            </button>
          )}
        </div>
      </div>

      {/* Total Gas */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-dark-400">Total Gas Used</span>
        <span className="font-mono text-lg text-dark-100">{gasUsed.toLocaleString()}</span>
      </div>

      {view === 'summary' ? (
        <>
          {/* Enhanced Category Breakdown */}
          {hasEnhancedBreakdown && gasBreakdown.byCategory ? (
            <div className="space-y-3">
              <div className="text-xs text-dark-500 uppercase tracking-wider">By Category</div>
              {Object.entries(gasBreakdown.byCategory).map(([category, value]) => {
                const percent = gasUsed > 0 ? (value / gasUsed) * 100 : 0;
                const colors = categoryColors[category] || categoryColors.execution;
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-dark-400 capitalize">{category}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-dark-300">{value.toLocaleString()}</span>
                        <span className="text-xs text-dark-500 w-12 text-right">
                          {percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors.bar} transition-all duration-500`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Basic breakdown (computation vs storage) */
            <div className="space-y-2">
              <div className="h-4 bg-dark-700 rounded-full overflow-hidden flex">
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
                  <span className="text-dark-400">
                    Computation:{' '}
                    <span className="text-dark-300">{gasBreakdown.computation.toLocaleString()}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-dark-400">
                    Storage:{' '}
                    <span className="text-dark-300">{gasBreakdown.storage.toLocaleString()}</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      ) : view === 'operations' ? (
        /* Operations view */
        <div className="bg-dark-900/50 border border-dark-800 rounded-lg p-3 max-h-80 overflow-y-auto">
          {gasBreakdown.operations?.map((operation, idx) => (
            <OperationItem key={idx} operation={operation} totalGas={gasUsed} />
          ))}
        </div>
      ) : (
        /* Optimize view */
        <div className="space-y-4">
          {/* Confidence Intervals */}
          {hasEstimate && gasBreakdown.estimate && (
            <ConfidenceInterval estimate={gasBreakdown.estimate} />
          )}

          {/* Efficiency Score */}
          {hasEfficiencyScore && gasBreakdown.efficiencyScore && (
            <EfficiencyScoreCard score={gasBreakdown.efficiencyScore} />
          )}

          {/* Storage Costs */}
          {hasStorageCosts && gasBreakdown.storageCosts && (
            <StorageCostsCard costs={gasBreakdown.storageCosts} />
          )}

          {/* Optimization Suggestions */}
          {hasOptimizations && gasBreakdown.optimizations && (
            <OptimizationsList optimizations={gasBreakdown.optimizations} />
          )}
        </div>
      )}

      {/* Estimated Cost */}
      <div className="bg-dark-900/50 border border-dark-800 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-dark-500">Estimated Cost</span>
          <span className="text-sm font-mono text-dark-300">
            ~{((gasUsed * 100) / 100000000).toFixed(6)} MOVE
          </span>
        </div>
        <p className="mt-1 text-xs text-dark-500">Based on gas unit price of 100</p>
      </div>
    </div>
  );
}
