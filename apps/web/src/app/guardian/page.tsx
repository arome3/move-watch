'use client';

import { useCallback, useEffect } from 'react';
import { useGuardianStore } from '@/stores/guardian';
import { analyzeTransaction, getPatterns } from '@/lib/guardianApi';
import {
  GuardianForm,
  DemoSelector,
  GuardianResults,
  GuardianResultsSkeleton,
} from '@/components/guardian';

export default function GuardianPage() {
  const {
    result,
    isAnalyzing,
    error,
    patternsLoaded,
    setResult,
    setAnalyzing,
    setError,
    setPatterns,
    addToHistory,
    buildRequest,
    getFullFunctionPath,
  } = useGuardianStore();

  // Load patterns on mount
  useEffect(() => {
    if (!patternsLoaded) {
      getPatterns()
        .then((data) => setPatterns(data.patterns))
        .catch(console.error);
    }
  }, [patternsLoaded, setPatterns]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const request = buildRequest();
      const response = await analyzeTransaction(request);
      setResult(response);
      addToHistory(response, getFullFunctionPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [buildRequest, setAnalyzing, setError, setResult, addToHistory, getFullFunctionPath]);

  return (
    <main className="min-h-screen bg-dark-900">
      {/* Hero section */}
      <div className="bg-gradient-to-b from-orange-900/20 via-dark-900 to-dark-900 border-b border-dark-800">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm mb-4">
              <span>AI-Powered Protection</span>
              <span className="text-xs bg-orange-500/20 px-1.5 py-0.5 rounded">x402</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Guardian{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">
                Risk Analyzer
              </span>
            </h1>
            <p className="text-lg text-dark-400">
              Detect exploits, rug pulls, and suspicious behavior before signing.
              <br className="hidden md:block" />
              Powered by pattern matching and AI analysis.
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          {/* Results section (or empty state) */}
          <div className="order-2 lg:order-1">
            {isAnalyzing ? (
              <GuardianResultsSkeleton />
            ) : result ? (
              <GuardianResults result={result} />
            ) : (
              <div className="bg-dark-800/50 rounded-xl border border-dark-700/50 p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 text-orange-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-dark-200 mb-2">Ready to Analyze</h2>
                <p className="text-dark-400 max-w-md mx-auto">
                  Enter a transaction or select a demo to analyze for security risks.
                  Guardian will scan for exploits, rug pulls, and suspicious patterns.
                </p>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}
          </div>

          {/* Input section */}
          <div className="order-1 lg:order-2 space-y-6">
            {/* Input form */}
            <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
              <div className="flex items-center gap-2 mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-orange-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <h2 className="text-lg font-semibold text-dark-100">Transaction Details</h2>
              </div>
              <GuardianForm onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
            </div>

            {/* Demo transactions */}
            <DemoSelector />

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-dark-800/50 rounded-xl border border-dark-700/50 p-4">
                <div className="text-2xl mb-1">23</div>
                <div className="text-xs text-dark-500">Detection Patterns</div>
              </div>
              <div className="bg-dark-800/50 rounded-xl border border-dark-700/50 p-4">
                <div className="text-2xl mb-1">{'<50ms'}</div>
                <div className="text-xs text-dark-500">Pattern Match</div>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-dark-800/30 rounded-xl border border-dark-700/30 p-4">
              <h3 className="text-sm font-medium text-dark-300 mb-3">How Guardian Works</h3>
              <ol className="space-y-2 text-xs text-dark-400">
                <li className="flex items-start gap-2">
                  <span className="bg-dark-700 text-dark-300 rounded-full w-4 h-4 flex items-center justify-center shrink-0 text-[10px]">
                    1
                  </span>
                  <span>Pattern matching scans for known exploit signatures</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-dark-700 text-dark-300 rounded-full w-4 h-4 flex items-center justify-center shrink-0 text-[10px]">
                    2
                  </span>
                  <span>Transaction is simulated to analyze state changes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-dark-700 text-dark-300 rounded-full w-4 h-4 flex items-center justify-center shrink-0 text-[10px]">
                    3
                  </span>
                  <span>AI analysis runs on complex or ambiguous cases</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-dark-700 text-dark-300 rounded-full w-4 h-4 flex items-center justify-center shrink-0 text-[10px]">
                    4
                  </span>
                  <span>Risk score calculated with actionable recommendations</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
