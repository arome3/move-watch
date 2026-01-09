'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTransactionDetail } from '@/lib/monitoringApi';
import type { Network } from '@movewatch/shared';

interface TransactionDetailProps {
  hash: string;
  network: Network;
}

export function TransactionDetail({ hash, network }: TransactionDetailProps) {
  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['transaction-detail', hash, network],
    queryFn: () => fetchTransactionDetail(hash, network),
  });

  if (isLoading) {
    return (
      <div className="p-4 bg-dark-900 border-t border-dark-700">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 bg-dark-700 rounded" />
          <div className="h-4 w-64 bg-dark-700 rounded" />
          <div className="h-4 w-48 bg-dark-700 rounded" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-4 bg-dark-900 border-t border-dark-700">
        <p className="text-sm text-red-400">Failed to load transaction details</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-dark-900 border-t border-dark-700 space-y-4">
      {/* Transaction Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-dark-500 uppercase">Full Hash</p>
          <code className="text-sm text-white font-mono break-all">
            {detail.hash}
          </code>
        </div>
        <div>
          <p className="text-xs text-dark-500 uppercase">Version</p>
          <p className="text-sm text-white">{detail.version}</p>
        </div>
        <div>
          <p className="text-xs text-dark-500 uppercase">Sender</p>
          <code className="text-sm text-white font-mono break-all">
            {detail.sender}
          </code>
        </div>
        <div>
          <p className="text-xs text-dark-500 uppercase">Sequence Number</p>
          <p className="text-sm text-white">{detail.sequenceNumber}</p>
        </div>
        {detail.vmStatus && (
          <div className="md:col-span-2">
            <p className="text-xs text-dark-500 uppercase">VM Status</p>
            <code className="text-sm text-yellow-400 font-mono">
              {detail.vmStatus}
            </code>
          </div>
        )}
      </div>

      {/* Events */}
      {detail.events && detail.events.length > 0 && (
        <div>
          <p className="text-xs text-dark-500 uppercase mb-2">
            Events ({detail.events.length})
          </p>
          <div className="space-y-2">
            {detail.events.map((event, index) => (
              <div
                key={index}
                className="p-3 bg-dark-800 rounded-lg border border-dark-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <code className="text-sm text-primary-400">
                    {event.eventType}
                  </code>
                  <span className="text-xs text-dark-500">
                    #{event.sequenceNumber}
                  </span>
                </div>
                <pre className="text-xs text-dark-300 overflow-x-auto">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
