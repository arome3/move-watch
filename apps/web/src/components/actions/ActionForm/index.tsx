'use client';

import dynamic from 'next/dynamic';
import type { Network, ActionTriggerType, TriggerConfig } from '@movewatch/shared';
import { TriggerBuilder } from './TriggerBuilder';
import { SDKDocPanel } from './SDKDocPanel';

// Dynamically import Monaco editor to avoid SSR issues
const ActionEditor = dynamic(
  () => import('../ActionEditor').then((mod) => mod.ActionEditor),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg overflow-hidden border border-dark-700">
        <div className="bg-dark-800 px-4 py-2 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-dark-400">handler.ts</span>
            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
              TypeScript
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center h-[400px] bg-dark-900">
          <div className="text-dark-400 text-sm">Loading editor...</div>
        </div>
      </div>
    ),
  }
);

interface ActionFormProps {
  // Form state
  name: string;
  description: string;
  code: string;
  network: Network;
  triggerType: ActionTriggerType;
  triggerConfig: TriggerConfig | null;
  maxExecutionMs: number;
  memoryLimitMb: number;
  cooldownSeconds: number;
  errors: Record<string, string>;

  // Callbacks
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onCodeChange: (code: string) => void;
  onNetworkChange: (network: Network) => void;
  onTriggerTypeChange: (type: ActionTriggerType) => void;
  onTriggerConfigChange: (config: TriggerConfig | null) => void;
  onMaxExecutionMsChange: (ms: number) => void;
  onMemoryLimitMbChange: (mb: number) => void;
  onCooldownSecondsChange: (seconds: number) => void;
  onSubmit: () => void;
  onCancel: () => void;

  // UI state
  isSubmitting: boolean;
  submitLabel?: string;
  actionId?: string; // For webhook URL display in edit mode
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
];

const TIMEOUT_OPTIONS = [
  { value: 5000, label: '5 seconds' },
  { value: 10000, label: '10 seconds' },
  { value: 30000, label: '30 seconds' },
  { value: 60000, label: '60 seconds' },
];

const MEMORY_OPTIONS = [
  { value: 32, label: '32 MB' },
  { value: 64, label: '64 MB' },
  { value: 128, label: '128 MB' },
  { value: 256, label: '256 MB' },
  { value: 512, label: '512 MB' },
];

export function ActionForm({
  name,
  description,
  code,
  network,
  triggerType,
  triggerConfig,
  maxExecutionMs,
  memoryLimitMb,
  cooldownSeconds,
  errors,
  onNameChange,
  onDescriptionChange,
  onCodeChange,
  onNetworkChange,
  onTriggerTypeChange,
  onTriggerConfigChange,
  onMaxExecutionMsChange,
  onMemoryLimitMbChange,
  onCooldownSecondsChange,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel = 'Create Action',
  actionId,
}: ActionFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
        <h3 className="text-sm font-medium text-dark-300 mb-4">Basic Information</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Action Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g., Monitor Large Transfers"
              className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm
                         text-dark-100 placeholder:text-dark-600
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-colors
                         ${errors.name ? 'border-red-500' : 'border-dark-700'}`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What does this action do?"
              rows={2}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                         text-dark-100 placeholder:text-dark-600
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Network</label>
            <select
              value={network}
              onChange={(e) => onNetworkChange(e.target.value as Network)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                         text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500
                         focus:border-transparent transition-colors"
            >
              {NETWORKS.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Trigger */}
      <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
        <h3 className="text-sm font-medium text-dark-300 mb-4">Trigger</h3>
        <TriggerBuilder
          triggerType={triggerType}
          triggerConfig={triggerConfig}
          onTypeChange={onTriggerTypeChange}
          onConfigChange={onTriggerConfigChange}
          actionId={actionId}
          errors={errors}
        />
      </div>

      {/* Code Editor */}
      <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
        <h3 className="text-sm font-medium text-dark-300 mb-4">
          Handler Code <span className="text-red-400">*</span>
        </h3>

        <ActionEditor value={code} onChange={onCodeChange} height="400px" />

        {errors.code && <p className="mt-2 text-xs text-red-400">{errors.code}</p>}

        {/* Quick reference chips */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-dark-700 rounded text-dark-400">
            ctx.triggerData
          </span>
          <span className="px-2 py-1 bg-dark-700 rounded text-dark-400">
            ctx.secrets
          </span>
          <span className="px-2 py-1 bg-dark-700 rounded text-dark-400">
            ctx.movement
          </span>
          <span className="px-2 py-1 bg-dark-700 rounded text-dark-400">
            ctx.kv
          </span>
          <span className="px-2 py-1 bg-dark-700 rounded text-dark-400">
            ctx.helpers
          </span>
          <span className="px-2 py-1 bg-dark-700 rounded text-dark-400">
            fetch()
          </span>
        </div>

        {/* Full SDK Documentation Panel */}
        <SDKDocPanel />
      </div>

      {/* Advanced Options */}
      <details className="bg-dark-800 rounded-lg border border-dark-700">
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-dark-300 hover:text-dark-200">
          Advanced Options
        </summary>
        <div className="px-4 pb-4 pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Timeout
              </label>
              <select
                value={maxExecutionMs}
                onChange={(e) => onMaxExecutionMsChange(parseInt(e.target.value))}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                           text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500
                           focus:border-transparent transition-colors"
              >
                {TIMEOUT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-dark-500">Max execution time</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Memory Limit
              </label>
              <select
                value={memoryLimitMb}
                onChange={(e) => onMemoryLimitMbChange(parseInt(e.target.value))}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                           text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500
                           focus:border-transparent transition-colors"
              >
                {MEMORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-dark-500">Max heap size</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Cooldown
              </label>
              <select
                value={cooldownSeconds}
                onChange={(e) => onCooldownSecondsChange(parseInt(e.target.value))}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                           text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500
                           focus:border-transparent transition-colors"
              >
                {COOLDOWN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-dark-500">Min time between runs</p>
            </div>
          </div>
        </div>
      </details>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-dark-400 hover:text-dark-300
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
export { TriggerBuilder } from './TriggerBuilder';
export { EventTriggerConfig } from './EventTriggerConfig';
export { BlockTriggerConfig } from './BlockTriggerConfig';
export { ScheduleTriggerConfig } from './ScheduleTriggerConfig';
export { WebhookTriggerConfig } from './WebhookTriggerConfig';
export { SDKDocPanel } from './SDKDocPanel';
