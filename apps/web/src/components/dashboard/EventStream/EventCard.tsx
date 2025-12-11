'use client';

import type { EventListItem } from '@movewatch/shared';

interface EventCardProps {
  event: EventListItem;
  network: string;
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getExplorerUrl(hash: string, network: string): string {
  const baseUrl =
    network === 'mainnet'
      ? 'https://explorer.movementnetwork.xyz'
      : 'https://explorer.testnet.movementnetwork.xyz';
  return `${baseUrl}/txn/${hash}`;
}

export function EventCard({ event, network }: EventCardProps) {
  return (
    <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-sm text-primary-400 truncate">
              {event.eventType}
            </code>
            <span className="text-xs text-slate-500">
              #{event.sequenceNumber}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {formatTimestamp(event.timestamp)}
          </p>
        </div>
        {event.transactionHash && (
          <a
            href={getExplorerUrl(event.transactionHash, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
          >
            <code>{truncateHash(event.transactionHash)}</code>
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
      </div>
      <div className="mt-3">
        <pre className="text-xs text-slate-300 bg-slate-800 rounded p-2 overflow-x-auto max-h-32">
          {JSON.stringify(event.data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
