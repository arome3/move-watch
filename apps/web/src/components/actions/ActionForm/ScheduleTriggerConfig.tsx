'use client';

import { useState, useEffect, useRef } from 'react';
import type { ScheduleTriggerConfig as ScheduleTriggerConfigType } from '@movewatch/shared';

interface ScheduleTriggerConfigProps {
  value: ScheduleTriggerConfigType | null;
  onChange: (config: ScheduleTriggerConfigType) => void;
  errors?: Record<string, string>;
}

const CRON_PRESETS = [
  { value: '* * * * *', label: 'Every minute', description: 'Runs every minute' },
  { value: '*/5 * * * *', label: 'Every 5 minutes', description: 'Runs every 5 minutes' },
  { value: '*/15 * * * *', label: 'Every 15 minutes', description: 'Runs every 15 minutes' },
  { value: '0 * * * *', label: 'Every hour', description: 'At minute 0' },
  { value: '0 */6 * * *', label: 'Every 6 hours', description: 'At minute 0 past every 6th hour' },
  { value: '0 0 * * *', label: 'Daily', description: 'At midnight' },
  { value: '0 0 * * 1', label: 'Weekly', description: 'At midnight on Monday' },
  { value: '0 0 1 * *', label: 'Monthly', description: 'At midnight on the 1st' },
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Singapore', label: 'Singapore' },
];

export function ScheduleTriggerConfig({ value, onChange, errors }: ScheduleTriggerConfigProps) {
  const [cron, setCron] = useState(value?.cron || '0 * * * *');
  const [timezone, setTimezone] = useState(value?.timezone || 'UTC');
  const [isCustom, setIsCustom] = useState(
    !CRON_PRESETS.some((p) => p.value === value?.cron)
  );

  // Use ref to avoid infinite loops with onChange callback
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (cron) {
      onChangeRef.current({
        type: 'schedule',
        cron,
        timezone,
      });
    }
  }, [cron, timezone]);

  const handlePresetChange = (presetValue: string) => {
    setCron(presetValue);
    setIsCustom(false);
  };

  // Basic cron description
  const describeCron = (expression: string): string => {
    const preset = CRON_PRESETS.find((p) => p.value === expression);
    if (preset) return preset.description;

    const parts = expression.split(' ');
    if (parts.length !== 5) return 'Invalid cron expression';

    const [minute, hour] = parts;
    if (minute.startsWith('*/')) return `Every ${minute.slice(2)} minutes`;
    if (hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`;
    return expression;
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Schedule <span className="text-red-400">*</span>
        </label>

        {/* Preset buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {CRON_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePresetChange(preset.value)}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors text-left
                         ${
                           cron === preset.value && !isCustom
                             ? 'bg-primary-500/20 border-primary-500'
                             : 'bg-dark-900 border-dark-700 hover:border-dark-600'
                         }`}
            >
              <div
                className={`font-medium ${
                  cron === preset.value && !isCustom ? 'text-primary-400' : 'text-dark-300'
                }`}
              >
                {preset.label}
              </div>
              <div className="text-xs text-dark-500 mt-0.5">{preset.description}</div>
            </button>
          ))}
        </div>

        {/* Custom cron input */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCustom(!isCustom)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors
                       ${
                         isCustom
                           ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                           : 'bg-dark-900 border-dark-700 text-dark-400 hover:border-dark-600'
                       }`}
          >
            Custom
          </button>
          {isCustom && (
            <input
              type="text"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="* * * * *"
              className={`flex-1 bg-dark-900 border rounded-lg px-3 py-2 text-sm
                         text-dark-100 placeholder:text-dark-600 font-mono
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-colors
                         ${errors?.cron ? 'border-red-500' : 'border-dark-700'}`}
            />
          )}
        </div>

        {errors?.cron && <p className="mt-1 text-xs text-red-400">{errors.cron}</p>}
      </div>

      {/* Timezone selector */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                     text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500
                     focus:border-transparent transition-colors"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      {/* Cron description */}
      <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">Schedule description:</span>
          <span className="text-sm text-dark-300 font-medium">{describeCron(cron)}</span>
        </div>
        <p className="mt-1 text-xs text-dark-500 font-mono">{cron}</p>
      </div>

      {/* Cron help */}
      <details className="text-sm">
        <summary className="text-dark-400 cursor-pointer hover:text-dark-300">
          Cron expression help
        </summary>
        <div className="mt-2 p-3 bg-dark-900 rounded-lg border border-dark-700 space-y-2">
          <p className="text-dark-400 text-xs">
            Format: <code className="text-primary-400">minute hour day-of-month month day-of-week</code>
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-dark-500">
                <th className="text-left py-1">Field</th>
                <th className="text-left py-1">Range</th>
                <th className="text-left py-1">Special</th>
              </tr>
            </thead>
            <tbody className="text-dark-400">
              <tr>
                <td className="py-1">Minute</td>
                <td>0-59</td>
                <td>* , - /</td>
              </tr>
              <tr>
                <td className="py-1">Hour</td>
                <td>0-23</td>
                <td>* , - /</td>
              </tr>
              <tr>
                <td className="py-1">Day of month</td>
                <td>1-31</td>
                <td>* , - /</td>
              </tr>
              <tr>
                <td className="py-1">Month</td>
                <td>1-12</td>
                <td>* , - /</td>
              </tr>
              <tr>
                <td className="py-1">Day of week</td>
                <td>0-6 (Sun=0)</td>
                <td>* , - /</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
