'use client';

interface AlertStatusBadgeProps {
  enabled: boolean;
  size?: 'sm' | 'md';
}

export function AlertStatusBadge({ enabled, size = 'md' }: AlertStatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses}
                 ${
                   enabled
                     ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                     : 'bg-dark-500/10 text-dark-400 border border-dark-500/20'
                 }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-green-400' : 'bg-dark-400'}`}
      />
      {enabled ? 'Active' : 'Paused'}
    </span>
  );
}
