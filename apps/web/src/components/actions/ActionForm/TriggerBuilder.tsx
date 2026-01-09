'use client';

import { useCallback } from 'react';
import type { ActionTriggerType, TriggerConfig, EventTriggerConfig as EventTriggerConfigType, BlockTriggerConfig as BlockTriggerConfigType, ScheduleTriggerConfig as ScheduleTriggerConfigType, WebhookTriggerConfig as WebhookTriggerConfigType } from '@movewatch/shared';
import { EventTriggerConfig } from './EventTriggerConfig';
import { BlockTriggerConfig } from './BlockTriggerConfig';
import { ScheduleTriggerConfig } from './ScheduleTriggerConfig';
import { WebhookTriggerConfig } from './WebhookTriggerConfig';

interface TriggerBuilderProps {
  triggerType: ActionTriggerType;
  triggerConfig: TriggerConfig | null;
  onTypeChange: (type: ActionTriggerType) => void;
  onConfigChange: (config: TriggerConfig | null) => void;
  actionId?: string; // For webhook URL display
  errors?: Record<string, string>;
}

const TRIGGER_TYPES: {
  value: ActionTriggerType;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: 'event',
    label: 'On-Chain Event',
    description: 'Trigger when a specific event is emitted',
    icon: '⚡',
  },
  {
    value: 'block',
    label: 'Block Interval',
    description: 'Trigger every N blocks',
    icon: '📦',
  },
  {
    value: 'schedule',
    label: 'Time Schedule',
    description: 'Trigger on a cron schedule',
    icon: '🕐',
  },
  {
    value: 'webhook',
    label: 'HTTP Webhook',
    description: 'Trigger via external HTTP request',
    icon: '🔗',
  },
];

export function TriggerBuilder({
  triggerType,
  triggerConfig,
  onTypeChange,
  onConfigChange,
  actionId,
  errors,
}: TriggerBuilderProps) {
  // Memoize callbacks to prevent infinite loops in child useEffects
  const handleEventChange = useCallback((config: EventTriggerConfigType) => {
    onConfigChange(config);
  }, [onConfigChange]);

  const handleBlockChange = useCallback((config: BlockTriggerConfigType) => {
    onConfigChange(config);
  }, [onConfigChange]);

  const handleScheduleChange = useCallback((config: ScheduleTriggerConfigType) => {
    onConfigChange(config);
  }, [onConfigChange]);

  const handleWebhookChange = useCallback((config: WebhookTriggerConfigType) => {
    onConfigChange(config);
  }, [onConfigChange]);

  return (
    <div className="space-y-4">
      {/* Trigger Type Selection */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-3">
          Trigger Type <span className="text-red-400">*</span>
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TRIGGER_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => {
                onTypeChange(type.value);
                onConfigChange(null);
              }}
              className={`p-4 rounded-lg border text-left transition-colors
                         ${
                           triggerType === type.value
                             ? 'bg-primary-500/10 border-primary-500'
                             : 'bg-dark-900 border-dark-700 hover:border-dark-600'
                         }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{type.icon}</span>
                <span
                  className={`font-medium ${
                    triggerType === type.value ? 'text-primary-400' : 'text-dark-300'
                  }`}
                >
                  {type.label}
                </span>
              </div>
              <p className="text-xs text-dark-500">{type.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Trigger Configuration */}
      <div className="pt-4 border-t border-dark-700">
        <label className="block text-sm font-medium text-dark-300 mb-3">
          Trigger Configuration
        </label>

        {triggerType === 'event' && (
          <EventTriggerConfig
            value={triggerConfig?.type === 'event' ? triggerConfig : null}
            onChange={handleEventChange}
            errors={errors}
          />
        )}

        {triggerType === 'block' && (
          <BlockTriggerConfig
            value={triggerConfig?.type === 'block' ? triggerConfig : null}
            onChange={handleBlockChange}
            errors={errors}
          />
        )}

        {triggerType === 'schedule' && (
          <ScheduleTriggerConfig
            value={triggerConfig?.type === 'schedule' ? triggerConfig : null}
            onChange={handleScheduleChange}
            errors={errors}
          />
        )}

        {triggerType === 'webhook' && (
          <WebhookTriggerConfig
            value={triggerConfig?.type === 'webhook' ? triggerConfig : null}
            onChange={handleWebhookChange}
            actionId={actionId}
            errors={errors}
          />
        )}
      </div>

      {errors?.trigger && (
        <p className="text-xs text-red-400">{errors.trigger}</p>
      )}
    </div>
  );
}
