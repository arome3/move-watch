'use client';

import type { TransactionListItem } from '@movewatch/shared';

interface TransactionRowProps {
  transaction: TransactionListItem;
  onClick?: () => void;
  isExpanded?: boolean;
}

function truncateHash(hash: string, startChars = 6, endChars = 4): string {
  if (hash.length <= startChars + endChars) return hash;
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getExplorerUrl(hash: string, network: string): string {
  const baseUrl =
    network === 'mainnet'
      ? 'https://explorer.movementnetwork.xyz'
      : 'https://explorer.testnet.movementnetwork.xyz';
  return `${baseUrl}/txn/${hash}`;
}

export function TransactionRow({
  transaction,
  onClick,
  isExpanded,
}: TransactionRowProps) {
  return (
    <div
      className={`group p-4 border-b border-dark-700 hover:bg-dark-800/50 cursor-pointer transition-colors ${
        isExpanded ? 'bg-dark-800/50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {/* Status indicator */}
          <div
            className={`flex-shrink-0 w-2 h-2 rounded-full ${
              transaction.success ? 'bg-green-500' : 'bg-red-500'
            }`}
          />

          {/* Hash */}
          <div className="min-w-0">
            <code className="text-sm text-white font-mono">
              {truncateHash(transaction.hash)}
            </code>
            <p className="text-xs text-dark-500 mt-0.5">
              {formatTimestamp(transaction.timestamp)}
            </p>
          </div>
        </div>

        {/* Function */}
        <div className="hidden md:block flex-1 min-w-0">
          <p className="text-sm text-dark-300 truncate">
            {transaction.moduleAddress}::
            <span className="text-primary-400">{transaction.functionName}</span>
          </p>
        </div>

        {/* Gas */}
        <div className="hidden sm:block text-right">
          <p className="text-sm text-dark-300">
            {transaction.gasUsed.toLocaleString()} gas
          </p>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded ${
              transaction.success
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {transaction.success ? 'Success' : 'Failed'}
          </span>

          {/* External link */}
          <a
            href={getExplorerUrl(transaction.hash, transaction.network)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-dark-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg
              className="w-4 h-4"
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

          {/* Expand icon */}
          <svg
            className={`w-4 h-4 text-dark-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Mobile function display */}
      <div className="md:hidden mt-2">
        <p className="text-sm text-dark-400 truncate">
          {transaction.moduleAddress}::{transaction.functionName}
        </p>
      </div>
    </div>
  );
}
