'use client';

import type { GuardianAnalysisWarning, GuardianWarningSeverity } from '@movewatch/shared';

interface AnalysisWarningsProps {
  warnings: GuardianAnalysisWarning[];
  analysisComplete?: boolean;
  className?: string;
}

/**
 * Warning severity colors and icons
 */
const severityConfig: Record<
  GuardianWarningSeverity,
  {
    bg: string;
    border: string;
    text: string;
    icon: JSX.Element;
  }
> = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
};

/**
 * AnalysisWarnings Component
 *
 * Displays analysis warnings in a prominent banner format.
 * Used to show users important information about:
 * - Simulation failures
 * - LLM analysis status (skipped, rate limited, errors)
 * - Stale/outdated results
 * - Partial analysis coverage
 */
export function AnalysisWarnings({
  warnings,
  analysisComplete = true,
  className = '',
}: AnalysisWarningsProps) {
  if (!warnings || warnings.length === 0) {
    // Even if no warnings, show incomplete analysis indicator
    if (!analysisComplete) {
      return (
        <div
          className={`rounded-lg border ${severityConfig.warning.bg} ${severityConfig.warning.border} p-4 ${className}`}
        >
          <div className="flex items-start gap-3">
            <div className={`shrink-0 ${severityConfig.warning.text}`}>
              {severityConfig.warning.icon}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${severityConfig.warning.text}`}>
                Partial Analysis
              </p>
              <p className="text-sm text-dark-400 mt-1">
                Some analysis methods were unavailable. Results may be incomplete.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  // Sort warnings by severity: error > warning > info
  const sortedWarnings = [...warnings].sort((a, b) => {
    const order: Record<GuardianWarningSeverity, number> = { error: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  // Group if multiple warnings
  if (sortedWarnings.length === 1) {
    const warning = sortedWarnings[0];
    const config = severityConfig[warning.severity];

    return (
      <div className={`rounded-lg border ${config.bg} ${config.border} p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className={`shrink-0 ${config.text}`}>{config.icon}</div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${config.text}`}>
              {getWarningTitle(warning.type)}
            </p>
            <p className="text-sm text-dark-400 mt-1">{warning.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // Multiple warnings - show as list
  return (
    <div className={`space-y-2 ${className}`}>
      {sortedWarnings.map((warning, index) => {
        const config = severityConfig[warning.severity];
        return (
          <div
            key={`${warning.type}-${index}`}
            className={`rounded-lg border ${config.bg} ${config.border} p-3`}
          >
            <div className="flex items-start gap-3">
              <div className={`shrink-0 ${config.text}`}>{config.icon}</div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${config.text}`}>
                  {getWarningTitle(warning.type)}
                </p>
                <p className="text-xs text-dark-400 mt-0.5">{warning.message}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Get human-readable title for warning type
 */
function getWarningTitle(type: string): string {
  switch (type) {
    case 'simulation_failed':
      return 'Simulation Failed';
    case 'llm_skipped':
      return 'AI Analysis Skipped';
    case 'llm_error':
      return 'AI Analysis Error';
    case 'llm_rate_limited':
      return 'AI Rate Limited';
    case 'stale_result':
      return 'Outdated Result';
    case 'partial_analysis':
      return 'Partial Analysis';
    case 'bytecode_verification_failed':
      return 'On-Chain Verification Failed';
    default:
      return 'Analysis Notice';
  }
}

/**
 * Compact version for inline use
 */
export function AnalysisWarningBadge({
  warnings,
}: {
  warnings: GuardianAnalysisWarning[];
}) {
  if (!warnings || warnings.length === 0) return null;

  // Get highest severity warning
  const hasError = warnings.some((w) => w.severity === 'error');
  const hasWarning = warnings.some((w) => w.severity === 'warning');

  const severity = hasError ? 'error' : hasWarning ? 'warning' : 'info';
  const config = severityConfig[severity];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${config.bg} ${config.border} ${config.text}`}
      title={warnings.map((w) => w.message).join('\n')}
    >
      <span className="w-3.5 h-3.5">{config.icon}</span>
      <span>
        {warnings.length === 1 ? getWarningTitle(warnings[0].type) : `${warnings.length} warnings`}
      </span>
    </div>
  );
}

/**
 * Freshness indicator for shared results
 */
export function FreshnessIndicator({ createdAt }: { createdAt: string }) {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays >= 7) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-red-500/10 border border-red-500/30 text-red-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
        {diffDays} days old - Consider re-analyzing
      </div>
    );
  }

  if (diffDays >= 1) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
        {diffDays} day{diffDays !== 1 ? 's' : ''} old
      </div>
    );
  }

  if (diffHours >= 1) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-dark-600 border border-dark-500 text-dark-300">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
        {diffHours}h ago
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-green-500/10 border border-green-500/30 text-green-400">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      Fresh
    </div>
  );
}
