'use client';

import { useState } from 'react';
import type { StateChange } from '@movewatch/shared';

interface StateChangesProps {
  changes: StateChange[];
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

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function StateChanges({ changes }: StateChangesProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
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
      <h3 className="text-sm font-medium text-slate-300">
        State Changes <span className="text-slate-500">({changes.length})</span>
      </h3>

      <div className="space-y-3">
        {Object.entries(grouped).map(([address, addressChanges]) => (
          <div key={address} className="border border-slate-700 rounded-lg overflow-hidden">
            {/* Address Header */}
            <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700">
              <code className="text-xs font-mono text-slate-400">
                {truncateAddress(address)}
              </code>
            </div>

            {/* Changes */}
            <div className="divide-y divide-slate-700">
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
                                hover:bg-slate-800/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <ChangeTypeBadge type={change.type} />
                        <code className="text-sm text-slate-300 font-mono truncate max-w-[250px]">
                          {change.resource.split('::').slice(-1)[0]}
                        </code>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 text-slate-500 transition-transform ${
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
                      <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-3 font-mono break-all">
                          {change.resource}
                        </p>

                        {change.type === 'modify' && change.before && change.after && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs text-slate-500 block mb-1">Before</span>
                              <pre className="text-xs font-mono text-red-300 bg-red-500/5 p-2 rounded overflow-x-auto">
                                {JSON.stringify(change.before, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <span className="text-xs text-slate-500 block mb-1">After</span>
                              <pre className="text-xs font-mono text-green-300 bg-green-500/5 p-2 rounded overflow-x-auto">
                                {JSON.stringify(change.after, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}

                        {change.type === 'create' && change.after && (
                          <div>
                            <span className="text-xs text-slate-500 block mb-1">New Value</span>
                            <pre className="text-xs font-mono text-green-300 bg-green-500/5 p-2 rounded overflow-x-auto">
                              {JSON.stringify(change.after, null, 2)}
                            </pre>
                          </div>
                        )}

                        {change.type === 'delete' && change.before && (
                          <div>
                            <span className="text-xs text-slate-500 block mb-1">Deleted Value</span>
                            <pre className="text-xs font-mono text-red-300 bg-red-500/5 p-2 rounded overflow-x-auto">
                              {JSON.stringify(change.before, null, 2)}
                            </pre>
                          </div>
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
