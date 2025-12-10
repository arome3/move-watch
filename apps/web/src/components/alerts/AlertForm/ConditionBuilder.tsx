'use client';

import type { AlertCondition, AlertConditionType } from '@movewatch/shared';
import { TxFailedConfig } from './TxFailedConfig';
import { BalanceConfig } from './BalanceConfig';
import { EventConfig } from './EventConfig';
import { GasSpikeConfig } from './GasSpikeConfig';

interface ConditionBuilderProps {
  value: AlertCondition | null;
  onChange: (condition: AlertCondition | null) => void;
  errors?: Record<string, string>;
}

const CONDITION_TYPES: { value: AlertConditionType; label: string; description: string }[] = [
  {
    value: 'tx_failed',
    label: 'Transaction Failed',
    description: 'Alert when transactions fail for a module',
  },
  {
    value: 'balance_threshold',
    label: 'Balance Threshold',
    description: 'Alert when account balance crosses a threshold',
  },
  {
    value: 'event_emitted',
    label: 'Event Emitted',
    description: 'Alert when a specific event is emitted',
  },
  {
    value: 'gas_spike',
    label: 'Gas Spike',
    description: 'Alert when gas usage exceeds normal levels',
  },
];

// Default values for each condition type
const DEFAULT_CONDITIONS: Record<AlertConditionType, AlertCondition> = {
  tx_failed: { type: 'tx_failed', moduleAddress: '' },
  balance_threshold: {
    type: 'balance_threshold',
    address: '',
    tokenType: '0x1::aptos_coin::AptosCoin',
    threshold: '',
    operator: 'lt',
  },
  event_emitted: { type: 'event_emitted', eventType: '' },
  gas_spike: { type: 'gas_spike', moduleAddress: '', thresholdMultiplier: 2 },
};

export function ConditionBuilder({ value, onChange, errors = {} }: ConditionBuilderProps) {
  const handleTypeChange = (type: AlertConditionType | '') => {
    if (!type) {
      onChange(null);
    } else {
      onChange(DEFAULT_CONDITIONS[type]);
    }
  };

  const renderConditionConfig = () => {
    if (!value) return null;

    switch (value.type) {
      case 'tx_failed':
        return (
          <TxFailedConfig
            value={value}
            onChange={onChange}
            errors={errors}
          />
        );
      case 'balance_threshold':
        return (
          <BalanceConfig
            value={value}
            onChange={onChange}
            errors={errors}
          />
        );
      case 'event_emitted':
        return (
          <EventConfig
            value={value}
            onChange={onChange}
            errors={errors}
          />
        );
      case 'gas_spike':
        return (
          <GasSpikeConfig
            value={value}
            onChange={onChange}
            errors={errors}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Condition Type <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CONDITION_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => handleTypeChange(type.value)}
              className={`p-3 text-left rounded-lg border transition-colors
                         ${
                           value?.type === type.value
                             ? 'bg-primary-500/10 border-primary-500 text-primary-400'
                             : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                         }`}
            >
              <p className="font-medium text-sm">{type.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{type.description}</p>
            </button>
          ))}
        </div>
        {errors.condition && (
          <p className="mt-2 text-xs text-red-400">{errors.condition}</p>
        )}
      </div>

      {value && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          {renderConditionConfig()}
        </div>
      )}
    </div>
  );
}
