'use client';

import type { ChannelType } from '@movewatch/shared';

interface ChannelInfo {
  id: string;
  type: ChannelType;
  configured: boolean;
  enabled: boolean;
}

interface ChannelStatusProps {
  channels: ChannelInfo[];
}

const CHANNEL_INFO: Record<ChannelType, { label: string; icon: string }> = {
  discord: { label: 'Discord', icon: '💬' },
  slack: { label: 'Slack', icon: '📱' },
  telegram: { label: 'Telegram', icon: '✈️' },
  webhook: { label: 'Webhook', icon: '🔗' },
};

export function ChannelStatus({ channels }: ChannelStatusProps) {
  if (channels.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500">No notification channels configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {channels.map((channel) => {
        const info = CHANNEL_INFO[channel.type];
        const statusColor = !channel.configured
          ? 'text-yellow-400'
          : channel.enabled
            ? 'text-green-400'
            : 'text-slate-500';
        const statusText = !channel.configured
          ? 'Not configured'
          : channel.enabled
            ? 'Active'
            : 'Disabled';

        return (
          <div
            key={channel.id}
            className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{info.icon}</span>
              <span className="text-sm font-medium text-slate-200">{info.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                !channel.configured
                  ? 'bg-yellow-400'
                  : channel.enabled
                    ? 'bg-green-400'
                    : 'bg-slate-500'
              }`} />
              <span className={`text-xs ${statusColor}`}>{statusText}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
