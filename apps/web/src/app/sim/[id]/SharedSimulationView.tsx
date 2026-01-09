'use client';

import Link from 'next/link';
import type { SharedSimulation, SimulationResponse } from '@movewatch/shared';
import { ResultsPanel } from '@/components/simulator/ResultsPanel';
import { ShareButton } from '@/components/simulator/ShareButton';

interface SharedSimulationViewProps {
  simulation: SharedSimulation;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isExpiringSoon(expiresAt: string): boolean {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return daysRemaining <= 7;
}

export function SharedSimulationView({ simulation }: SharedSimulationViewProps) {
  // Convert to SimulationResponse format for ResultsPanel
  const result: SimulationResponse = {
    id: simulation.id,
    shareId: simulation.shareId,
    success: simulation.success,
    gasUsed: simulation.gasUsed,
    gasBreakdown: simulation.gasBreakdown,
    stateChanges: simulation.stateChanges,
    events: simulation.events,
    executionTrace: simulation.executionTrace,
    error: simulation.error,
    shareUrl: typeof window !== 'undefined' ? window.location.href : '',
  };

  const expiringSoon = isExpiringSoon(simulation.expiresAt);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-dark-400 mb-2">
          <Link href="/" className="hover:text-dark-300 transition-colors">
            Simulator
          </Link>
          <span>/</span>
          <span className="text-dark-500">Shared Result</span>
        </div>
        <h1 className="text-2xl font-bold text-dark-50">Simulation Result</h1>
      </div>

      {/* Expiration Warning */}
      {expiringSoon && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-amber-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm text-amber-300">
              This simulation expires on {formatDate(simulation.expiresAt)}
            </span>
          </div>
        </div>
      )}

      {/* Simulation Info */}
      <div className="mb-6 bg-dark-800 rounded-xl border border-dark-700 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-dark-500 block">Network</span>
            <span className="text-dark-200 capitalize">{simulation.network}</span>
          </div>
          <div>
            <span className="text-dark-500 block">Function</span>
            <code className="text-primary-400 font-mono text-xs break-all">
              {simulation.functionName}
            </code>
          </div>
          <div>
            <span className="text-dark-500 block">Created</span>
            <span className="text-dark-200">{formatDate(simulation.createdAt)}</span>
          </div>
          <div>
            <span className="text-dark-500 block">Expires</span>
            <span className={expiringSoon ? 'text-amber-400' : 'text-dark-200'}>
              {formatDate(simulation.expiresAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Results */}
      <ResultsPanel result={result} isLoading={false} />

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600
                     text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
              clipRule="evenodd"
            />
          </svg>
          Try it yourself
        </Link>

        <ShareButton shareUrl={typeof window !== 'undefined' ? window.location.href : ''} />
      </div>
    </div>
  );
}
