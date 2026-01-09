'use client';

import type { AlertResponse } from '@movewatch/shared';
import { AlertStatusBadge } from './AlertStatusBadge';
import { AlertTypeIcon, getConditionLabel, getConditionColor } from './AlertTypeIcon';

interface AlertCardProps {
  alert: AlertResponse;
  onView?: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  isUpdating?: boolean;
  isTesting?: boolean;
}

export function AlertCard({
  alert,
  onView,
  onToggle,
  onEdit,
  onDelete,
  onTest,
  isUpdating = false,
  isTesting = false,
}: AlertCardProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-lg p-4 hover:border-dark-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-dark-700/50 ${getConditionColor(alert.conditionType)}`}>
            <AlertTypeIcon type={alert.conditionType} className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium text-dark-100">{alert.name}</h3>
            <p className="text-sm text-dark-400">{getConditionLabel(alert.conditionType)}</p>
          </div>
        </div>
        <AlertStatusBadge enabled={alert.enabled} size="sm" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4 py-3 border-t border-b border-dark-700">
        <div>
          <p className="text-xs text-dark-500 mb-1">Network</p>
          <p className="text-sm text-dark-300 capitalize">{alert.network}</p>
        </div>
        <div>
          <p className="text-xs text-dark-500 mb-1">Last Triggered</p>
          <p className="text-sm text-dark-300">{formatDate(alert.lastTriggeredAt)}</p>
        </div>
        <div>
          <p className="text-xs text-dark-500 mb-1">Triggers</p>
          <p className="text-sm text-dark-300">{alert.triggerCount}</p>
        </div>
      </div>

      {/* Channels */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-dark-500">Channels:</span>
        <div className="flex gap-1">
          {alert.channels.map((channel) => (
            <span
              key={channel.id}
              className="px-2 py-0.5 text-xs bg-dark-700 text-dark-300 rounded capitalize"
            >
              {channel.type}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Toggle Button */}
        <button
          onClick={() => onToggle(alert.id, !alert.enabled)}
          disabled={isUpdating}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                     ${
                       alert.enabled
                         ? 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                         : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                     }
                     disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isUpdating ? 'Updating...' : alert.enabled ? 'Pause' : 'Enable'}
        </button>

        {/* Test Button */}
        <button
          onClick={() => onTest(alert.id)}
          disabled={isTesting || !alert.enabled}
          className="px-3 py-2 text-sm font-medium bg-dark-700 text-dark-300 rounded-lg
                     hover:bg-dark-600 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          title={!alert.enabled ? 'Enable alert to test' : 'Send test notification'}
        >
          {isTesting ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            'Test'
          )}
        </button>

        {/* Edit Button */}
        <button
          onClick={() => onEdit(alert.id)}
          className="px-3 py-2 text-sm font-medium bg-dark-700 text-dark-300 rounded-lg
                     hover:bg-dark-600 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(alert.id)}
          className="px-3 py-2 text-sm font-medium bg-red-500/10 text-red-400 rounded-lg
                     hover:bg-red-500/20 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
