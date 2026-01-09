'use client';

import type { AlertResponse, AlertTriggerResponse } from '@movewatch/shared';
import { ChannelStatus } from './ChannelStatus';
import { TriggerHistory } from './TriggerHistory';
import { AlertStatusBadge } from '../AlertsList/AlertStatusBadge';
import { AlertTypeIcon, getConditionTypeLabel, getConditionTypeColor } from '../AlertsList/AlertTypeIcon';

interface AlertDetailProps {
  alert: AlertResponse;
  triggers: AlertTriggerResponse[];
  totalTriggers: number;
  isLoadingTriggers: boolean;
  onToggle: () => void;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLoadMoreTriggers: () => void;
  isToggling: boolean;
  isTesting: boolean;
}

export function AlertDetail({
  alert,
  triggers,
  totalTriggers,
  isLoadingTriggers,
  onToggle,
  onTest,
  onEdit,
  onDelete,
  onLoadMoreTriggers,
  isToggling,
  isTesting,
}: AlertDetailProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCooldown = (seconds: number) => {
    if (seconds === 0) return 'None';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const getConditionSummary = (): string => {
    const config = alert.conditionConfig;
    switch (config.type) {
      case 'tx_failed':
        return config.functionName
          ? `${config.moduleAddress}::${config.functionName}`
          : config.moduleAddress;
      case 'balance_threshold':
        const opSymbol = { gt: '>', lt: '<', eq: '=', gte: '≥', lte: '≤' }[config.operator];
        return `${config.address.slice(0, 8)}... ${opSymbol} ${config.threshold}`;
      case 'event_emitted':
        return config.eventType;
      case 'gas_spike':
        return `${config.moduleAddress} > ${config.thresholdMultiplier}x avg`;
      default:
        return 'Unknown condition';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getConditionTypeColor(alert.conditionType)}`}>
            <AlertTypeIcon type={alert.conditionType} className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-dark-100">{alert.name}</h1>
              <AlertStatusBadge enabled={alert.enabled} />
            </div>
            <p className="text-sm text-dark-500 mt-0.5">
              {getConditionTypeLabel(alert.conditionType)} • {alert.network}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onTest}
            disabled={isTesting}
            className="px-3 py-1.5 text-sm text-dark-400 hover:text-dark-300
                       border border-dark-700 rounded-lg hover:bg-dark-800
                       transition-colors disabled:opacity-50"
          >
            {isTesting ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={onToggle}
            disabled={isToggling}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 ${
              alert.enabled
                ? 'text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/10'
                : 'text-green-400 border border-green-500/30 hover:bg-green-500/10'
            }`}
          >
            {isToggling ? '...' : alert.enabled ? 'Pause' : 'Enable'}
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-sm text-primary-400 border border-primary-500/30
                       rounded-lg hover:bg-primary-500/10 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-sm text-red-400 border border-red-500/30
                       rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700">
          <p className="text-xs text-dark-500 uppercase tracking-wide">Total Triggers</p>
          <p className="text-2xl font-semibold text-dark-100 mt-1">{alert.triggerCount}</p>
        </div>
        <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700">
          <p className="text-xs text-dark-500 uppercase tracking-wide">Last Triggered</p>
          <p className="text-sm font-medium text-dark-100 mt-2">
            {formatDate(alert.lastTriggeredAt)}
          </p>
        </div>
        <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700">
          <p className="text-xs text-dark-500 uppercase tracking-wide">Cooldown</p>
          <p className="text-2xl font-semibold text-dark-100 mt-1">
            {formatCooldown(alert.cooldownSeconds)}
          </p>
        </div>
        <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700">
          <p className="text-xs text-dark-500 uppercase tracking-wide">Created</p>
          <p className="text-sm font-medium text-dark-100 mt-2">
            {formatDate(alert.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Condition Details */}
        <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
          <h3 className="text-sm font-medium text-dark-300 mb-4">Condition</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-dark-500">Type</p>
              <p className="text-sm font-medium text-dark-200 mt-0.5">
                {getConditionTypeLabel(alert.conditionType)}
              </p>
            </div>
            <div>
              <p className="text-xs text-dark-500">Configuration</p>
              <p className="text-sm font-mono text-dark-200 mt-0.5 break-all">
                {getConditionSummary()}
              </p>
            </div>
            <div className="pt-2">
              <pre className="text-xs font-mono text-dark-400 bg-dark-900 p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(alert.conditionConfig, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Notification Channels */}
        <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
          <h3 className="text-sm font-medium text-dark-300 mb-4">
            Notification Channels ({alert.channels.length})
          </h3>
          <ChannelStatus channels={alert.channels} />
        </div>
      </div>

      {/* Trigger History */}
      <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
        <h3 className="text-sm font-medium text-dark-300 mb-4">Trigger History</h3>
        <TriggerHistory
          triggers={triggers}
          total={totalTriggers}
          isLoading={isLoadingTriggers}
          onLoadMore={onLoadMoreTriggers}
          hasMore={triggers.length < totalTriggers}
        />
      </div>
    </div>
  );
}

// Re-export sub-components
export { ChannelStatus } from './ChannelStatus';
export { TriggerHistory } from './TriggerHistory';
