'use client';

type Status = 'all' | 'success' | 'failed';

interface StatusFilterProps {
  value: Status;
  onChange: (status: Status) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1">
      <button
        onClick={() => onChange('all')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          value === 'all'
            ? 'bg-dark-700 text-white'
            : 'text-dark-400 hover:text-white'
        }`}
      >
        All
      </button>
      <button
        onClick={() => onChange('success')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          value === 'success'
            ? 'bg-green-500/20 text-green-400'
            : 'text-dark-400 hover:text-green-400'
        }`}
      >
        Success
      </button>
      <button
        onClick={() => onChange('failed')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          value === 'failed'
            ? 'bg-red-500/20 text-red-400'
            : 'text-dark-400 hover:text-red-400'
        }`}
      >
        Failed
      </button>
    </div>
  );
}
