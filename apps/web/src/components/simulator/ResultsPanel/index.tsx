'use client';

import { useState } from 'react';
import type { SimulationResponse } from '@movewatch/shared';
import { SuccessBadge } from './SuccessBadge';
import { GasBreakdown } from './GasBreakdown';
import { StateChanges } from './StateChanges';
import { EventsList } from './EventsList';
import { ErrorDisplay } from './ErrorDisplay';

interface ResultsPanelProps {
  result: SimulationResponse | null;
  isLoading: boolean;
}

type Tab = 'overview' | 'state' | 'events';

export function ResultsPanel({ result, isLoading }: ResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="h-4 bg-slate-700 rounded w-full" />
          <div className="h-4 bg-slate-700 rounded w-2/3" />
          <div className="h-32 bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  // Empty state
  if (!result) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
        <div className="max-w-sm mx-auto">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 mx-auto text-slate-600 mb-4"
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
          <h3 className="text-lg font-medium text-slate-300 mb-2">Ready to Simulate</h3>
          <p className="text-sm text-slate-500">
            Configure your transaction on the left and click &quot;Simulate&quot; to see the
            results here.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'state', label: 'State Changes', count: result.stateChanges?.length },
    { id: 'events', label: 'Events', count: result.events?.length },
  ];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
        <SuccessBadge success={result.success} />
        <span className="text-xs text-slate-500 font-mono">ID: {result.shareId}</span>
      </div>

      {/* Tabs */}
      {result.success && (
        <div className="border-b border-slate-700">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors
                          ${
                            activeTab === tab.id
                              ? 'border-primary-500 text-primary-400'
                              : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                          }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 text-xs rounded
                              ${
                                activeTab === tab.id
                                  ? 'bg-primary-500/20 text-primary-400'
                                  : 'bg-slate-700 text-slate-500'
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
            {activeTab === 'overview' && result.gasUsed && result.gasBreakdown && (
              <GasBreakdown gasUsed={result.gasUsed} gasBreakdown={result.gasBreakdown} />
            )}
            {activeTab === 'state' && <StateChanges changes={result.stateChanges || []} />}
            {activeTab === 'events' && <EventsList events={result.events || []} />}
          </>
        ) : (
          result.error && <ErrorDisplay error={result.error} />
        )}
      </div>
    </div>
  );
}
