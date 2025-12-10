'use client';

import { useCallback, useEffect } from 'react';
import { useSimulatorStore } from '@/stores/simulator';
import { simulateTransaction } from '@/lib/api';
import { TransactionBuilder } from '@/components/simulator/TransactionBuilder';
import { ResultsPanel } from '@/components/simulator/ResultsPanel';
import { ShareButton } from '@/components/simulator/ShareButton';

export default function SimulatorPage() {
  const { buildRequest, setResult, setLoading, isLoading, result, validate } =
    useSimulatorStore();

  // Validate on mount
  useEffect(() => {
    validate();
  }, [validate]);

  const handleSimulate = useCallback(async () => {
    setLoading(true);
    setResult(null);

    try {
      const request = buildRequest();
      const response = await simulateTransaction(request);
      setResult(response);
    } catch (error) {
      console.error('Simulation failed:', error);
      setResult({
        id: '',
        shareId: '',
        success: false,
        error: {
          code: 'CLIENT_ERROR',
          message: error instanceof Error ? error.message : 'Simulation failed',
          vmStatus: 'N/A',
          suggestion: 'Check your network connection and try again.',
        },
        shareUrl: '',
      });
    } finally {
      setLoading(false);
    }
  }, [buildRequest, setResult, setLoading]);

  // Keyboard shortcut: Cmd/Ctrl + Enter to simulate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isLoading) {
          handleSimulate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSimulate, isLoading]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-50">Transaction Simulator</h1>
        <p className="mt-2 text-slate-400">
          Simulate transactions on Movement Network before execution. Preview gas costs,
          state changes, and events.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Transaction Builder */}
        <div>
          <TransactionBuilder onSimulate={handleSimulate} isLoading={isLoading} />
        </div>

        {/* Right Column: Results Panel */}
        <div className="space-y-4">
          <ResultsPanel result={result} isLoading={isLoading} />

          {/* Share Button */}
          {result && result.shareUrl && (
            <div className="flex justify-end">
              <ShareButton shareUrl={result.shareUrl} />
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-4 text-xs text-slate-500">
          <span>Free tier: 10 simulations/day</span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span>Results expire after 30 days</span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <a
            href="https://movementlabs.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-400 hover:text-primary-300 transition-colors"
          >
            Learn about Movement
          </a>
        </div>
      </div>
    </div>
  );
}
