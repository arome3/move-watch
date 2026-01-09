'use client';

import { useState } from 'react';

interface EventFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function EventFilter({ value, onChange }: EventFilterProps) {
  const [localValue, setLocalValue] = useState(value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange(localValue);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex-1 max-w-xs">
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder="Filter by event type..."
        className="w-full pl-3 pr-8 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-2 flex items-center text-dark-400 hover:text-white"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </form>
  );
}
