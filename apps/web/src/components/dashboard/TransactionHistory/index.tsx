'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatusFilter } from './StatusFilter';
import { SearchBar } from './SearchBar';
import { TransactionRow } from './TransactionRow';
import { TransactionDetail } from './TransactionDetail';
import { fetchTransactions } from '@/lib/monitoringApi';
import type { Network } from '@movewatch/shared';

interface TransactionHistoryProps {
  network?: Network;
  moduleAddress?: string;
  sender?: string; // Filter by wallet address
}

type Status = 'all' | 'success' | 'failed';

export function TransactionHistory({
  network = 'testnet',
  moduleAddress,
  sender,
}: TransactionHistoryProps) {
  const [status, setStatus] = useState<Status>('all');
  const [search, setSearch] = useState('');
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions', network, moduleAddress, status, search, offset, sender],
    queryFn: () =>
      fetchTransactions(network, {
        moduleAddress,
        status: status === 'all' ? undefined : status,
        search: search || undefined,
        limit,
        offset,
        sender,
      }),
    refetchInterval: 30000,
  });

  const handleStatusChange = (newStatus: Status) => {
    setStatus(newStatus);
    setOffset(0);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setOffset(0);
  };

  const handleToggleExpand = (hash: string) => {
    setExpandedHash(expandedHash === hash ? null : hash);
  };

  const hasMore = data ? offset + limit < data.total : false;
  const hasPrevious = offset > 0;

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-700">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-white">Transaction History</h3>
          <div className="flex items-center gap-3">
            <SearchBar value={search} onChange={handleSearchChange} />
            <StatusFilter value={status} onChange={handleStatusChange} />
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="divide-y divide-dark-700">
        {isLoading ? (
          <TransactionListSkeleton />
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-400">Failed to load transactions</p>
          </div>
        ) : !data?.transactions.length ? (
          <EmptyState search={search} status={status} />
        ) : (
          data.transactions.map((tx) => (
            <div key={tx.hash}>
              <TransactionRow
                transaction={tx}
                onClick={() => handleToggleExpand(tx.hash)}
                isExpanded={expandedHash === tx.hash}
              />
              {expandedHash === tx.hash && (
                <TransactionDetail hash={tx.hash} network={network} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="p-4 border-t border-dark-700 flex items-center justify-between">
          <p className="text-sm text-dark-400">
            Showing {offset + 1}-{Math.min(offset + limit, data.total)} of{' '}
            {data.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={!hasPrevious}
              className="px-3 py-1.5 text-sm font-medium text-dark-300 bg-dark-700 rounded-lg hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={!hasMore}
              className="px-3 py-1.5 text-sm font-medium text-dark-300 bg-dark-700 rounded-lg hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionListSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 bg-dark-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-dark-700 rounded" />
              <div className="h-3 w-24 bg-dark-700 rounded" />
            </div>
            <div className="hidden md:block h-4 w-48 bg-dark-700 rounded" />
            <div className="h-6 w-16 bg-dark-700 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}

function EmptyState({ search, status }: { search: string; status: Status }) {
  return (
    <div className="p-12 text-center">
      <svg
        className="w-12 h-12 mx-auto text-dark-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h4 className="mt-4 text-lg font-medium text-dark-300">
        No transactions found
      </h4>
      <p className="mt-2 text-sm text-dark-500">
        {search
          ? `No transactions match "${search}"`
          : status !== 'all'
          ? `No ${status} transactions in this period`
          : 'Add contracts to watch to see their transactions'}
      </p>
    </div>
  );
}

export { StatusFilter } from './StatusFilter';
export { SearchBar } from './SearchBar';
export { TransactionRow } from './TransactionRow';
export { TransactionDetail } from './TransactionDetail';
