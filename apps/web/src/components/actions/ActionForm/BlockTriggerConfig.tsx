'use client';

import { useState, useEffect, useRef } from 'react';
import type { BlockTriggerConfig as BlockTriggerConfigType } from '@movewatch/shared';

interface BlockTriggerConfigProps {
  value: BlockTriggerConfigType | null;
  onChange: (config: BlockTriggerConfigType) => void;
  errors?: Record<string, string>;
}

const INTERVAL_PRESETS = [
  { value: 1, label: 'Every block' },
  { value: 5, label: 'Every 5 blocks' },
  { value: 10, label: 'Every 10 blocks' },
  { value: 50, label: 'Every 50 blocks' },
  { value: 100, label: 'Every 100 blocks' },
  { value: 500, label: 'Every 500 blocks' },
  { value: 1000, label: 'Every 1000 blocks' },
];

export function BlockTriggerConfig({ value, onChange, errors }: BlockTriggerConfigProps) {
  const [interval, setInterval] = useState(value?.interval || 10);
  const [isCustom, setIsCustom] = useState(
    !INTERVAL_PRESETS.some((p) => p.value === value?.interval)
  );

  // Use ref to avoid infinite loops with onChange callback
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (interval > 0) {
      onChangeRef.current({
        type: 'block',
        interval,
      });
    }
  }, [interval]);

  const handlePresetChange = (presetValue: number) => {
    setInterval(presetValue);
    setIsCustom(false);
  };

  const handleCustomChange = (customValue: number) => {
    setInterval(Math.max(1, customValue));
    setIsCustom(true);
  };

  // Estimate block time (Movement averages ~1 block/sec)
  const estimatedSeconds = interval;
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `~${seconds} seconds`;
    if (seconds < 3600) return `~${Math.round(seconds / 60)} minutes`;
    if (seconds < 86400) return `~${Math.round(seconds / 3600)} hours`;
    return `~${Math.round(seconds / 86400)} days`;
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Block Interval <span className="text-red-400">*</span>
        </label>

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          {INTERVAL_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePresetChange(preset.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors
                         ${
                           interval === preset.value && !isCustom
                             ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                             : 'bg-dark-900 border-dark-700 text-dark-400 hover:border-dark-600'
                         }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsCustom(true)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors
                       ${
                         isCustom
                           ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                           : 'bg-dark-900 border-dark-700 text-dark-400 hover:border-dark-600'
                       }`}
          >
            Custom
          </button>
        </div>

        {/* Custom input */}
        {isCustom && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-dark-400">Every</span>
            <input
              type="number"
              min={1}
              max={100000}
              value={interval}
              onChange={(e) => handleCustomChange(parseInt(e.target.value) || 1)}
              className={`w-24 bg-dark-900 border rounded-lg px-3 py-2 text-sm
                         text-dark-100 text-center
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-colors
                         ${errors?.interval ? 'border-red-500' : 'border-dark-700'}`}
            />
            <span className="text-sm text-dark-400">blocks</span>
          </div>
        )}

        {errors?.interval && (
          <p className="mt-1 text-xs text-red-400">{errors.interval}</p>
        )}
      </div>

      {/* Estimated frequency */}
      <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">Estimated frequency:</span>
          <span className="text-sm text-dark-300 font-medium">{formatDuration(estimatedSeconds)}</span>
        </div>
        <p className="mt-1 text-xs text-dark-500">
          Based on Movement Network&apos;s average block time (~1 second)
        </p>
      </div>

      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <p className="text-xs text-amber-400">
          <strong>Note:</strong> Lower intervals will trigger your action more frequently.
          Consider your cooldown setting and rate limits when configuring block triggers.
        </p>
      </div>
    </div>
  );
}
