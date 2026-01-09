'use client';

import type { ChannelConfig as ChannelConfigType, ChannelType } from '@movewatch/shared';

interface ChannelListProps {
  channels: ChannelConfigType[];
  onRemove: (index: number) => void;
}

const CHANNEL_INFO: Record<ChannelType, { label: string; icon: string; color: string }> = {
  discord: { label: 'Discord', icon: '💬', color: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' },
  slack: { label: 'Slack', icon: '📱', color: 'bg-purple-500/10 border-purple-500/20 text-purple-400' },
  telegram: { label: 'Telegram', icon: '✈️', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
  webhook: { label: 'Webhook', icon: '🔗', color: 'bg-dark-500/10 border-dark-500/20 text-dark-400' },
  email: { label: 'Email', icon: '📧', color: 'bg-green-500/10 border-green-500/20 text-green-400' },
  action: { label: 'Action', icon: '⚡', color: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' },
};

export function ChannelList({ channels, onRemove }: ChannelListProps) {
  if (channels.length === 0) {
    return (
      <div className="text-center py-6 border border-dashed border-dark-700 rounded-lg">
        <p className="text-sm text-dark-500">No notification channels configured</p>
        <p className="text-xs text-dark-600 mt-1">Add at least one channel below</p>
      </div>
    );
  }

  const getChannelSummary = (channel: ChannelConfigType): string => {
    switch (channel.type) {
      case 'discord':
      case 'slack':
        return truncateUrl(channel.config.webhookUrl);
      case 'telegram':
        return `Chat: ${channel.config.chatId}`;
      case 'webhook':
        return truncateUrl(channel.config.url);
      case 'email':
        return channel.config.email;
      case 'action':
        return channel.config.actionName || 'Action configured';
      default:
        return 'Configured';
    }
  };

  return (
    <div className="space-y-2">
      {channels.map((channel, index) => {
        const info = CHANNEL_INFO[channel.type];
        return (
          <div
            key={index}
            className={`flex items-center justify-between p-3 rounded-lg border ${info.color}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{info.icon}</span>
              <div>
                <p className="text-sm font-medium text-dark-200">{info.label}</p>
                <p className="text-xs text-dark-500">{getChannelSummary(channel)}</p>
              </div>
            </div>
            <button
              onClick={() => onRemove(index)}
              className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-red-500/10
                         rounded transition-colors"
              title="Remove channel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 20
      ? parsed.pathname.slice(0, 20) + '...'
      : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return url.length > 30 ? url.slice(0, 30) + '...' : url;
  }
}
