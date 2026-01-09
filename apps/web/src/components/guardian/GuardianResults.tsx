'use client';

import { useState } from 'react';
import type { GuardianCheckResponse } from '@movewatch/shared';
import { RiskGauge } from './RiskGauge';
import { IssueList } from './IssueCard';
import { AnalysisWarnings, FreshnessIndicator } from './AnalysisWarnings';
import { BytecodeVerification } from './BytecodeVerification';
import { SecurityEducation, SecurityDisclaimer } from './SecurityEducation';

interface GuardianResultsProps {
  result: GuardianCheckResponse;
  showFreshness?: boolean;
}

export function GuardianResults({ result, showFreshness = false }: GuardianResultsProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(result.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Get analysis status indicators
  const hasWarnings = result.warnings && result.warnings.length > 0;
  const isComplete = result.analysisComplete !== false;

  return (
    <div className="space-y-6">
      {/* Warnings banner - show at top if there are warnings */}
      {(hasWarnings || !isComplete) && (
        <AnalysisWarnings
          warnings={result.warnings || []}
          analysisComplete={isComplete}
        />
      )}

      {/* Header with risk gauge */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Risk Gauge */}
          <div className="shrink-0">
            <RiskGauge score={result.riskScore} severity={result.overallRisk} />
          </div>

          {/* Analysis info */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
              <h2 className="text-xl font-semibold text-dark-100">
                {isComplete ? 'Analysis Complete' : 'Partial Analysis'}
              </h2>
              {showFreshness && result.createdAt && (
                <FreshnessIndicator createdAt={result.createdAt} />
              )}
            </div>
            <p className="text-sm text-dark-400 mb-4">
              {result.issues.length === 0
                ? 'No security issues were detected in this transaction.'
                : `Found ${result.issues.length} potential issue${result.issues.length !== 1 ? 's' : ''} that require attention.`}
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-dark-200">{result.analysisTime.patternMatchMs}ms</div>
                <div className="text-xs text-dark-500">Pattern Match</div>
              </div>
              {result.analysisTime.llmAnalysisMs && (
                <div>
                  <div className="text-lg font-bold text-dark-200">{result.analysisTime.llmAnalysisMs}ms</div>
                  <div className="text-xs text-dark-500">AI Analysis</div>
                </div>
              )}
              <div>
                <div className="text-lg font-bold text-dark-200">{result.analysisTime.totalMs}ms</div>
                <div className="text-xs text-dark-500">Total Time</div>
              </div>
            </div>

            {/* Status indicators */}
            <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-2">
              {/* AI used indicator */}
              {result.usedLlm && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                  Enhanced with AI
                </div>
              )}

              {/* Simulation status indicator */}
              {result.simulationStatus === 'success' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Simulated
                </div>
              )}
              {result.simulationStatus === 'failed' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Simulation Failed
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Share button */}
        <div className="mt-6 pt-4 border-t border-dark-700 flex items-center justify-between">
          <p className="text-xs text-dark-500">
            Share ID: <code className="text-dark-400">{result.shareId}</code>
          </p>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                Share Result
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bytecode Verification - shows on-chain verification status */}
      {result.bytecodeVerification && (
        <BytecodeVerification verification={result.bytecodeVerification} />
      )}

      {/* Issues list */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <IssueList issues={result.issues} />
      </div>

      {/* Security Education - expandable */}
      <SecurityEducation variant="banner" />

      {/* Disclaimer */}
      <SecurityDisclaimer />
    </div>
  );
}

// Skeleton loader for results
export function GuardianResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 animate-pulse">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-[180px] h-[140px] bg-dark-700/50 rounded-full" />
          <div className="flex-1 space-y-4">
            <div className="h-6 bg-dark-700 rounded w-48" />
            <div className="h-4 bg-dark-700/50 rounded w-full" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-12 bg-dark-700/50 rounded" />
              <div className="h-12 bg-dark-700/50 rounded" />
              <div className="h-12 bg-dark-700/50 rounded" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-20 bg-dark-700/50 rounded-xl" />
          <div className="h-20 bg-dark-700/50 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
