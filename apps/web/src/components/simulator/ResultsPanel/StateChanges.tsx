'use client';

import { useState, useMemo } from 'react';
import type { StateChange, FieldDiff } from '@movewatch/shared';

interface StateChangesProps {
  changes: StateChange[];
}

// Extract balance info from state changes
interface BalanceChange {
  address: string;
  token: string;
  tokenShort: string;
  before: bigint;
  after: bigint;
  change: bigint;
  changeFormatted: string;
}

// Extract ownership transfer info
interface OwnershipTransfer {
  objectAddress: string;
  objectType: string;
  fromOwner: string;
  toOwner: string;
}

function ChangeTypeBadge({ type }: { type: StateChange['type'] }) {
  const colors = {
    create: 'bg-green-500/10 text-green-400 border-green-500/20',
    modify: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    delete: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded border uppercase ${colors[type]}`}
    >
      {type}
    </span>
  );
}

function FieldChangeIcon({ changeType }: { changeType: FieldDiff['changeType'] }) {
  const icons = {
    added: (
      <svg className="h-3.5 w-3.5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
      </svg>
    ),
    removed: (
      <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
    modified: (
      <svg className="h-3.5 w-3.5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
    ),
    unchanged: (
      <svg className="h-3.5 w-3.5 text-dark-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
  };
  return icons[changeType] || null;
}

function FieldDiffRow({ field }: { field: FieldDiff }) {
  const colors = {
    added: 'bg-green-500/5 border-green-500/20',
    removed: 'bg-red-500/5 border-red-500/20',
    modified: 'bg-amber-500/5 border-amber-500/20',
    unchanged: 'bg-dark-800/30 border-dark-700/50',
  };

  const textColors = {
    added: 'text-green-300',
    removed: 'text-red-300',
    modified: 'text-amber-300',
    unchanged: 'text-dark-400',
  };

  return (
    <div className={`flex items-start gap-3 px-3 py-2 rounded border ${colors[field.changeType]}`}>
      <div className="flex-shrink-0 mt-0.5">
        <FieldChangeIcon changeType={field.changeType} />
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-dark-300">{field.label}</span>
          <span className="text-[10px] text-dark-500 font-mono">{field.path}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
          {field.before !== undefined && (
            <span className={field.changeType === 'removed' ? 'text-red-300' : 'text-dark-400'}>
              {field.before}
            </span>
          )}
          {field.before !== undefined && field.after !== undefined && field.changeType === 'modified' && (
            <span className="text-dark-500">→</span>
          )}
          {field.after !== undefined && (
            <span className={textColors[field.changeType]}>
              {field.after}
            </span>
          )}
          {field.change && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              field.change.startsWith('+') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {field.change}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

// Format octas to human-readable APT/token amount
function formatTokenAmount(octas: bigint, decimals: number = 8): string {
  const value = Number(octas) / Math.pow(10, decimals);
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  } else if (Math.abs(value) >= 1) {
    return value.toFixed(4);
  } else if (Math.abs(value) >= 0.0001) {
    return value.toFixed(6);
  } else {
    return `${octas.toString()} octas`;
  }
}

// Extract token name from resource type
function extractTokenName(resource: string): { full: string; short: string } {
  // e.g., "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>" -> "AptosCoin"
  const match = resource.match(/<([^>]+)>/);
  if (match) {
    const inner = match[1];
    const parts = inner.split('::');
    return {
      full: inner,
      short: parts[parts.length - 1] || 'Unknown',
    };
  }
  return { full: resource, short: 'Unknown' };
}

// Balance Summary Card Component
function BalanceSummaryCard({ balanceChanges }: { balanceChanges: BalanceChange[] }) {
  if (balanceChanges.length === 0) return null;

  // Group by token type
  const byToken = balanceChanges.reduce((acc, bc) => {
    if (!acc[bc.tokenShort]) acc[bc.tokenShort] = [];
    acc[bc.tokenShort].push(bc);
    return acc;
  }, {} as Record<string, BalanceChange[]>);

  return (
    <div className="bg-gradient-to-r from-primary-500/5 to-blue-500/5 border border-primary-500/20 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="h-5 w-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h4 className="text-sm font-medium text-dark-200">Balance Changes</h4>
      </div>

      <div className="space-y-3">
        {Object.entries(byToken).map(([token, changes]) => (
          <div key={token} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-dark-400 uppercase tracking-wider">{token}</span>
              <div className="flex-grow border-t border-dark-700/50" />
            </div>
            {changes.map((bc, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 bg-dark-900/50 rounded">
                <code className="text-xs font-mono text-dark-400">
                  {truncateAddress(bc.address)}
                </code>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-dark-500">
                    {formatTokenAmount(bc.before)} → {formatTokenAmount(bc.after)}
                  </span>
                  <span className={`text-sm font-mono font-medium ${
                    bc.change > BigInt(0) ? 'text-green-400' : bc.change < BigInt(0) ? 'text-red-400' : 'text-dark-400'
                  }`}>
                    {bc.change > BigInt(0) ? '+' : ''}{bc.changeFormatted}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Ownership Transfer Card Component
function OwnershipTransferCard({ transfers }: { transfers: OwnershipTransfer[] }) {
  if (transfers.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-purple-500/5 to-pink-500/5 border border-purple-500/20 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        <h4 className="text-sm font-medium text-dark-200">Ownership Transfers</h4>
      </div>

      <div className="space-y-2">
        {transfers.map((transfer, idx) => (
          <div key={idx} className="px-3 py-2 bg-dark-900/50 rounded">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded">
                object
              </span>
              <code className="text-xs font-mono text-dark-300 truncate max-w-[200px]">
                {transfer.objectType.split('::').pop()}
              </code>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <code className="font-mono text-red-400">
                {truncateAddress(transfer.fromOwner)}
              </code>
              <svg className="h-4 w-4 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <code className="font-mono text-green-400">
                {truncateAddress(transfer.toOwner)}
              </code>
            </div>
            <div className="mt-1 text-[10px] text-dark-500 font-mono">
              Object: {truncateAddress(transfer.objectAddress)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Change Type Summary
function ChangeTypeSummary({ changes }: { changes: StateChange[] }) {
  const counts = useMemo(() => {
    return changes.reduce(
      (acc, c) => {
        acc[c.type]++;
        return acc;
      },
      { create: 0, modify: 0, delete: 0 }
    );
  }, [changes]);

  return (
    <div className="flex items-center gap-4 mb-4">
      {counts.create > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-dark-400">
            <span className="text-green-400 font-medium">{counts.create}</span> created
          </span>
        </div>
      )}
      {counts.modify > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs text-dark-400">
            <span className="text-amber-400 font-medium">{counts.modify}</span> modified
          </span>
        </div>
      )}
      {counts.delete > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs text-dark-400">
            <span className="text-red-400 font-medium">{counts.delete}</span> deleted
          </span>
        </div>
      )}
    </div>
  );
}

export function StateChanges({ changes }: StateChangesProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Extract balance changes from CoinStore resources
  const balanceChanges = useMemo<BalanceChange[]>(() => {
    const results: BalanceChange[] = [];

    for (const change of changes) {
      // Check if it's a CoinStore or FungibleStore resource
      if (!change.resource.includes('CoinStore') && !change.resource.includes('FungibleStore')) {
        continue;
      }

      const token = extractTokenName(change.resource);

      // Extract balance values
      let beforeBalance = BigInt(0);
      let afterBalance = BigInt(0);

      try {
        // Try to get balance from coin.value or balance field
        const beforeData = change.before as Record<string, unknown> | null;
        const afterData = change.after as Record<string, unknown> | null;

        if (beforeData) {
          const coinBefore = beforeData.coin as Record<string, unknown> | undefined;
          beforeBalance = BigInt(
            (coinBefore?.value as string) ||
            (beforeData.balance as string) ||
            '0'
          );
        }

        if (afterData) {
          const coinAfter = afterData.coin as Record<string, unknown> | undefined;
          afterBalance = BigInt(
            (coinAfter?.value as string) ||
            (afterData.balance as string) ||
            '0'
          );
        }
      } catch {
        continue; // Skip if can't parse balance
      }

      const balanceChange = afterBalance - beforeBalance;

      if (beforeBalance !== afterBalance) {
        results.push({
          address: change.address,
          token: token.full,
          tokenShort: token.short,
          before: beforeBalance,
          after: afterBalance,
          change: balanceChange,
          changeFormatted: formatTokenAmount(balanceChange),
        });
      }
    }

    return results;
  }, [changes]);

  // Extract ownership transfers from Object resources
  const ownershipTransfers = useMemo<OwnershipTransfer[]>(() => {
    const results: OwnershipTransfer[] = [];

    for (const change of changes) {
      // Look for ObjectCore or ownership-related resources
      if (!change.resource.includes('object::ObjectCore') &&
          !change.resource.includes('object::Object')) {
        continue;
      }

      try {
        const beforeData = change.before as Record<string, unknown> | null;
        const afterData = change.after as Record<string, unknown> | null;

        const beforeOwner = beforeData?.owner as string | undefined;
        const afterOwner = afterData?.owner as string | undefined;

        if (beforeOwner && afterOwner && beforeOwner !== afterOwner) {
          results.push({
            objectAddress: change.address,
            objectType: change.resource,
            fromOwner: beforeOwner,
            toOwner: afterOwner,
          });
        }

        // Also check for transfer_ref changes indicating ownership transfer
        const beforeTransferRef = beforeData?.transfer_ref as Record<string, unknown> | undefined;
        const afterTransferRef = afterData?.transfer_ref as Record<string, unknown> | undefined;

        if (beforeTransferRef?.self !== afterTransferRef?.self) {
          // Transfer ref changed, indicating potential ownership transfer
        }
      } catch {
        continue;
      }
    }

    return results;
  }, [changes]);

  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-dark-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 mx-auto mb-3 opacity-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
          />
        </svg>
        <p className="text-sm">No state changes</p>
      </div>
    );
  }

  // Group changes by address
  const grouped = changes.reduce((acc, change) => {
    const addr = change.address;
    if (!acc[addr]) acc[addr] = [];
    acc[addr].push(change);
    return acc;
  }, {} as Record<string, StateChange[]>);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-dark-300">
        State Changes <span className="text-dark-500">({changes.length})</span>
      </h3>

      {/* Change Type Summary */}
      <ChangeTypeSummary changes={changes} />

      {/* Balance Summary Card */}
      <BalanceSummaryCard balanceChanges={balanceChanges} />

      {/* Ownership Transfers Card */}
      <OwnershipTransferCard transfers={ownershipTransfers} />

      {/* Detailed Changes List */}
      <div className="space-y-3">
        {Object.entries(grouped).map(([address, addressChanges]) => (
          <div key={address} className="border border-dark-700 rounded-lg overflow-hidden">
            {/* Address Header */}
            <div className="px-4 py-2 bg-dark-800/50 border-b border-dark-700">
              <code className="text-xs font-mono text-dark-400">
                {truncateAddress(address)}
              </code>
            </div>

            {/* Changes */}
            <div className="divide-y divide-dark-700">
              {addressChanges.map((change, index) => {
                const globalIndex = changes.indexOf(change);
                const isExpanded = expandedIndex === globalIndex;

                return (
                  <div key={index}>
                    <button
                      onClick={() =>
                        setExpandedIndex(isExpanded ? null : globalIndex)
                      }
                      className="w-full flex items-center justify-between px-4 py-3
                                hover:bg-dark-800/30 transition-colors text-left"
                    >
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <ChangeTypeBadge type={change.type} />
                          <code className="text-sm text-dark-300 font-mono truncate max-w-[250px]">
                            {change.resource.split('::').slice(-1)[0]}
                          </code>
                        </div>
                        {/* Show diff summary if available */}
                        {change.diff?.summary && (
                          <p className="text-xs text-dark-400 truncate ml-0">
                            {change.diff.summary}
                          </p>
                        )}
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 text-dark-500 transition-transform flex-shrink-0 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="px-4 py-3 bg-dark-900/50 border-t border-dark-700/50">
                        <p className="text-xs text-dark-500 mb-3 font-mono break-all">
                          {change.resource}
                        </p>

                        {/* Show human-readable field diffs if available */}
                        {change.diff?.fields && change.diff.fields.length > 0 ? (
                          <div className="space-y-2">
                            {change.diff.fields.map((field, idx) => (
                              <FieldDiffRow key={idx} field={field} />
                            ))}
                          </div>
                        ) : (
                          /* Fallback to raw JSON if no diff data */
                          <>
                            {change.type === 'modify' && change.before != null && change.after != null && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-xs text-dark-500 block mb-1">Before</span>
                                  <pre className="text-xs font-mono text-red-300 bg-red-500/5 p-2 rounded overflow-x-auto max-h-48">
                                    {JSON.stringify(change.before, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <span className="text-xs text-dark-500 block mb-1">After</span>
                                  <pre className="text-xs font-mono text-green-300 bg-green-500/5 p-2 rounded overflow-x-auto max-h-48">
                                    {JSON.stringify(change.after, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {change.type === 'create' && change.after != null && (
                              <div>
                                <span className="text-xs text-dark-500 block mb-1">New Value</span>
                                <pre className="text-xs font-mono text-green-300 bg-green-500/5 p-2 rounded overflow-x-auto max-h-48">
                                  {JSON.stringify(change.after, null, 2)}
                                </pre>
                              </div>
                            )}

                            {change.type === 'delete' && change.before != null && (
                              <div>
                                <span className="text-xs text-dark-500 block mb-1">Deleted Value</span>
                                <pre className="text-xs font-mono text-red-300 bg-red-500/5 p-2 rounded overflow-x-auto max-h-48">
                                  {JSON.stringify(change.before, null, 2)}
                                </pre>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
