'use client';

import { useState } from 'react';
import type { AlertTriggerResponse, ChannelType } from '@movewatch/shared';

interface TriggerHistoryProps {
  triggers: AlertTriggerResponse[];
  total: number;
  isLoading: boolean;
  onLoadMore?: () => void;
  hasMore: boolean;
}

const CHANNEL_ICONS: Record<ChannelType, string> = {
  discord: '💬',
  slack: '📱',
  telegram: '✈️',
  webhook: '🔗',
  email: '📧',
  action: '⚡',
};

export function TriggerHistory({
  triggers,
  total,
  isLoading,
  onLoadMore,
  hasMore
}: TriggerHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  const truncateHash = (hash: string | null) => {
    if (!hash) return null;
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  if (isLoading && triggers.length === 0) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-dark-800/50 rounded-lg p-4">
            <div className="h-4 bg-dark-700 rounded w-1/3 mb-2" />
            <div className="h-3 bg-dark-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (triggers.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-dark-700 rounded-lg">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-sm text-dark-500">No triggers yet</p>
        <p className="text-xs text-dark-600 mt-1">
          Triggers will appear here when your alert conditions are met
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-dark-400">
          Showing {triggers.length} of {total} triggers
        </p>
      </div>

      <div className="space-y-2">
        {triggers.map((trigger) => {
          const hasErrors = trigger.notificationErrors &&
            Object.keys(trigger.notificationErrors).length > 0;
          const isExpanded = expandedId === trigger.id;

          return (
            <div
              key={trigger.id}
              className="bg-dark-800/50 rounded-lg border border-dark-700 overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : trigger.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-dark-800/80 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${
                    hasErrors ? 'bg-yellow-400' : 'bg-green-400'
                  }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-dark-200">
                        {formatRelativeTime(trigger.triggeredAt)}
                      </span>
                      {trigger.transactionHash && (
                        <span className="text-xs font-mono text-dark-500">
                          {truncateHash(trigger.transactionHash)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {trigger.notificationsSent.map((channel) => (
                        <span
                          key={channel}
                          className="text-xs"
                          title={`Sent to ${channel}`}
                        >
                          {CHANNEL_ICONS[channel]}
                        </span>
                      ))}
                      {hasErrors && (
                        <span className="text-xs text-yellow-400 ml-1">
                          (some failed)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <svg
                  className={`w-4 h-4 text-dark-400 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-dark-700 pt-3">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-dark-400 mb-1">Triggered At</p>
                      <p className="text-sm text-dark-200">{formatDate(trigger.triggeredAt)}</p>
                    </div>

                    {trigger.transactionHash && (
                      <div>
                        <p className="text-xs font-medium text-dark-400 mb-1">Transaction</p>
                        <a
                          href={`https://explorer.movementlabs.xyz/tx/${trigger.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono text-primary-400 hover:text-primary-300"
                        >
                          {trigger.transactionHash}
                        </a>
                      </div>
                    )}

                    {trigger.eventData != null && (
                      <div>
                        <p className="text-xs font-medium text-dark-400 mb-1">Event Data</p>
                        <pre className="text-xs font-mono text-dark-300 bg-dark-900 p-2 rounded overflow-x-auto">
                          {JSON.stringify(trigger.eventData, null, 2)}
                        </pre>
                      </div>
                    )}

                    {hasErrors && (
                      <div>
                        <p className="text-xs font-medium text-yellow-400 mb-1">Notification Errors</p>
                        <div className="space-y-1">
                          {Object.entries(trigger.notificationErrors || {}).map(([channel, error]) => (
                            <div key={channel} className="text-xs">
                              <span className="text-dark-400">{channel}:</span>{' '}
                              <span className="text-red-400">{error}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoading}
          className="w-full py-2 text-sm text-dark-400 hover:text-dark-300
                     border border-dark-700 rounded-lg hover:bg-dark-800/50
                     transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
