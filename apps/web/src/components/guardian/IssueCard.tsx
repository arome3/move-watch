'use client';

import { useState } from 'react';
import type { GuardianIssueResponse, RiskSeverity } from '@movewatch/shared';
import { getCategoryIcon } from '@/stores/guardian';

interface IssueCardProps {
  issue: GuardianIssueResponse;
  index: number;
}

const SEVERITY_STYLES: Record<RiskSeverity, { bg: string; border: string; text: string; icon: string }> = {
  CRITICAL: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: '!!',
  },
  HIGH: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    icon: '!',
  },
  MEDIUM: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    icon: '*',
  },
  LOW: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    icon: '-',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  EXPLOIT: 'Exploit Detection',
  RUG_PULL: 'Rug Pull Risk',
  EXCESSIVE_COST: 'Cost Analysis',
  PERMISSION: 'Permission Risk',
};

export function IssueCard({ issue, index }: IssueCardProps) {
  const [isExpanded, setIsExpanded] = useState(index === 0); // First one expanded by default
  const styles = SEVERITY_STYLES[issue.severity];
  const categoryLabel = CATEGORY_LABELS[issue.category] || issue.category;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden
                 ${styles.bg} ${styles.border}
                 ${isExpanded ? 'shadow-lg' : ''}`}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
      >
        {/* Severity indicator */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                     ${styles.bg} ${styles.text}`}
        >
          {styles.icon}
        </div>

        {/* Title and category */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-dark-100 truncate">{issue.title}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-dark-500">
              {getCategoryIcon(issue.category)} {categoryLabel}
            </span>
            <span className="text-dark-600">|</span>
            <span className={`text-xs font-medium ${styles.text}`}>{issue.severity}</span>
          </div>
        </div>

        {/* Confidence badge */}
        <div className="text-right shrink-0">
          <div className="text-xs text-dark-500">Confidence</div>
          <div className="text-sm font-medium text-dark-300">{Math.round(issue.confidence * 100)}%</div>
        </div>

        {/* Expand icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-5 h-5 text-dark-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-dark-700/50">
          <div className="pt-4">
            <h5 className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-1.5">Description</h5>
            <p className="text-sm text-dark-300 leading-relaxed">{issue.description}</p>
          </div>

          <div>
            <h5 className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-1.5">Recommendation</h5>
            <p className="text-sm text-dark-300 leading-relaxed">{issue.recommendation}</p>
          </div>

          {/* Evidence (if present) */}
          {issue.evidence && typeof issue.evidence === 'object' && issue.evidence !== null && Object.keys(issue.evidence).length > 0 ? (
            <div>
              <h5 className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-1.5">Evidence</h5>
              <pre className="text-xs text-dark-400 bg-dark-900/50 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(issue.evidence, null, 2)}
              </pre>
            </div>
          ) : null}

          {/* Source badge */}
          <div className="flex items-center gap-2 pt-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full
                        ${
                          issue.source === 'llm'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        }`}
            >
              {issue.source === 'llm' ? 'AI Analysis' : 'Pattern Match'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// List wrapper component
interface IssueListProps {
  issues: GuardianIssueResponse[];
}

export function IssueList({ issues }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-8 text-dark-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 mx-auto mb-3 text-green-500/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="font-medium text-green-400">No Issues Detected</p>
        <p className="text-sm mt-1">This transaction appears to be safe</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-dark-200">
          {issues.length} Issue{issues.length !== 1 ? 's' : ''} Found
        </h3>
        <div className="flex items-center gap-2">
          {/* Severity summary */}
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => {
            const count = issues.filter((i) => i.severity === sev).length;
            if (count === 0) return null;
            const style = SEVERITY_STYLES[sev as RiskSeverity];
            return (
              <span
                key={sev}
                className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}
              >
                {count} {sev}
              </span>
            );
          })}
        </div>
      </div>
      {issues.map((issue, index) => (
        <IssueCard key={issue.id} issue={issue} index={index} />
      ))}
    </div>
  );
}
