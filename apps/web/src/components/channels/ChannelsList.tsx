'use client';

import type { NotificationChannelResponse, ChannelType } from '@movewatch/shared';
import { ChannelCard } from './ChannelCard';

interface ChannelsListProps {
  channels: NotificationChannelResponse[];
  isLoading: boolean;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
  isTesting?: boolean;
}

export function ChannelsList({
  channels,
  isLoading,
  onView,
  onEdit,
  onTest,
  onDelete,
  isDeleting,
  isTesting,
}: ChannelsListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-dark-800 rounded-lg p-6 animate-pulse"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-dark-700" />
              <div className="flex-1">
                <div className="h-5 w-32 bg-dark-700 rounded mb-2" />
                <div className="h-4 w-24 bg-dark-700 rounded" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-dark-700">
              <div className="flex gap-2">
                <div className="h-8 w-16 bg-dark-700 rounded" />
                <div className="h-8 w-16 bg-dark-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="text-center py-12 bg-dark-800 rounded-lg">
        <svg
          className="w-16 h-16 mx-auto text-dark-500 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <h3 className="text-lg font-medium text-dark-200 mb-2">No channels yet</h3>
        <p className="text-sm text-dark-400 mb-6 max-w-sm mx-auto">
          Create notification channels to receive alerts via Discord, Slack, Telegram, webhooks, or email.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {channels.map((channel) => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          onView={() => onView(channel.id)}
          onEdit={() => onEdit(channel.id)}
          onTest={() => onTest(channel.id)}
          onDelete={() => onDelete(channel.id)}
          isDeleting={isDeleting}
          isTesting={isTesting}
        />
      ))}
    </div>
  );
}
