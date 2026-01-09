'use client';

import { useState, useEffect } from 'react';
import { useSimulatorStore } from '@/stores/simulator';

// ============================================================================
// TYPES
// ============================================================================

interface GasCharacteristic {
  name: string;
  value: string;
  description: string;
  impact: 'positive' | 'neutral' | 'negative';
}

interface FeeComponent {
  name: string;
  description: string;
  formula?: string;
  percentage?: number;
}

interface GasModelDetails {
  name: string;
  description: string;
  characteristics: GasCharacteristic[];
  feeComponents: FeeComponent[];
  pricing: {
    minGasUnitPrice: number;
    recommendedGasUnitPrice: number;
    storagePerByte: number;
    executionMultiplier: number;
  };
}

interface ComparisonResult {
  gasCostRatio: number;
  storageCostRatio: number;
  finalityTime: { movement: string; other: string };
  notes: string[];
}

interface NetworkComparison {
  movementVsAptos: ComparisonResult;
  movementVsSui: ComparisonResult;
  summary: string;
}

interface GasOptimizationTip {
  id: string;
  category: 'storage' | 'computation' | 'batching' | 'pattern';
  title: string;
  description: string;
  potentialSavings: string;
  applicable: boolean;
  reason?: string;
}

interface CostEstimate {
  low: number;
  expected: number;
  high: number;
  formatted: string;
}

interface CostProjection {
  singleTx: CostEstimate;
  daily100Tx: CostEstimate;
  monthly: CostEstimate;
  currency: 'MOVE' | 'USD';
}

interface MovementFeature {
  id: string;
  name: string;
  description: string;
  benefit: string;
  available: boolean;
}

interface GasModelAnalysis {
  network: string;
  model: GasModelDetails;
  comparison?: NetworkComparison;
  optimizations: GasOptimizationTip[];
  costProjection: CostProjection;
}

interface GasEstimates {
  [key: string]: { gas: number; cost: string };
}

// ============================================================================
// API
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getGasAnalysis(
  network: string,
  gasUsed?: number,
  functionPath?: string
): Promise<GasModelAnalysis | null> {
  try {
    const params = new URLSearchParams({ network });
    if (gasUsed) params.append('gasUsed', String(gasUsed));
    if (functionPath) params.append('function', functionPath);

    const response = await fetch(`${API_URL}/v1/modules/gas/analyze?${params}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function getGasEstimates(): Promise<GasEstimates> {
  try {
    const response = await fetch(`${API_URL}/v1/modules/gas/estimates`);
    if (!response.ok) return {};
    const data = await response.json();
    return data.estimates;
  } catch {
    return {};
  }
}

async function getMovementFeatures(): Promise<MovementFeature[]> {
  try {
    const response = await fetch(`${API_URL}/v1/modules/movement/features`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.features;
  } catch {
    return [];
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GasModelInfo() {
  const { network, result, moduleAddress, moduleName, functionName } = useSimulatorStore();
  const [analysis, setAnalysis] = useState<GasModelAnalysis | null>(null);
  const [estimates, setEstimates] = useState<GasEstimates>({});
  const [movementFeatures, setMovementFeatures] = useState<MovementFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'model' | 'comparison' | 'tips' | 'features'>('model');

  // Load gas estimates and Movement features on mount
  useEffect(() => {
    getGasEstimates().then(setEstimates);
    getMovementFeatures().then(setMovementFeatures);
  }, []);

  // Analyze when simulation result changes
  useEffect(() => {
    if (!result) {
      // Still load the model info even without a result
      setIsLoading(true);
      getGasAnalysis(network)
        .then(setAnalysis)
        .finally(() => setIsLoading(false));
      return;
    }

    const functionPath = moduleAddress && moduleName && functionName
      ? `${moduleAddress}::${moduleName}::${functionName}`
      : undefined;

    setIsLoading(true);
    getGasAnalysis(network, result.gasUsed, functionPath)
      .then(setAnalysis)
      .finally(() => setIsLoading(false));
  }, [result, network, moduleAddress, moduleName, functionName]);

  const impactColors: Record<string, string> = {
    positive: 'text-green-400',
    neutral: 'text-dark-300',
    negative: 'text-red-400',
  };

  const impactIcons: Record<string, string> = {
    positive: 'M5 13l4 4L19 7',
    neutral: 'M20 12H4',
    negative: 'M6 18L18 6M6 6l12 12',
  };

  const categoryColors: Record<string, string> = {
    storage: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    computation: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    batching: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    pattern: 'bg-green-500/10 text-green-400 border-green-500/30',
  };

  if (isLoading && !analysis) {
    return (
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
        <div className="flex items-center justify-center py-8">
          <svg
            className="animate-spin h-6 w-6 text-primary-500"
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
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <h3 className="text-sm font-medium text-dark-100">Movement Gas Model</h3>
        </div>
        <span className="px-2 py-0.5 text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded">
          {network}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-900 rounded-lg p-1">
        {[
          { id: 'model', label: 'Gas Model' },
          { id: 'comparison', label: 'vs Other Chains' },
          { id: 'tips', label: 'Optimizations' },
          { id: 'features', label: 'Movement' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === tab.id
                ? 'bg-dark-700 text-dark-100'
                : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {/* Gas Model Tab */}
        {activeTab === 'model' && (
          <div className="space-y-4">
            {/* Cost Projection (if we have a result) */}
            {result && analysis.costProjection && (
              <div className="bg-dark-900/50 rounded-lg p-3 border border-dark-700">
                <h4 className="text-xs font-medium text-dark-400 mb-2">Cost Projection</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-primary-400">
                      {analysis.costProjection.singleTx.formatted}
                    </div>
                    <div className="text-[10px] text-dark-500">This Transaction</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-cyan-400">
                      {analysis.costProjection.daily100Tx.formatted}
                    </div>
                    <div className="text-[10px] text-dark-500">100 tx/day</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-purple-400">
                      {analysis.costProjection.monthly.formatted}
                    </div>
                    <div className="text-[10px] text-dark-500">Monthly (3K tx)</div>
                  </div>
                </div>
              </div>
            )}

            {/* Fee Components */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-dark-400 uppercase tracking-wider">
                Fee Components
              </h4>
              <div className="space-y-2">
                {analysis.model.feeComponents.map((component, i) => (
                  <div
                    key={i}
                    className="bg-dark-900/30 rounded-lg p-3 border border-dark-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-dark-200">{component.name}</span>
                      {component.percentage && (
                        <span className="text-xs text-dark-400">~{component.percentage}%</span>
                      )}
                    </div>
                    <p className="text-xs text-dark-500">{component.description}</p>
                    {component.formula && (
                      <code className="block mt-1 text-[10px] text-primary-400 bg-dark-900 px-2 py-1 rounded">
                        {component.formula}
                      </code>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Common Operation Costs */}
            {Object.keys(estimates).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-dark-400 uppercase tracking-wider">
                  Typical Costs
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(estimates).slice(0, 6).map(([op, data]) => (
                    <div
                      key={op}
                      className="bg-dark-900/30 rounded-lg px-3 py-2 border border-dark-800"
                    >
                      <div className="text-xs text-dark-300 truncate">{op}</div>
                      <div className="text-sm font-medium text-primary-400">{data.cost}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comparison Tab */}
        {activeTab === 'comparison' && analysis.comparison && (
          <div className="space-y-4">
            <p className="text-xs text-dark-400">{analysis.comparison.summary}</p>

            {/* Movement vs Aptos */}
            <div className="bg-dark-900/50 rounded-lg p-3 border border-dark-700">
              <h4 className="text-xs font-medium text-dark-300 mb-3">Movement vs Aptos</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-dark-500 mb-1">Gas Cost Ratio</div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-bold text-green-400">
                      {(analysis.comparison.movementVsAptos.gasCostRatio * 100).toFixed(0)}%
                    </div>
                    <span className="text-xs text-green-400">
                      {analysis.comparison.movementVsAptos.gasCostRatio < 1 ? 'cheaper' : 'more'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-dark-500 mb-1">Finality</div>
                  <div className="text-sm">
                    <div className="text-cyan-400">
                      {analysis.comparison.movementVsAptos.finalityTime.movement}
                    </div>
                    <div className="text-dark-500 text-xs">
                      vs {analysis.comparison.movementVsAptos.finalityTime.other}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {analysis.comparison.movementVsAptos.notes.slice(0, 3).map((note, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <svg
                      className="h-3 w-3 text-dark-500 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <span className="text-xs text-dark-400">{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Movement vs Sui */}
            <div className="bg-dark-900/50 rounded-lg p-3 border border-dark-700">
              <h4 className="text-xs font-medium text-dark-300 mb-3">Movement vs Sui</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-dark-500 mb-1">Gas Cost Ratio</div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-bold text-yellow-400">
                      {(analysis.comparison.movementVsSui.gasCostRatio * 100).toFixed(0)}%
                    </div>
                    <span className="text-xs text-dark-400">varies</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-dark-500 mb-1">Finality</div>
                  <div className="text-sm">
                    <div className="text-cyan-400">
                      {analysis.comparison.movementVsSui.finalityTime.movement}
                    </div>
                    <div className="text-dark-500 text-xs">
                      vs {analysis.comparison.movementVsSui.finalityTime.other}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {analysis.comparison.movementVsSui.notes.slice(0, 3).map((note, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <svg
                      className="h-3 w-3 text-dark-500 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <span className="text-xs text-dark-400">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Optimization Tips Tab */}
        {activeTab === 'tips' && (
          <div className="space-y-3">
            {analysis.optimizations.map((tip) => (
              <div
                key={tip.id}
                className="bg-dark-900/30 rounded-lg p-3 border border-dark-800"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded border ${
                      categoryColors[tip.category]
                    }`}
                  >
                    {tip.category}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-dark-200">{tip.title}</span>
                      <span className="text-xs text-green-400">{tip.potentialSavings}</span>
                    </div>
                    <p className="text-xs text-dark-400 mt-1">{tip.description}</p>
                    {tip.reason && (
                      <p className="text-[10px] text-dark-500 mt-1 italic">{tip.reason}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Movement Features Tab */}
        {activeTab === 'features' && (
          <div className="space-y-3">
            <p className="text-xs text-dark-400">
              Features that make Movement Network unique:
            </p>
            {movementFeatures.map((feature) => (
              <div
                key={feature.id}
                className="bg-dark-900/30 rounded-lg p-3 border border-dark-800"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-dark-200">{feature.name}</span>
                  {feature.available && (
                    <svg
                      className="h-4 w-4 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-dark-400">{feature.description}</p>
                <p className="text-[10px] text-primary-400 mt-1">{feature.benefit}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Characteristics */}
      <div className="border-t border-dark-700 pt-3">
        <h4 className="text-xs font-medium text-dark-400 mb-2">Network Characteristics</h4>
        <div className="flex flex-wrap gap-2">
          {analysis.model.characteristics.map((char, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 bg-dark-900/50 rounded-lg px-2 py-1"
              title={char.description}
            >
              <svg
                className={`h-3 w-3 ${impactColors[char.impact]}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={impactIcons[char.impact]}
                />
              </svg>
              <span className="text-xs text-dark-300">{char.name}:</span>
              <span className="text-xs text-dark-100">{char.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
