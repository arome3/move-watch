'use client';

import { useEffect } from 'react';
import { useGuardianStore, getCategoryIcon } from '@/stores/guardian';
import { getDemoTransactions } from '@/lib/guardianApi';
import type { DemoTransaction } from '@movewatch/shared';

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  safe: { label: 'Safe', color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  exploit: { label: 'Exploit', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  rugpull: { label: 'Rug Pull', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  suspicious: { label: 'Suspicious', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
};

const RISK_DOTS: Record<string, string> = {
  LOW: 'bg-green-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
};

export function DemoSelector() {
  const { demoTransactions, selectedDemoId, setDemoTransactions, selectDemo } = useGuardianStore();

  // Load demo transactions on mount
  useEffect(() => {
    if (demoTransactions.length === 0) {
      getDemoTransactions()
        .then(setDemoTransactions)
        .catch(console.error);
    }
  }, [demoTransactions.length, setDemoTransactions]);

  // Group by category
  const groupedDemos = demoTransactions.reduce<Record<string, DemoTransaction[]>>((acc, demo) => {
    if (!acc[demo.category]) acc[demo.category] = [];
    acc[demo.category].push(demo);
    return acc;
  }, {});

  if (demoTransactions.length === 0) {
    return (
      <div className="bg-dark-800/50 rounded-xl border border-dark-700/50 p-6 animate-pulse">
        <div className="h-4 bg-dark-700 rounded w-1/3 mb-4" />
        <div className="space-y-2">
          <div className="h-10 bg-dark-700/50 rounded" />
          <div className="h-10 bg-dark-700/50 rounded" />
          <div className="h-10 bg-dark-700/50 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800/50 rounded-xl border border-dark-700/50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🧪</span>
        <h3 className="text-sm font-medium text-dark-200">Demo Transactions</h3>
        <span className="ml-auto text-xs text-dark-500">{demoTransactions.length} examples</span>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedDemos).map(([category, demos]) => {
          const categoryInfo = CATEGORY_LABELS[category] || { label: category, color: 'text-dark-400' };
          return (
            <div key={category} className="space-y-2">
              <div className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${categoryInfo.color}`}>
                {getCategoryIcon(category.toUpperCase())} {categoryInfo.label}
              </div>
              <div className="grid gap-1.5">
                {demos.map((demo) => (
                  <button
                    key={demo.id}
                    onClick={() => selectDemo(demo.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all
                              flex items-center gap-2 group
                              ${
                                selectedDemoId === demo.id
                                  ? 'bg-primary-500/20 border border-primary-500/50 text-primary-300'
                                  : 'bg-dark-900/50 border border-dark-700/50 text-dark-300 hover:bg-dark-800 hover:border-dark-600'
                              }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${RISK_DOTS[demo.expectedRisk] || RISK_DOTS.LOW}`} />
                    <span className="truncate flex-1">{demo.name}</span>
                    <span className="text-xs text-dark-500 group-hover:text-dark-400 shrink-0">
                      {demo.expectedRisk}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-dark-500 pt-2 border-t border-dark-700/50">
        Click a demo to load it into the analyzer
      </p>
    </div>
  );
}
