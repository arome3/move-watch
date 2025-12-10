'use client';

import { useState } from 'react';
import type { SimulationEvent } from '@movewatch/shared';

interface EventsListProps {
  events: SimulationEvent[];
}

export function EventsList({ events }: EventsListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (events.length === 0) {
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
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm">No events emitted</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-slate-300">
        Events <span className="text-slate-500">({events.length})</span>
      </h3>

      <div className="space-y-2">
        {events.map((event, index) => (
          <div
            key={index}
            className="border border-slate-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50
                        hover:bg-slate-800 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-mono">#{event.sequenceNumber}</span>
                <code className="text-sm text-primary-400 font-mono truncate max-w-[300px]">
                  {event.type.split('::').slice(-1)[0]}
                </code>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-slate-500 transition-transform ${
                  expandedIndex === index ? 'rotate-180' : ''
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

            {expandedIndex === index && (
              <div className="px-4 py-3 border-t border-slate-700 bg-slate-900/50">
                <p className="text-xs text-slate-500 mb-2 font-mono">{event.type}</p>
                <pre className="text-xs font-mono text-slate-300 overflow-x-auto">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
