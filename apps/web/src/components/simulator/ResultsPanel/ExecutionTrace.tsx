'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { ExecutionTrace as ExecutionTraceType, ExecutionStep } from '@movewatch/shared';

// Dynamically import ReactFlow component to avoid SSR issues
const CallGraphDiagram = dynamic(
  () => import('./CallGraphDiagram').then(mod => mod.CallGraphDiagram),
  { ssr: false, loading: () => <div className="h-[400px] bg-dark-900 rounded-lg animate-pulse" /> }
);

interface ExecutionTraceProps {
  trace: ExecutionTraceType;
}

const stepTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  FUNCTION_CALL: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  RESOURCE_READ: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  RESOURCE_WRITE: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  RESOURCE_CREATE: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  RESOURCE_DELETE: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  EVENT_EMIT: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  ASSERTION: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  ABORT: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
};

const stepTypeIcons: Record<string, string> = {
  FUNCTION_CALL: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z',
  RESOURCE_READ: 'M10 12a2 2 0 100-4 2 2 0 000 4z M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z',
  RESOURCE_WRITE: 'M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z',
  RESOURCE_CREATE: 'M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z',
  RESOURCE_DELETE: 'M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z',
  EVENT_EMIT: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  ASSERTION: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  ABORT: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

// Step item component
function StepItem({
  step,
  totalGas,
  isActive,
  isPast,
  onClick,
}: {
  step: ExecutionStep;
  totalGas: number;
  isActive: boolean;
  isPast: boolean;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = stepTypeColors[step.type] || stepTypeColors.FUNCTION_CALL;
  const icon = stepTypeIcons[step.type] || stepTypeIcons.FUNCTION_CALL;
  const percentage = totalGas > 0 ? ((step.gasUsed / totalGas) * 100).toFixed(1) : '0';

  return (
    <div
      className={`border rounded-lg transition-all ${colors.border} ${colors.bg} ${
        isActive ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-dark-900' : ''
      } ${isPast ? 'opacity-50' : ''}`}
    >
      <button
        onClick={() => {
          onClick();
          setExpanded(!expanded);
        }}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors rounded-lg"
      >
        {/* Step number */}
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          isActive ? 'bg-primary-500 text-white' : 'bg-dark-700 text-dark-400'
        }`}>
          {step.index + 1}
        </div>

        {/* Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 ${colors.text} flex-shrink-0`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d={icon} clipRule="evenodd" />
        </svg>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
              {step.type.replace('_', ' ')}
            </span>
            <span className="text-sm text-dark-300 truncate">{step.description}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-dark-500">
            <span>Module: <span className="text-dark-400 font-mono">{step.module}</span></span>
            {step.function && (
              <span>Function: <span className="text-dark-400 font-mono">{step.function}</span></span>
            )}
          </div>
        </div>

        {/* Gas */}
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-mono text-dark-300">{step.gasUsed.toLocaleString()}</div>
          <div className="text-xs text-dark-500">{percentage}%</div>
        </div>

        {/* Expand indicator */}
        {step.data !== undefined && step.data !== null && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-dark-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Expanded data */}
      {expanded && step.data !== undefined && step.data !== null && (
        <div className="px-4 pb-4">
          <pre className="text-xs font-mono bg-dark-900/50 rounded-lg p-3 overflow-x-auto text-dark-400">
            {JSON.stringify(step.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Debugger controls component
function DebuggerControls({
  currentStep,
  totalSteps,
  isPlaying,
  playbackSpeed,
  onPlay,
  onPause,
  onStepForward,
  onStepBack,
  onReset,
  onSpeedChange,
}: {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
}) {
  return (
    <div className="flex items-center gap-4 p-3 bg-dark-900 rounded-lg border border-dark-700">
      {/* Step counter */}
      <div className="text-sm text-dark-400">
        Step <span className="font-mono text-dark-200">{currentStep + 1}</span> of{' '}
        <span className="font-mono text-dark-200">{totalSteps}</span>
      </div>

      {/* Progress bar */}
      <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 transition-all duration-200"
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
        {/* Reset */}
        <button
          onClick={onReset}
          className="p-2 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors"
          title="Reset"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Step back */}
        <button
          onClick={onStepBack}
          disabled={currentStep === 0}
          className="p-2 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous step"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          className="p-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Step forward */}
        <button
          onClick={onStepForward}
          disabled={currentStep === totalSteps - 1}
          className="p-2 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next step"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
          </svg>
        </button>
      </div>

      {/* Speed control */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-dark-500">Speed:</span>
        <select
          value={playbackSpeed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="bg-dark-800 border border-dark-700 rounded px-2 py-1 text-xs text-dark-300"
        >
          <option value={2000}>0.5x</option>
          <option value={1000}>1x</option>
          <option value={500}>2x</option>
          <option value={250}>4x</option>
        </select>
      </div>
    </div>
  );
}

// Text-based call graph (fallback)
function CallGraphNode({ node, depth = 0 }: { node: ExecutionTraceType['callGraph']; depth?: number }) {
  if (!node) return null;

  return (
    <div className={depth > 0 ? 'ml-4 border-l border-dark-700 pl-4' : ''}>
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-dark-300">{node.module}</span>
          <span className="text-dark-600">::</span>
          <span className="text-sm font-mono text-primary-400">{node.function}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-mono text-dark-400">{node.gasUsed.toLocaleString()}</span>
          <span className="text-xs text-dark-500 ml-2">({node.percentage}%)</span>
        </div>
      </div>
      {node.children?.map((child, idx) => (
        <CallGraphNode key={idx} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function ExecutionTrace({ trace }: ExecutionTraceProps) {
  const [view, setView] = useState<'steps' | 'graph' | 'visual'>('steps');
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);

  // Determine trace source (real CLI data vs approximated from API)
  const isApproximated = trace.traceSource?.isApproximated ?? true;
  const traceSourceType = trace.traceSource?.type ?? 'api_reconstructed';
  const traceMessage = trace.traceSource?.message;

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying) return;

    if (currentStep >= trace.steps.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = setTimeout(() => {
      setCurrentStep(prev => prev + 1);
    }, playbackSpeed);

    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, trace.steps.length, playbackSpeed]);

  const handlePlay = useCallback(() => {
    if (currentStep >= trace.steps.length - 1) {
      setCurrentStep(0);
    }
    setIsPlaying(true);
  }, [currentStep, trace.steps.length]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.min(prev + 1, trace.steps.length - 1));
  }, [trace.steps.length]);

  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(0);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-dark-300">Execution Trace</h3>
          {isApproximated ? (
            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
              Approximated
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
              Real Trace
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('steps')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              view === 'steps'
                ? 'bg-primary-500/20 text-primary-400'
                : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
            }`}
          >
            Debugger
          </button>
          <button
            onClick={() => setView('visual')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              view === 'visual'
                ? 'bg-primary-500/20 text-primary-400'
                : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
            }`}
          >
            Visual Graph
          </button>
          <button
            onClick={() => setView('graph')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              view === 'graph'
                ? 'bg-primary-500/20 text-primary-400'
                : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
            }`}
          >
            Tree View
          </button>
        </div>
      </div>

      {/* Trace source info banner */}
      {isApproximated && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
          <p className="text-[11px] text-yellow-400/90">
            <strong>Note:</strong> Gas per step is estimated from observable side effects (events, state changes).
            {traceMessage && <span className="text-yellow-400/70 ml-1">{traceMessage}</span>}
          </p>
        </div>
      )}
      {!isApproximated && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
          <p className="text-[11px] text-green-400/90">
            <strong>Real execution trace</strong> from Aptos CLI with per-instruction gas profiling.
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-dark-900/50 border border-dark-800 rounded-lg p-3">
          <div className="text-xs text-dark-500 mb-1">Entry Function</div>
          <div className="text-sm font-mono text-dark-300 truncate" title={trace.entryFunction}>
            {trace.entryFunction.split('::').pop()}
          </div>
        </div>
        <div className="bg-dark-900/50 border border-dark-800 rounded-lg p-3">
          <div className="text-xs text-dark-500 mb-1">Total Gas</div>
          <div className="text-sm font-mono text-dark-300">{trace.totalGas.toLocaleString()}</div>
        </div>
        <div className="bg-dark-900/50 border border-dark-800 rounded-lg p-3">
          <div className="text-xs text-dark-500 mb-1">Steps</div>
          <div className="text-sm font-mono text-dark-300">{trace.steps.length}</div>
        </div>
      </div>

      {/* Content */}
      {view === 'steps' ? (
        <div className="space-y-4">
          {/* Debugger Controls */}
          <DebuggerControls
            currentStep={currentStep}
            totalSteps={trace.steps.length}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            onPlay={handlePlay}
            onPause={handlePause}
            onStepForward={handleStepForward}
            onStepBack={handleStepBack}
            onReset={handleReset}
            onSpeedChange={setPlaybackSpeed}
          />

          {/* Steps list */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {trace.steps.map((step, index) => (
              <StepItem
                key={step.index}
                step={step}
                totalGas={trace.totalGas}
                isActive={index === currentStep}
                isPast={index < currentStep}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStep(index);
                }}
              />
            ))}
          </div>
        </div>
      ) : view === 'visual' ? (
        trace.callGraph ? (
          <CallGraphDiagram callGraph={trace.callGraph} totalGas={trace.totalGas} />
        ) : (
          <div className="h-[400px] bg-dark-900 rounded-lg border border-dark-700 flex items-center justify-center">
            <p className="text-dark-500">Call graph data not available</p>
          </div>
        )
      ) : (
        <div className="bg-dark-900/50 border border-dark-800 rounded-lg p-4">
          {trace.callGraph ? (
            <CallGraphNode node={trace.callGraph} />
          ) : (
            <p className="text-dark-500 text-center py-8">Call graph data not available</p>
          )}
        </div>
      )}
    </div>
  );
}
