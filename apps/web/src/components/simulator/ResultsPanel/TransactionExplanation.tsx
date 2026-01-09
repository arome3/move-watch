'use client';

import type { TransactionExplanation as TxExplanation } from '@movewatch/shared';

interface TransactionExplanationProps {
  explanation: TxExplanation;
}

// Icon mapping for transaction types
const typeIcons: Record<string, JSX.Element> = {
  transfer: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  swap: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  stake: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  unstake: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  ),
  mint: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  burn: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    </svg>
  ),
  create_account: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  nft_transfer: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  nft_mint: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  liquidity_add: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  liquidity_remove: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
    </svg>
  ),
  governance_vote: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  contract_deploy: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  register_coin: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  unknown: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// Background colors for transaction types
const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  transfer: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  swap: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  stake: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  unstake: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  mint: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  burn: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  create_account: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  nft_transfer: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  nft_mint: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  liquidity_add: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
  liquidity_remove: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  governance_vote: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  contract_deploy: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  register_coin: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  unknown: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
};

function formatDetailValue(value: string, type: string): React.ReactNode {
  switch (type) {
    case 'address':
      return (
        <span className="font-mono text-xs bg-dark-900 px-1.5 py-0.5 rounded">
          {value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value}
        </span>
      );
    case 'amount':
      return <span className="font-mono text-primary-400">{value}</span>;
    case 'token':
      return (
        <span className="px-2 py-0.5 text-xs bg-primary-500/10 text-primary-400 rounded">
          {value}
        </span>
      );
    case 'percentage':
      return <span className="font-mono text-emerald-400">{value}</span>;
    default:
      return <span>{value}</span>;
  }
}

export function TransactionExplanation({ explanation }: TransactionExplanationProps) {
  const colors = typeColors[explanation.type] || typeColors.unknown;
  const icon = typeIcons[explanation.type] || typeIcons.unknown;

  return (
    <div className="space-y-4">
      {/* Human-readable summary card */}
      <div className={`${colors.bg} border ${colors.border} rounded-lg p-4`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors.bg} ${colors.border} ${colors.text} border`}>
                {explanation.type.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-lg font-medium text-dark-50">{explanation.summary}</p>
            <p className="text-sm text-dark-300 mt-2">{explanation.humanReadable}</p>
          </div>
        </div>
      </div>

      {/* Transaction Details */}
      {explanation.details.length > 0 && (
        <div className="bg-dark-900/50 border border-dark-800 rounded-lg p-4">
          <h4 className="text-xs text-dark-500 uppercase tracking-wider mb-3">Transaction Details</h4>
          <div className="grid gap-3">
            {explanation.details.map((detail, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between py-2 ${
                  idx !== explanation.details.length - 1 ? 'border-b border-dark-800' : ''
                }`}
              >
                <span className="text-sm text-dark-400">{detail.label}</span>
                <span className={`text-sm ${detail.highlight ? 'text-primary-400 font-medium' : 'text-dark-200'}`}>
                  {formatDetailValue(detail.value, detail.type)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {explanation.warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-amber-400 mb-1">Warnings</h4>
              <ul className="space-y-1">
                {explanation.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-amber-300/80">{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
