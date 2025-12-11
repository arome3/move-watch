'use client';

interface Anomaly {
  timestamp: string;
  gasUsed: number;
  transactionHash: string;
  functionName: string;
}

interface AnomalyListProps {
  anomalies: Anomaly[];
  network: string;
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString([], {
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

export function AnomalyList({ anomalies, network }: AnomalyListProps) {
  if (!anomalies || anomalies.length === 0) {
    return (
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <h4 className="text-sm font-medium text-slate-400 uppercase">
          Gas Anomalies
        </h4>
        <div className="mt-4 text-center">
          <svg
            className="w-8 h-8 mx-auto text-green-500/50"
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
          <p className="mt-2 text-sm text-slate-500">No anomalies detected</p>
          <p className="text-xs text-slate-600">
            Anomalies are transactions with gas &gt; 2x average
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-slate-400 uppercase">
          Gas Anomalies
        </h4>
        <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 rounded">
          {anomalies.length} found
        </span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {anomalies.map((anomaly, index) => (
          <a
            key={index}
            href={getExplorerUrl(anomaly.transactionHash, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 bg-slate-900 rounded-lg border border-red-500/20 hover:border-red-500/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <code className="text-sm text-white font-mono">
                  {truncateHash(anomaly.transactionHash)}
                </code>
                <p className="text-xs text-slate-500 mt-0.5">
                  {anomaly.functionName} • {formatTimestamp(anomaly.timestamp)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-red-400">
                  {anomaly.gasUsed.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">gas used</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
