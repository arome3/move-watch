'use client';

import { useState } from 'react';
import type { LargeTransactionCondition } from '@movewatch/shared';

interface LargeTransactionConfigProps {
  value: LargeTransactionCondition;
  onChange: (condition: LargeTransactionCondition) => void;
  errors?: Record<string, string>;
}

// Common token types on Movement
const TOKEN_PRESETS = [
  { value: '0x1::aptos_coin::AptosCoin', label: 'MOVE (Native)' },
  { value: 'custom', label: 'Custom Token' },
];

// Threshold presets in MOVE
const THRESHOLD_PRESETS = [
  { label: '100 MOVE', octas: '10000000000' },
  { label: '1,000 MOVE', octas: '100000000000' },
  { label: '10,000 MOVE', octas: '1000000000000' },
  { label: '100,000 MOVE', octas: '10000000000000' },
];

export function LargeTransactionConfig({ value, onChange, errors = {} }: LargeTransactionConfigProps) {
  const [newAddress, setNewAddress] = useState('');
  const isCustomToken = !TOKEN_PRESETS.find((t) => t.value === value.tokenType && t.value !== 'custom');

  const addAddress = () => {
    if (newAddress && newAddress.startsWith('0x')) {
      const addresses = value.addresses || [];
      if (!addresses.includes(newAddress)) {
        onChange({ ...value, addresses: [...addresses, newAddress] });
      }
      setNewAddress('');
    }
  };

  const removeAddress = (addr: string) => {
    const addresses = (value.addresses || []).filter((a) => a !== addr);
    onChange({ ...value, addresses: addresses.length > 0 ? addresses : undefined });
  };

  // Convert threshold to MOVE for display
  const thresholdInMove = value.threshold
    ? (BigInt(value.threshold) / BigInt(10 ** 8)).toString()
    : '';

  return (
    <div className="space-y-4">
      <div className="bg-dark-800/50 rounded-lg p-3 border border-dark-700">
        <p className="text-xs text-dark-400">
          Get alerted when high-value transfers occur. Perfect for whale watching, treasury security,
          or monitoring significant market movements.
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
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Threshold Amount <span className="text-red-400">*</span>
        </label>
        <p className="text-xs text-dark-500 mb-2">
          Alert when transfer amount is greater than or equal to this value
        </p>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          {THRESHOLD_PRESETS.map((preset) => (
            <button
              key={preset.octas}
              type="button"
              onClick={() => onChange({ ...value, threshold: preset.octas })}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors
                         ${
                           value.threshold === preset.octas
                             ? 'bg-primary-500/10 border-primary-500 text-primary-400'
                             : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'
                         }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            value={value.threshold}
            onChange={(e) => onChange({ ...value, threshold: e.target.value })}
            placeholder="1000000000"
            className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                     placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                     font-mono text-sm pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark-500">
            octas
          </span>
        </div>
        {thresholdInMove && (
          <p className="mt-1 text-xs text-dark-400">
            = {Number(thresholdInMove).toLocaleString()} MOVE
          </p>
        )}
        {errors.threshold && (
          <p className="mt-1 text-xs text-red-400">{errors.threshold}</p>
        )}
      </div>

      <div className="border-t border-dark-700 pt-4">
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Specific Addresses (Optional)
        </label>
        <p className="text-xs text-dark-500 mb-3">
          Leave empty to monitor all addresses, or add specific addresses to watch
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addAddress();
              }
            }}
            placeholder="0x..."
            className="flex-1 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100
                     placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50
                     font-mono text-sm"
          />
          <button
            type="button"
            onClick={addAddress}
            disabled={!newAddress || !newAddress.startsWith('0x')}
            className="px-4 py-2 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>

        {value.addresses && value.addresses.length > 0 ? (
          <div className="space-y-2">
            {value.addresses.map((addr, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-3 py-2 bg-dark-800/50 rounded-lg border border-dark-700/50"
              >
                <code className="text-xs text-dark-300 font-mono truncate max-w-[240px]">
                  {addr}
                </code>
                <button
                  type="button"
                  onClick={() => removeAddress(addr)}
                  className="text-dark-500 hover:text-red-400 transition-colors ml-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 bg-dark-800/30 rounded-lg border border-dashed border-dark-700">
            <p className="text-xs text-dark-500">
              No specific addresses configured - monitoring all transfers
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
