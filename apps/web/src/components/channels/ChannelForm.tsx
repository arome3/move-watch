'use client';

import { useState, useEffect } from 'react';
import type { ChannelType } from '@movewatch/shared';
import { fetchActions, type ActionListItem } from '@/lib/actionsApi';

// Form data uses generic Record type - callers cast to specific types
export interface ChannelFormData {
  name: string;
  type: ChannelType;
  config: Record<string, unknown>;
}

interface ChannelFormProps {
  initialValues?: ChannelFormData;
  onSubmit: (data: ChannelFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const channelTypes: { value: ChannelType; label: string; description: string }[] = [
  { value: 'discord', label: 'Discord', description: 'Send notifications via Discord webhook' },
  { value: 'slack', label: 'Slack', description: 'Send notifications via Slack webhook' },
  { value: 'telegram', label: 'Telegram', description: 'Send notifications via Telegram bot' },
  { value: 'webhook', label: 'Webhook', description: 'Send to custom HTTP endpoint' },
  { value: 'email', label: 'Email', description: 'Send email notifications' },
  { value: 'action', label: 'Execute Action', description: 'Trigger a serverless action' },
];

export function ChannelForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel = 'Create Channel',
}: ChannelFormProps) {
  const [name, setName] = useState(initialValues?.name || '');
  const [type, setType] = useState<ChannelType>(initialValues?.type || 'discord');
  const [config, setConfig] = useState<Record<string, string>>(
    (initialValues?.config as Record<string, string>) || {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // State for action channel type
  const [actions, setActions] = useState<ActionListItem[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsError, setActionsError] = useState<string | null>(null);

  // Load actions when action type is selected
  useEffect(() => {
    if (type === 'action') {
      loadActions();
    }
  }, [type]);

  const loadActions = async () => {
    setActionsLoading(true);
    setActionsError(null);
    try {
      const data = await fetchActions();
      // Only show enabled actions
      setActions(data.filter((a: ActionListItem) => a.enabled));
    } catch (err) {
      setActionsError(err instanceof Error ? err.message : 'Failed to load actions');
    } finally {
      setActionsLoading(false);
    }
  };

  // Reset config when type changes (but keep if editing)
  useEffect(() => {
    if (!initialValues) {
      setConfig({});
    }
  }, [type, initialValues]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Validate config based on type
    switch (type) {
      case 'discord':
      case 'slack':
        if (!config.webhookUrl?.trim()) {
          newErrors.webhookUrl = 'Webhook URL is required';
        } else if (!config.webhookUrl.startsWith('http')) {
          newErrors.webhookUrl = 'Must be a valid URL';
        }
        break;
      case 'telegram':
        if (!config.botToken?.trim()) {
          newErrors.botToken = 'Bot token is required';
        }
        if (!config.chatId?.trim()) {
          newErrors.chatId = 'Chat ID is required';
        }
        break;
      case 'webhook':
        if (!config.url?.trim()) {
          newErrors.url = 'Webhook URL is required';
        } else if (!config.url.startsWith('http')) {
          newErrors.url = 'Must be a valid URL';
        }
        break;
      case 'email':
        if (!config.email?.trim()) {
          newErrors.email = 'Email address is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)) {
          newErrors.email = 'Must be a valid email address';
        }
        break;
      case 'action':
        if (!config.actionId?.trim()) {
          newErrors.actionId = 'Please select an action to execute';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    await onSubmit({
      name,
      type,
      config,
    });
  };

  const updateConfig = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    // Clear error when user types
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Channel Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-dark-200 mb-2">
          Channel Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
          }}
          placeholder="e.g., My Discord Server"
          className={`w-full px-4 py-2.5 bg-dark-700 border rounded-lg
                     text-dark-100 placeholder-dark-500
                     focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                     ${errors.name ? 'border-red-500' : 'border-dark-600'}`}
        />
        {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
      </div>

      {/* Channel Type */}
      <div>
        <label className="block text-sm font-medium text-dark-200 mb-3">
          Channel Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {channelTypes.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => setType(ct.value)}
              className={`p-3 rounded-lg border text-left transition-colors
                         ${type === ct.value
                           ? 'border-primary-500 bg-primary-500/10'
                           : 'border-dark-600 hover:border-dark-500 bg-dark-700'
                         }`}
            >
              <span className={`block text-sm font-medium ${
                type === ct.value ? 'text-primary-400' : 'text-dark-200'
              }`}>
                {ct.label}
              </span>
              <span className="block text-xs text-dark-400 mt-0.5">
                {ct.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Type-specific Configuration */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-dark-200">Configuration</h3>

        {type === 'discord' && (
          <div>
            <label htmlFor="webhookUrl" className="block text-sm text-dark-300 mb-2">
              Discord Webhook URL
            </label>
            <input
              type="url"
              id="webhookUrl"
              value={config.webhookUrl || ''}
              onChange={(e) => updateConfig('webhookUrl', e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className={`w-full px-4 py-2.5 bg-dark-700 border rounded-lg
                         text-dark-100 placeholder-dark-500
                         focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                         ${errors.webhookUrl ? 'border-red-500' : 'border-dark-600'}`}
            />
            {errors.webhookUrl && <p className="mt-1 text-sm text-red-400">{errors.webhookUrl}</p>}
            <p className="mt-1.5 text-xs text-dark-400">
              Create a webhook in Discord: Server Settings &gt; Integrations &gt; Webhooks
            </p>
          </div>
        )}

        {type === 'slack' && (
          <div>
            <label htmlFor="webhookUrl" className="block text-sm text-dark-300 mb-2">
              Slack Webhook URL
            </label>
            <input
              type="url"
              id="webhookUrl"
              value={config.webhookUrl || ''}
              onChange={(e) => updateConfig('webhookUrl', e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className={`w-full px-4 py-2.5 bg-dark-700 border rounded-lg
                         text-dark-100 placeholder-dark-500
                         focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                         ${errors.webhookUrl ? 'border-red-500' : 'border-dark-600'}`}
            />
            {errors.webhookUrl && <p className="mt-1 text-sm text-red-400">{errors.webhookUrl}</p>}
            <p className="mt-1.5 text-xs text-dark-400">
              Create an incoming webhook at api.slack.com/apps
            </p>
          </div>
        )}

        {type === 'telegram' && (
          <>
            <div>
              <label htmlFor="botToken" className="block text-sm text-dark-300 mb-2">
                Bot Token
              </label>
              <input
                type="text"
                id="botToken"
                value={config.botToken || ''}
                onChange={(e) => updateConfig('botToken', e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrs..."
                className={`w-full px-4 py-2.5 bg-dark-700 border rounded-lg
                           text-dark-100 placeholder-dark-500
                           focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                           ${errors.botToken ? 'border-red-500' : 'border-dark-600'}`}
              />
              {errors.botToken && <p className="mt-1 text-sm text-red-400">{errors.botToken}</p>}
              <p className="mt-1.5 text-xs text-dark-400">
                Get from @BotFather on Telegram
              </p>
            </div>
            <div>
              <label htmlFor="chatId" className="block text-sm text-dark-300 mb-2">
                Chat ID
              </label>
              <input
                type="text"
                id="chatId"
                value={config.chatId || ''}
                onChange={(e) => updateConfig('chatId', e.target.value)}
                placeholder="-1001234567890"
                className={`w-full px-4 py-2.5 bg-dark-700 border rounded-lg
                           text-dark-100 placeholder-dark-500
                           focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                           ${errors.chatId ? 'border-red-500' : 'border-dark-600'}`}
              />
              {errors.chatId && <p className="mt-1 text-sm text-red-400">{errors.chatId}</p>}
              <p className="mt-1.5 text-xs text-dark-400">
                Use @userinfobot to get your chat ID
              </p>
            </div>
          </>
        )}

        {type === 'webhook' && (
          <>
            <div>
              <label htmlFor="url" className="block text-sm text-dark-300 mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                id="url"
                value={config.url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
                placeholder="https://your-server.com/webhook"
                className={`w-full px-4 py-2.5 bg-dark-700 border rounded-lg
                           text-dark-100 placeholder-dark-500
                           focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                           ${errors.url ? 'border-red-500' : 'border-dark-600'}`}
              />
              {errors.url && <p className="mt-1 text-sm text-red-400">{errors.url}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="authHeader" className="block text-sm text-dark-300 mb-2">
                  Auth Header (optional)
                </label>
                <input
                  type="text"
                  id="authHeader"
                  value={config.authHeader || ''}
                  onChange={(e) => updateConfig('authHeader', e.target.value)}
                  placeholder="Authorization"
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg
                             text-dark-100 placeholder-dark-500
                             focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                />
              </div>
              <div>
                <label htmlFor="authValue" className="block text-sm text-dark-300 mb-2">
                  Auth Value (optional)
                </label>
                <input
                  type="password"
                  id="authValue"
                  value={config.authValue || ''}
                  onChange={(e) => updateConfig('authValue', e.target.value)}
                  placeholder="Bearer token..."
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg
                             text-dark-100 placeholder-dark-500
                             focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                />
              </div>
            </div>
          </>
        )}

        {type === 'email' && (
          <div>
            <label htmlFor="email" className="block text-sm text-dark-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={config.email || ''}
              onChange={(e) => updateConfig('email', e.target.value)}
              placeholder="alerts@example.com"
              className={`w-full px-4 py-2.5 bg-dark-700 border rounded-lg
                         text-dark-100 placeholder-dark-500
                         focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                         ${errors.email ? 'border-red-500' : 'border-dark-600'}`}
            />
            {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
          </div>
        )}

        {type === 'action' && (
          <div className="space-y-4">
            {/* Action Selection */}
            <div>
              <label htmlFor="actionId" className="block text-sm text-dark-300 mb-2">
                Select Action to Execute
              </label>

              {actionsLoading ? (
                <div className="p-4 bg-dark-700 border border-dark-600 rounded-lg">
                  <p className="text-sm text-dark-400">Loading actions...</p>
                </div>
              ) : actionsError ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{actionsError}</p>
                  <button
                    type="button"
                    onClick={loadActions}
                    className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Try again
                  </button>
                </div>
              ) : actions.length === 0 ? (
                <div className="p-4 bg-dark-700 border border-dark-600 rounded-lg">
                  <p className="text-sm text-dark-400">No enabled actions found.</p>
                  <p className="text-xs text-dark-500 mt-1">
                    Create an action first at{' '}
                    <a href="/actions/new" className="text-primary-400 hover:underline">
                      /actions/new
                    </a>
                  </p>
                </div>
              ) : (
                <select
                  id="actionId"
                  value={config.actionId || ''}
                  onChange={(e) => {
                    const selectedAction = actions.find((a) => a.id === e.target.value);
                    updateConfig('actionId', e.target.value);
                    if (selectedAction) {
                      updateConfig('actionName', selectedAction.name);
                    }
                  }}
                  className={`w-full px-4 py-2.5 bg-dark-700 border rounded-lg
                             text-dark-100
                             focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                             ${errors.actionId ? 'border-red-500' : 'border-dark-600'}`}
                >
                  <option value="">Select an action...</option>
                  {actions.map((action) => (
                    <option key={action.id} value={action.id}>
                      {action.name} ({action.triggerType})
                    </option>
                  ))}
                </select>
              )}
              {errors.actionId && <p className="mt-1 text-sm text-red-400">{errors.actionId}</p>}
            </div>

            {/* Selected Action Info */}
            {config.actionId && (
              <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-primary-400 text-lg">⚡</span>
                  <div className="flex-1">
                    <p className="text-sm text-primary-300 font-medium">
                      Alert will trigger this action
                    </p>
                    <p className="text-xs text-primary-400/80 mt-1">
                      When the alert fires, the selected action will execute with the alert
                      data passed to <code className="bg-dark-700 px-1 rounded">ctx.triggerData</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pass Alert Data Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="passAlertData"
                checked={config.passAlertData !== 'false'}
                onChange={(e) => updateConfig('passAlertData', e.target.checked ? 'true' : 'false')}
                className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary-500
                           focus:ring-2 focus:ring-primary-500/50"
              />
              <label htmlFor="passAlertData" className="text-sm text-dark-300">
                Pass full alert data to action (recommended)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-dark-300 hover:text-dark-100
                     transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50
                     disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm
                     transition-colors"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
