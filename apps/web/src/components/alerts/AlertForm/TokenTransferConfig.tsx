'use client';

import type { TokenTransferCondition } from '@movewatch/shared';

interface TokenTransferConfigProps {
  value: TokenTransferCondition;
  onChange: (condition: TokenTransferCondition) => void;
  errors?: Record<string, string>;
}

// Common token types on Movement
const TOKEN_PRESETS = [
  { value: '0x1::aptos_coin::AptosCoin', label: 'MOVE (Native)' },
  { value: 'custom', label: 'Custom Token' },
];

export function TokenTransferConfig({ value, onChange, errors = {} }: TokenTransferConfigProps) {
  const isCustomToken = !TOKEN_PRESETS.find((t) => t.value === value.tokenType && t.value !== 'custom');

  return (
    <div className="space-y-4">
      <div className="bg-dark-800/50 rounded-lg p-3 border border-dark-700">
        <p className="text-xs text-dark-400">
          Monitor token movements to or from a specific address. Track deposits, withdrawals,
          or both. Useful for treasury monitoring, whale watching, or account security.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1.5">
          Token Type <span className="text-red-400">*</span>
        </label>
        <div className="space-y-2">
          <select
            value={isCustomToken ? 'custom' : value.tokenType}
            onChange={(e) => {
              const selected = e.target.value;
              if (selected === 'custom') {
                onChange({ ...value, tokenType: '' });
              } else {
                onChange({ ...value, tokenType: selected });
              }
            }}
            className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                     focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            {TOKEN_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>

          {isCustomToken && (
            <input
              type="text"
              value={value.tokenType}
              onChange={(e) => onChange({ ...value, tokenType: e.target.value })}
              placeholder="0x1::module::TokenType"
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                       placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                       font-mono text-sm"
            />
          )}
        </div>
        {errors.tokenType && (
          <p className="mt-1 text-xs text-red-400">{errors.tokenType}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1.5">
          Address to Monitor <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="0x..."
          className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                   placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                   font-mono text-sm"
        />
        {errors.address && (
          <p className="mt-1 text-xs text-red-400">{errors.address}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Direction <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'in', label: 'Incoming', icon: '↓', desc: 'Deposits only' },
            { value: 'out', label: 'Outgoing', icon: '↑', desc: 'Withdrawals only' },
            { value: 'both', label: 'Both', icon: '↕', desc: 'All transfers' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...value, direction: option.value as 'in' | 'out' | 'both' })}
              className={`p-3 text-center rounded-lg border transition-colors
                         ${
                           value.direction === option.value
                             ? 'bg-primary-500/10 border-primary-500 text-primary-400'
                             : 'bg-dark-800 border-dark-700 text-dark-300 hover:border-dark-600'
                         }`}
            >
              <span className="text-lg">{option.icon}</span>
              <p className="font-medium text-sm mt-1">{option.label}</p>
              <p className="text-xs text-dark-500">{option.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-dark-700 pt-4">
        <p className="text-sm font-medium text-dark-300 mb-3">Amount Filters (Optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-dark-400 mb-1.5">
              Minimum Amount
            </label>
            <div className="relative">
              <input
                type="text"
                value={value.minAmount || ''}
                onChange={(e) => onChange({ ...value, minAmount: e.target.value || undefined })}
                placeholder="0"
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                         placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                         font-mono text-sm pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark-500">
                octas
              </span>
            </div>
            <p className="mt-1 text-xs text-dark-500">
              {value.minAmount ? `${(BigInt(value.minAmount) / BigInt(10 ** 8)).toString()} MOVE` : ''}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-400 mb-1.5">
              Maximum Amount
            </label>
            <div className="relative">
              <input
                type="text"
                value={value.maxAmount || ''}
                onChange={(e) => onChange({ ...value, maxAmount: e.target.value || undefined })}
                placeholder="Unlimited"
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                         placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                         font-mono text-sm pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark-500">
                octas
              </span>
            </div>
            <p className="mt-1 text-xs text-dark-500">
              {value.maxAmount ? `${(BigInt(value.maxAmount) / BigInt(10 ** 8)).toString()} MOVE` : ''}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-dark-500">
          1 MOVE = 100,000,000 octas (10^8)
        </p>
      </div>
    </div>
  );
}
