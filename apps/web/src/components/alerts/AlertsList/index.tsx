'use client';

import type { AlertResponse } from '@movewatch/shared';
import { AlertCard } from './AlertCard';

interface AlertsListProps {
  alerts: AlertResponse[];
  isLoading: boolean;
  isUpdating: boolean;
  isTesting: boolean;
  testingAlertId?: string;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
}

export function AlertsList({
  alerts,
  isLoading,
  isUpdating,
  isTesting,
  testingAlertId,
  onToggle,
  onEdit,
  onDelete,
  onTest,
}: AlertsListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 animate-pulse"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-slate-700 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-700 rounded w-1/2" />
              </div>
              <div className="h-6 w-16 bg-slate-700 rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-4 py-3 border-t border-b border-slate-700 mb-4">
              {[1, 2, 3].map((j) => (
                <div key={j}>
                  <div className="h-3 bg-slate-700 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-slate-700 rounded w-3/4" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 h-9 bg-slate-700 rounded-lg" />
              <div className="w-16 h-9 bg-slate-700 rounded-lg" />
              <div className="w-9 h-9 bg-slate-700 rounded-lg" />
              <div className="w-9 h-9 bg-slate-700 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-200 mb-2">No alerts yet</h3>
        <p className="text-slate-400 max-w-sm mx-auto">
          Create your first alert to start monitoring on-chain conditions and receive notifications.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onTest={onTest}
          isUpdating={isUpdating}
          isTesting={isTesting && testingAlertId === alert.id}
        />
      ))}
    </div>
  );
}

// Re-export sub-components
export { AlertCard } from './AlertCard';
export { AlertStatusBadge } from './AlertStatusBadge';
export { AlertTypeIcon, getConditionLabel, getConditionColor } from './AlertTypeIcon';
