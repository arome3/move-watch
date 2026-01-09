'use client';

import { useState } from 'react';
import type { SimulationResponse, SimulationWarning } from '@movewatch/shared';
import { SuccessBadge } from './SuccessBadge';
import { GasBreakdown } from './GasBreakdown';
import { StateChanges } from './StateChanges';
import { EventsList } from './EventsList';
import { ErrorDisplay } from './ErrorDisplay';
import { ExecutionTrace } from './ExecutionTrace';
import { TransactionExplanation } from './TransactionExplanation';
import { Move2Features } from './Move2Features';
import { GasModelInfo } from './GasModelInfo';

interface ResultsPanelProps {
  result: SimulationResponse | null;
  isLoading: boolean;
}

type Tab = 'overview' | 'execution' | 'state' | 'events' | 'analysis';

const warningSeverityColors: Record<string, { bg: string; text: string; border: string }> = {
  info: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  caution: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
};

function WarningsBanner({ warnings }: { warnings: SimulationWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning, idx) => {
        const colors = warningSeverityColors[warning.severity] || warningSeverityColors.medium;
        return (
          <div key={idx} className={`${colors.bg} border ${colors.border} rounded-lg px-4 py-3`}>
            <div className="flex items-start gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${colors.text} flex-shrink-0 mt-0.5`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                    {warning.severity.toUpperCase()}
                  </span>
                  <span className={`text-sm font-medium ${colors.text}`}>{warning.code.replace(/_/g, ' ')}</span>
                </div>
                <p className="mt-1 text-sm text-dark-300">{warning.message}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecommendationsList({ recommendations }: { recommendations: string[] }) {
  if (recommendations.length === 0) return null;

  return (
    <div className="bg-dark-900/50 border border-dark-800 rounded-lg p-4">
      <h4 className="text-xs text-dark-500 uppercase tracking-wider mb-3">Recommendations</h4>
      <ul className="space-y-2">
        {recommendations.map((rec, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-dark-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-primary-400 flex-shrink-0 mt-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{rec}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ForkMetadataBadge({ forkMetadata }: { forkMetadata: NonNullable<SimulationResponse['forkMetadata']> }) {
  const timestamp = new Date(parseInt(forkMetadata.ledgerTimestamp) / 1000).toLocaleString();

  return (
    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 text-xs">
      <div className="flex items-center gap-2 text-purple-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-medium">Fork Simulation</span>
      </div>
      <div className="mt-1 text-dark-400 space-y-0.5">
        <div>Network: <span className="text-dark-300">{forkMetadata.forkedFrom}</span></div>
        <div>Version: <span className="font-mono text-dark-300">{forkMetadata.ledgerVersion}</span></div>
        <div>Timestamp: <span className="text-dark-300">{timestamp}</span></div>
        {forkMetadata.stateOverrides && (
          <div>Overrides: <span className="text-dark-300">{forkMetadata.stateOverrides} applied</span></div>
        )}
      </div>
    </div>
  );
}

export function ResultsPanel({ result, isLoading }: ResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-700 rounded w-1/3" />
          <div className="h-4 bg-dark-700 rounded w-full" />
          <div className="h-4 bg-dark-700 rounded w-2/3" />
          <div className="h-32 bg-dark-700 rounded" />
        </div>
      </div>
    );
  }

  // Empty state
  if (!result) {
    return (
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-8 text-center">
        <div className="max-w-sm mx-auto">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 mx-auto text-dark-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h3 className="text-lg font-medium text-dark-300 mb-2">Ready to Simulate</h3>
          <p className="text-sm text-dark-500">
            Configure your transaction on the left and click &quot;Simulate&quot; to see the
            results here.
          </p>
        </div>
      </div>
    );
  }

  const hasExecutionTrace = result.executionTrace !== undefined;
  const hasWarnings = result.warnings && result.warnings.length > 0;
  const hasRecommendations = result.recommendations && result.recommendations.length > 0;
  const hasForkMetadata = result.forkMetadata !== undefined;
  const hasExplanation = result.explanation !== undefined;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    ...(hasExecutionTrace ? [{ id: 'execution' as Tab, label: 'Execution', count: result.executionTrace?.steps.length }] : []),
    { id: 'state', label: 'State Changes', count: result.stateChanges?.length },
    { id: 'events', label: 'Events', count: result.events?.length },
    { id: 'analysis', label: 'Analysis' },
  ];

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SuccessBadge success={result.success} />
            {hasForkMetadata && result.forkMetadata && (
              <ForkMetadataBadge forkMetadata={result.forkMetadata} />
            )}
          </div>
          <span className="text-xs text-dark-500 font-mono">ID: {result.shareId}</span>
        </div>
      </div>

      {/* Warnings (shown at top for both success and failure) */}
      {hasWarnings && result.warnings && (
        <div className="px-6 py-4 border-b border-dark-700">
          <WarningsBanner warnings={result.warnings} />
        </div>
      )}

      {/* Tabs */}
      {result.success && (
        <div className="border-b border-dark-700">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors
                          ${
                            activeTab === tab.id
                              ? 'border-primary-500 text-primary-400'
                              : 'border-transparent text-dark-400 hover:text-dark-300 hover:border-dark-600'
                          }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 text-xs rounded
                              ${
                                activeTab === tab.id
                                  ? 'bg-primary-500/20 text-primary-400'
                                  : 'bg-dark-700 text-dark-500'
                              }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {result.success ? (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Transaction Explanation - shown first for quick understanding */}
                {hasExplanation && result.explanation && (
                  <TransactionExplanation explanation={result.explanation} />
                )}
                {result.gasUsed && result.gasBreakdown && (
                  <GasBreakdown gasUsed={result.gasUsed} gasBreakdown={result.gasBreakdown} />
                )}
                {hasRecommendations && result.recommendations && (
                  <RecommendationsList recommendations={result.recommendations} />
                )}
              </div>
            )}
            {activeTab === 'execution' && result.executionTrace && (
              <ExecutionTrace trace={result.executionTrace} />
            )}
            {activeTab === 'state' && <StateChanges changes={result.stateChanges || []} />}
            {activeTab === 'events' && <EventsList events={result.events || []} />}
            {activeTab === 'analysis' && (
              <div className="space-y-6">
                <Move2Features />
                <GasModelInfo />
              </div>
            )}
          </>
        ) : (
          result.error && <ErrorDisplay error={result.error} />
        )}
      </div>
    </div>
  );
}
