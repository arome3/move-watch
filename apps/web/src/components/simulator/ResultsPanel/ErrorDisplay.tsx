'use client';

import { useState } from 'react';
import type { SimulationError, DecodedError, StackFrame, FailurePoint } from '@movewatch/shared';

interface ErrorDisplayProps {
  error: SimulationError;
}

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  ABORT: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  MOVE_ABORT: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  OUT_OF_GAS: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  INVALID_ARGUMENT: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  RESOURCE_NOT_FOUND: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  PERMISSION_DENIED: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  UNKNOWN: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
};

function DecodedErrorCard({ decoded }: { decoded: DecodedError }) {
  const colors = categoryColors[decoded.category] || categoryColors.UNKNOWN;

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-lg p-4 space-y-3`}>
      <div className="flex items-start justify-between">
        <div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border}`}>
            {decoded.category}
          </span>
          {decoded.errorName && (
            <h4 className={`mt-2 text-sm font-medium ${colors.text}`}>{decoded.errorName}</h4>
          )}
        </div>
        {decoded.abortCode !== undefined && (
          <span className="text-xs font-mono text-dark-500">
            Abort Code: {decoded.abortCode}
          </span>
        )}
      </div>

      {decoded.errorDescription && (
        <p className="text-sm text-dark-300">{decoded.errorDescription}</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-dark-500">Module:</span>
          <span className="ml-2 font-mono text-dark-400">
            {decoded.moduleAddress?.slice(0, 6)}...{decoded.moduleAddress?.slice(-4)}::{decoded.moduleName}
          </span>
        </div>
        {decoded.sourceLocation && (
          <div>
            <span className="text-dark-500">Location:</span>
            <span className="ml-2 font-mono text-dark-400">
              {decoded.sourceLocation.module}::{decoded.sourceLocation.function}
              {decoded.sourceLocation.line && `:${decoded.sourceLocation.line}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StackTraceView({ frames }: { frames: StackFrame[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayFrames = expanded ? frames : frames.slice(0, 3);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-dark-500 uppercase tracking-wider">Stack Trace</span>
        {frames.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary-400 hover:text-primary-300"
          >
            {expanded ? 'Show less' : `Show all ${frames.length} frames`}
          </button>
        )}
      </div>
      <div className="bg-dark-900 rounded-lg border border-dark-800 overflow-hidden">
        {displayFrames.map((frame, idx) => (
          <div
            key={idx}
            className={`px-3 py-2 ${idx > 0 ? 'border-t border-dark-800' : ''} ${
              idx === 0 ? 'bg-red-500/5' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-dark-600 w-6">#{frame.depth}</span>
              <span className="text-sm font-mono text-dark-300">
                {frame.moduleName}::<span className="text-primary-400">{frame.functionName}</span>
              </span>
              {frame.status === 'aborted' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">aborted</span>
              )}
            </div>
            {frame.typeArguments && frame.typeArguments.length > 0 && (
              <div className="ml-8 mt-1 text-xs text-dark-500">
                Type args: <span className="font-mono text-dark-400">{frame.typeArguments.join(', ')}</span>
              </div>
            )}
            {(frame.gasAtEntry !== undefined || frame.gasAtExit !== undefined) && (
              <div className="ml-8 mt-1 text-xs text-dark-500">
                Gas: {frame.gasAtEntry?.toLocaleString() || '?'} → {frame.gasAtExit?.toLocaleString() || '?'}
                {frame.gasAtEntry !== undefined && frame.gasAtExit !== undefined && (
                  <span className="text-dark-400 ml-1">
                    (used: {(frame.gasAtEntry - frame.gasAtExit).toLocaleString()})
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FailurePointCard({ failurePoint }: { failurePoint: FailurePoint }) {
  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-red-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-xs text-dark-500 uppercase tracking-wider">Failure Point</span>
      </div>
      <div className="font-mono text-sm">
        <span className="text-dark-400">{failurePoint.moduleName}</span>
        <span className="text-dark-600">::</span>
        <span className="text-red-400">{failurePoint.functionName}</span>
      </div>
      {failurePoint.instruction !== undefined && (
        <div className="mt-1 text-xs text-dark-500">
          Instruction: {failurePoint.instruction}
        </div>
      )}
      {failurePoint.gasConsumedBeforeFailure !== undefined && (
        <div className="mt-1 text-xs text-dark-500">
          Gas consumed: <span className="font-mono text-dark-400">{failurePoint.gasConsumedBeforeFailure.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

export function ErrorDisplay({ error }: ErrorDisplayProps) {
  const hasDecodedError = error.decoded !== undefined;
  const hasStackTrace = error.stackTrace && error.stackTrace.length > 0;
  const hasFailurePoint = error.failurePoint !== undefined;

  return (
    <div className="space-y-4">
      {/* Decoded Error (enhanced) */}
      {hasDecodedError && error.decoded ? (
        <DecodedErrorCard decoded={error.decoded} />
      ) : (
        /* Basic Error Message */
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-400">{error.code}</h4>
              <p className="mt-1 text-sm text-red-300">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Failure Point */}
      {hasFailurePoint && error.failurePoint && (
        <FailurePointCard failurePoint={error.failurePoint} />
      )}

      {/* Stack Trace */}
      {hasStackTrace && error.stackTrace && <StackTraceView frames={error.stackTrace} />}

      {/* Suggestion */}
      {error.suggestion && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-400">Suggestion</h4>
              <p className="mt-1 text-sm text-amber-300">{error.suggestion}</p>
            </div>
          </div>
        </div>
      )}

      {/* VM Status (collapsible) */}
      <details className="group">
        <summary className="text-sm text-dark-400 cursor-pointer hover:text-dark-300 transition-colors">
          View raw VM status
        </summary>
        <pre className="mt-2 p-3 bg-dark-900 rounded-lg text-xs font-mono text-dark-400 overflow-x-auto">
          {error.vmStatus}
        </pre>
      </details>
    </div>
  );
}
