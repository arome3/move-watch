'use client';

import type { Network, AlertCondition, ChannelConfig as ChannelConfigType } from '@movewatch/shared';
import { ConditionBuilder } from './ConditionBuilder';
import { ChannelConfig } from './ChannelConfig';
import { ChannelList } from './ChannelList';

interface AlertFormProps {
  // Form state
  name: string;
  network: Network;
  condition: AlertCondition | null;
  channels: ChannelConfigType[];
  cooldown: number;
  errors: Record<string, string>;

  // Callbacks
  onNameChange: (name: string) => void;
  onNetworkChange: (network: Network) => void;
  onConditionChange: (condition: AlertCondition | null) => void;
  onAddChannel: (channel: ChannelConfigType) => void;
  onRemoveChannel: (index: number) => void;
  onCooldownChange: (seconds: number) => void;
  onSubmit: () => void;
  onCancel: () => void;

  // UI state
  isSubmitting: boolean;
  submitLabel?: string;
}

const NETWORKS: { value: Network; label: string }[] = [
  { value: 'mainnet', label: 'Mainnet' },
  { value: 'testnet', label: 'Testnet' },
  { value: 'devnet', label: 'Devnet' },
];

const COOLDOWN_OPTIONS = [
  { value: 0, label: 'No cooldown' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 86400, label: '24 hours' },
];

export function AlertForm({
  name,
  network,
  condition,
  channels,
  cooldown,
  errors,
  onNameChange,
  onNetworkChange,
  onConditionChange,
  onAddChannel,
  onRemoveChannel,
  onCooldownChange,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel = 'Create Alert',
}: AlertFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Basic Information</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Alert Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g., Failed Transfers"
              className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm
                         text-slate-100 placeholder:text-slate-600
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-colors
                         ${errors.name ? 'border-red-500' : 'border-slate-700'}`}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Network
              </label>
              <select
                value={network}
                onChange={(e) => onNetworkChange(e.target.value as Network)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm
                           text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500
                           focus:border-transparent transition-colors"
              >
                {NETWORKS.map((n) => (
                  <option key={n.value} value={n.value}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Cooldown
              </label>
              <select
                value={cooldown}
                onChange={(e) => onCooldownChange(parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm
                           text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500
                           focus:border-transparent transition-colors"
              >
                {COOLDOWN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Minimum time between notifications
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Condition */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Condition</h3>
        <ConditionBuilder
          value={condition}
          onChange={onConditionChange}
          errors={errors}
        />
      </div>

      {/* Notification Channels */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-4">
          Notification Channels <span className="text-red-400">*</span>
        </h3>

        <div className="space-y-4">
          <ChannelList channels={channels} onRemove={onRemoveChannel} />

          {errors.channels && (
            <p className="text-xs text-red-400">{errors.channels}</p>
          )}

          {channels.length < 5 && (
            <div className="pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400 mb-3">Add a channel:</p>
              <ChannelConfig
                onAdd={onAddChannel}
                existingTypes={channels.map((c) => c.type)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-300
                     transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white
                     rounded-lg font-medium text-sm transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

// Re-export sub-components
export { ConditionBuilder } from './ConditionBuilder';
export { ChannelConfig } from './ChannelConfig';
export { ChannelList } from './ChannelList';
export { TxFailedConfig } from './TxFailedConfig';
export { BalanceConfig } from './BalanceConfig';
export { EventConfig } from './EventConfig';
export { GasSpikeConfig } from './GasSpikeConfig';
