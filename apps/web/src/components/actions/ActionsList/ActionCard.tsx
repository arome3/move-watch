'use client';

import Link from 'next/link';
import type { ActionListItem } from '@movewatch/shared';

interface ActionCardProps {
  action: ActionListItem;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

const TRIGGER_ICONS: Record<string, string> = {
  event: '⚡',
  block: '📦',
  schedule: '🕐',
};

const TRIGGER_LABELS: Record<string, string> = {
  event: 'Event',
  block: 'Block',
  schedule: 'Schedule',
};

const NETWORK_COLORS: Record<string, string> = {
  mainnet: 'bg-green-500/20 text-green-400',
  testnet: 'bg-yellow-500/20 text-yellow-400',
  devnet: 'bg-purple-500/20 text-purple-400',
};

export function ActionCard({
  action,
  onToggle,
  onDelete,
  isUpdating,
  isDeleting,
}: ActionCardProps) {
  const successRate =
    action.executionCount > 0
      ? Math.round((action.successCount / action.executionCount) * 100)
      : null;

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle(action.id, !action.enabled);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this action?')) {
      onDelete(action.id);
    }
  };

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-700 hover:border-dark-600 transition-colors">
      <Link href={`/alerts-and-actions/actions/${action.id}`} className="block p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{TRIGGER_ICONS[action.triggerType]}</span>
            <div>
              <h3 className="font-medium text-dark-100">{action.name}</h3>
              {action.description && (
                <p className="text-sm text-dark-400 mt-0.5 line-clamp-1">
                  {action.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-xs rounded ${NETWORK_COLORS[action.network]}`}
            >
              {action.network}
            </span>
            <button
              onClick={handleToggle}
              disabled={isUpdating}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                action.enabled ? 'bg-primary-500' : 'bg-dark-600'
              } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  action.enabled ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-dark-500">
            <span className="text-dark-400">{TRIGGER_LABELS[action.triggerType]}</span> trigger
          </span>

          {action.executionCount > 0 && (
            <>
              <span className="text-dark-600">•</span>
              <span className="text-dark-500">
                <span className="text-dark-400">{action.executionCount}</span> executions
              </span>
              {successRate !== null && (
                <>
                  <span className="text-dark-600">•</span>
                  <span
                    className={
                      successRate >= 90
                        ? 'text-green-400'
                        : successRate >= 70
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }
                  >
                    {successRate}% success
                  </span>
                </>
              )}
            </>
          )}

          {action.lastExecutedAt && (
            <>
              <span className="text-dark-600">•</span>
              <span className="text-dark-500">
                Last run{' '}
                <span className="text-dark-400">
                  {formatRelativeTime(action.lastExecutedAt)}
                </span>
              </span>
            </>
          )}
        </div>
      </Link>

      <div className="px-4 py-2 border-t border-dark-700 flex items-center justify-end gap-2">
        <Link
          href={`/alerts-and-actions/actions/${action.id}/edit`}
          className="px-3 py-1 text-xs text-dark-400 hover:text-dark-300 transition-colors"
        >
          Edit
        </Link>
        <Link
          href={`/alerts-and-actions/actions/${action.id}`}
          className="px-3 py-1 text-xs text-dark-400 hover:text-dark-300 transition-colors"
        >
          View
        </Link>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-3 py-1 text-xs text-red-400 hover:text-red-300 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
