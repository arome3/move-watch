'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EventCard } from './EventCard';
import { EventFilter } from './EventFilter';
import { PauseButton } from './PauseButton';
import { fetchEvents } from '@/lib/monitoringApi';
import type { Network } from '@movewatch/shared';

interface EventStreamProps {
  network?: Network;
  moduleAddress?: string;
}

export function EventStream({
  network = 'testnet',
  moduleAddress,
}: EventStreamProps) {
  const [eventType, setEventType] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['events', network, moduleAddress, eventType],
    queryFn: () =>
      fetchEvents(network, {
        moduleAddress,
        eventType: eventType || undefined,
        limit: 50,
      }),
    refetchInterval: isPaused ? false : 5000, // Poll every 5 seconds when not paused
  });

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">Event Stream</h3>
            {!isPaused && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <EventFilter value={eventType} onChange={setEventType} />
            <PauseButton
              isPaused={isPaused}
              onToggle={() => setIsPaused(!isPaused)}
            />
          </div>
        </div>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <EventStreamSkeleton />
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400">Failed to load events</p>
          </div>
        ) : !data?.events.length ? (
          <EmptyState eventType={eventType} />
        ) : (
          data.events.map((event, index) => (
            <EventCard
              key={`${event.transactionHash}-${event.sequenceNumber}-${index}`}
              event={event}
              network={network}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {data?.events.length || 0} events
            {data?.total ? ` of ${data.total}` : ''}
          </span>
          <span>
            Last updated:{' '}
            {dataUpdatedAt
              ? new Date(dataUpdatedAt).toLocaleTimeString()
              : 'Never'}
          </span>
        </div>
      </div>
    </div>
  );
}

function EventStreamSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="p-4 bg-slate-900 rounded-lg border border-slate-700 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-48 bg-slate-700 rounded" />
            <div className="h-3 w-24 bg-slate-700 rounded" />
          </div>
          <div className="mt-3 h-16 bg-slate-800 rounded" />
        </div>
      ))}
    </>
  );
}

function EmptyState({ eventType }: { eventType: string }) {
  return (
    <div className="text-center py-12">
      <svg
        className="w-12 h-12 mx-auto text-slate-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      <h4 className="mt-4 text-lg font-medium text-slate-300">
        No events found
      </h4>
      <p className="mt-2 text-sm text-slate-500">
        {eventType
          ? `No events match "${eventType}"`
          : 'Waiting for events from your watched contracts'}
      </p>
    </div>
  );
}

export { EventCard } from './EventCard';
export { EventFilter } from './EventFilter';
export { PauseButton } from './PauseButton';
