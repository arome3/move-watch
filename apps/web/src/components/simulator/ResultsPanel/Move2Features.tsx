'use client';

import { useState, useEffect } from 'react';
import { useSimulatorStore } from '@/stores/simulator';

// ============================================================================
// TYPES
// ============================================================================

interface Move2Feature {
  id: string;
  name: string;
  version: '2.0' | '2.1' | '2.2' | '2.3';
  category: 'syntax' | 'types' | 'control_flow' | 'visibility' | 'safety';
  description: string;
  benefit: string;
  example?: string;
  learnMoreUrl?: string;
}

interface Move2FeatureDetection {
  feature: Move2Feature;
  detected: boolean;
  occurrences: number;
  locations?: string[];
}

interface Move2Analysis {
  moduleAddress: string;
  moduleName: string;
  network: string;
  move2Version: '2.0' | '2.1' | '2.2' | '2.3' | 'legacy';
  featuresDetected: Move2FeatureDetection[];
  summary: {
    totalFeatures: number;
    byVersion: Record<string, number>;
    byCategory: Record<string, number>;
  };
  recommendations: Array<{
    type: 'upgrade' | 'optimization' | 'best_practice';
    title: string;
    description: string;
    feature?: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

// ============================================================================
// API
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getMove2Analysis(
  network: string,
  address: string,
  moduleName: string
): Promise<Move2Analysis | null> {
  try {
    const response = await fetch(
      `${API_URL}/v1/modules/move2/analyze/${address}/${moduleName}?network=${network}`
    );
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function getMove2Features(): Promise<Move2Feature[]> {
  try {
    const response = await fetch(`${API_URL}/v1/modules/move2/features`);
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

export function Move2Features() {
  const { moduleAddress, moduleName, network, result } = useSimulatorStore();
  const [analysis, setAnalysis] = useState<Move2Analysis | null>(null);
  const [allFeatures, setAllFeatures] = useState<Move2Feature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  // Load Move 2 feature catalog on mount
  useEffect(() => {
    getMove2Features().then(setAllFeatures);
  }, []);

  // Analyze module when result changes
  useEffect(() => {
    if (!result || !moduleAddress || !moduleName) {
      setAnalysis(null);
      return;
    }

    setIsLoading(true);
    getMove2Analysis(network, moduleAddress, moduleName)
      .then(setAnalysis)
      .finally(() => setIsLoading(false));
  }, [result, moduleAddress, moduleName, network]);

  if (!result) return null;

  const versionColors: Record<string, string> = {
    '2.0': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    '2.1': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    '2.2': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    '2.3': 'bg-green-500/10 text-green-400 border-green-500/30',
    legacy: 'bg-dark-600 text-dark-300 border-dark-500',
  };

  const categoryIcons: Record<string, string> = {
    syntax: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5',
    types: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
    control_flow: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
    visibility: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z',
    safety: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  };

  const priorityColors: Record<string, string> = {
    low: 'text-dark-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
  };

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h3 className="text-sm font-medium text-dark-100">Move 2 Analysis</h3>
        </div>

        {analysis && (
          <span
            className={`px-2 py-0.5 text-xs font-medium border rounded ${
              versionColors[analysis.move2Version]
            }`}
          >
            {analysis.move2Version === 'legacy' ? 'Move 1.x' : `Move ${analysis.move2Version}`}
          </span>
        )}
      </div>

      {isLoading ? (
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
      ) : analysis ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-dark-900/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-primary-400">
                {analysis.summary.totalFeatures}
              </div>
              <div className="text-xs text-dark-400">Features Used</div>
            </div>
            <div className="bg-dark-900/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">
                {Object.keys(analysis.summary.byVersion).length}
              </div>
              <div className="text-xs text-dark-400">Versions</div>
            </div>
            <div className="bg-dark-900/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {analysis.recommendations.length}
              </div>
              <div className="text-xs text-dark-400">Suggestions</div>
            </div>
          </div>

          {/* Detected Features */}
          {analysis.featuresDetected.filter((f) => f.detected).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-dark-400 uppercase tracking-wider">
                Detected Features
              </h4>
              <div className="space-y-2">
                {analysis.featuresDetected
                  .filter((f) => f.detected)
                  .map((detection) => (
                    <div
                      key={detection.feature.id}
                      className="bg-dark-900/30 rounded-lg p-3 border border-dark-700"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-dark-800 rounded">
                          <svg
                            className="h-4 w-4 text-dark-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={categoryIcons[detection.feature.category] || categoryIcons.syntax}
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-dark-100">
                              {detection.feature.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[10px] rounded ${
                                versionColors[detection.feature.version]
                              }`}
                            >
                              {detection.feature.version}
                            </span>
                            {detection.occurrences > 1 && (
                              <span className="text-xs text-dark-500">
                                ({detection.occurrences}x)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-dark-400 mt-1">
                            {detection.feature.description}
                          </p>
                          {detection.locations && detection.locations.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {detection.locations.slice(0, 3).map((loc, i) => (
                                <code
                                  key={i}
                                  className="text-[10px] px-1.5 py-0.5 bg-dark-800 rounded text-primary-400"
                                >
                                  {loc}
                                </code>
                              ))}
                              {detection.locations.length > 3 && (
                                <span className="text-[10px] text-dark-500">
                                  +{detection.locations.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-dark-400 uppercase tracking-wider">
                Recommendations
              </h4>
              <div className="space-y-2">
                {analysis.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="bg-dark-900/30 rounded-lg p-3 border border-dark-700"
                  >
                    <div className="flex items-start gap-2">
                      <svg
                        className={`h-4 w-4 mt-0.5 ${priorityColors[rec.priority]}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-dark-100">{rec.title}</span>
                          <span className="px-1.5 py-0.5 text-[10px] bg-dark-700 text-dark-300 rounded">
                            {rec.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-dark-400 mt-1">{rec.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        // Show feature catalog when no analysis available
        <div className="space-y-3">
          <p className="text-xs text-dark-400">
            Move 2 introduces powerful new features. Here are some highlights:
          </p>

          <button
            onClick={() => setShowAllFeatures(!showAllFeatures)}
            className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
          >
            {showAllFeatures ? 'Hide' : 'Show'} Move 2 Features
            <svg
              className={`h-3 w-3 transition-transform ${showAllFeatures ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAllFeatures && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allFeatures.map((feature) => (
                <div
                  key={feature.id}
                  className="bg-dark-900/30 rounded-lg p-2 border border-dark-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-dark-200">{feature.name}</span>
                    <span
                      className={`px-1 py-0.5 text-[9px] rounded ${versionColors[feature.version]}`}
                    >
                      {feature.version}
                    </span>
                  </div>
                  <p className="text-[10px] text-dark-500 mt-1">{feature.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Learn More Link */}
      <a
        href="https://aptos.dev/build/smart-contracts/book/move-2"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-dark-400 hover:text-primary-400 transition-colors"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        Learn more about Move 2
      </a>
    </div>
  );
}
