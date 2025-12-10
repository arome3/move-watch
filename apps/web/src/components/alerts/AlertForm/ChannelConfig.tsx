'use client';

import { useState } from 'react';
import type {
  ChannelConfig as ChannelConfigType,
  ChannelType,
  DiscordChannelConfig,
  SlackChannelConfig,
  TelegramChannelConfig,
  WebhookChannelConfig,
} from '@movewatch/shared';

interface ChannelConfigProps {
  onAdd: (channel: ChannelConfigType) => void;
  existingTypes: ChannelType[];
}

const CHANNEL_TYPES: { value: ChannelType; label: string; icon: string }[] = [
  { value: 'discord', label: 'Discord', icon: '💬' },
  { value: 'slack', label: 'Slack', icon: '📱' },
  { value: 'telegram', label: 'Telegram', icon: '✈️' },
  { value: 'webhook', label: 'Custom Webhook', icon: '🔗' },
];

export function ChannelConfig({ onAdd, existingTypes }: ChannelConfigProps) {
  const [selectedType, setSelectedType] = useState<ChannelType | ''>('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableTypes = CHANNEL_TYPES.filter(
    (t) => !existingTypes.includes(t.value)
  );

  const validateAndAdd = () => {
    if (!selectedType) return;

    const newErrors: Record<string, string> = {};

    switch (selectedType) {
      case 'discord':
        if (!config.webhookUrl) {
          newErrors.webhookUrl = 'Webhook URL is required';
        } else if (!config.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
          newErrors.webhookUrl = 'Invalid Discord webhook URL';
        }
        break;

      case 'slack':
        if (!config.webhookUrl) {
          newErrors.webhookUrl = 'Webhook URL is required';
        } else if (!config.webhookUrl.startsWith('https://hooks.slack.com/')) {
          newErrors.webhookUrl = 'Invalid Slack webhook URL';
        }
        break;

      case 'telegram':
        if (!config.botToken) newErrors.botToken = 'Bot token is required';
        if (!config.chatId) newErrors.chatId = 'Chat ID is required';
        break;

      case 'webhook':
        if (!config.url) {
          newErrors.url = 'Webhook URL is required';
        } else {
          try {
            new URL(config.url);
          } catch {
            newErrors.url = 'Invalid URL';
          }
        }
        break;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Build channel config
    let channelConfig: ChannelConfigType;

    switch (selectedType) {
      case 'discord':
        channelConfig = {
          type: 'discord',
          config: { webhookUrl: config.webhookUrl } as DiscordChannelConfig,
        };
        break;
      case 'slack':
        channelConfig = {
          type: 'slack',
          config: { webhookUrl: config.webhookUrl } as SlackChannelConfig,
        };
        break;
      case 'telegram':
        channelConfig = {
          type: 'telegram',
          config: {
            botToken: config.botToken,
            chatId: config.chatId,
          } as TelegramChannelConfig,
        };
        break;
      case 'webhook':
        channelConfig = {
          type: 'webhook',
          config: {
            url: config.url,
            authHeader: config.authHeader || undefined,
            authValue: config.authValue || undefined,
          } as WebhookChannelConfig,
        };
        break;
      default:
        return;
    }

    onAdd(channelConfig);
    setSelectedType('');
    setConfig({});
    setErrors({});
  };

  const renderConfigFields = () => {
    switch (selectedType) {
      case 'discord':
        return (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Webhook URL
            </label>
            <input
              type="url"
              value={config.webhookUrl || ''}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              placeholder="https://discord.com/api/webhooks/..."
              className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm
                         text-slate-100 placeholder:text-slate-600
                         focus:outline-none focus:ring-2 focus:ring-primary-500
                         ${errors.webhookUrl ? 'border-red-500' : 'border-slate-700'}`}
            />
            {errors.webhookUrl && (
              <p className="mt-1 text-xs text-red-400">{errors.webhookUrl}</p>
            )}
          </div>
        );

      case 'slack':
        return (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Webhook URL
            </label>
            <input
              type="url"
              value={config.webhookUrl || ''}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              placeholder="https://hooks.slack.com/services/..."
              className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm
                         text-slate-100 placeholder:text-slate-600
                         focus:outline-none focus:ring-2 focus:ring-primary-500
                         ${errors.webhookUrl ? 'border-red-500' : 'border-slate-700'}`}
            />
            {errors.webhookUrl && (
              <p className="mt-1 text-xs text-red-400">{errors.webhookUrl}</p>
            )}
          </div>
        );

      case 'telegram':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Bot Token
              </label>
              <input
                type="text"
                value={config.botToken || ''}
                onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm
                           text-slate-100 placeholder:text-slate-600
                           focus:outline-none focus:ring-2 focus:ring-primary-500
                           ${errors.botToken ? 'border-red-500' : 'border-slate-700'}`}
              />
              {errors.botToken && (
                <p className="mt-1 text-xs text-red-400">{errors.botToken}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Chat ID
              </label>
              <input
                type="text"
                value={config.chatId || ''}
                onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                placeholder="-1001234567890"
                className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm
                           text-slate-100 placeholder:text-slate-600
                           focus:outline-none focus:ring-2 focus:ring-primary-500
                           ${errors.chatId ? 'border-red-500' : 'border-slate-700'}`}
              />
              {errors.chatId && (
                <p className="mt-1 text-xs text-red-400">{errors.chatId}</p>
              )}
            </div>
          </div>
        );

      case 'webhook':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={config.url || ''}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder="https://your-server.com/webhook"
                className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm
                           text-slate-100 placeholder:text-slate-600
                           focus:outline-none focus:ring-2 focus:ring-primary-500
                           ${errors.url ? 'border-red-500' : 'border-slate-700'}`}
              />
              {errors.url && (
                <p className="mt-1 text-xs text-red-400">{errors.url}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Auth Header <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={config.authHeader || ''}
                  onChange={(e) => setConfig({ ...config, authHeader: e.target.value })}
                  placeholder="Authorization"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm
                            text-slate-100 placeholder:text-slate-600
                            focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Auth Value <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  type="password"
                  value={config.authValue || ''}
                  onChange={(e) => setConfig({ ...config, authValue: e.target.value })}
                  placeholder="Bearer token..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm
                            text-slate-100 placeholder:text-slate-600
                            focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (availableTypes.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-4">
        All channel types have been configured.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Channel Type
        </label>
        <select
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value as ChannelType | '');
            setConfig({});
            setErrors({});
          }}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm
                     text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Select a channel type...</option>
          {availableTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.icon} {type.label}
            </option>
          ))}
        </select>
      </div>

      {selectedType && (
        <>
          {renderConfigFields()}
          <button
            onClick={validateAndAdd}
            className="w-full py-2 px-4 bg-primary-500 hover:bg-primary-600 text-white
                       rounded-lg font-medium text-sm transition-colors"
          >
            Add Channel
          </button>
        </>
      )}
    </div>
  );
}
