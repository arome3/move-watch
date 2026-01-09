'use client';

import type { AlertConditionType } from '@movewatch/shared';

interface AlertTypeIconProps {
  type: AlertConditionType;
  className?: string;
}

export function AlertTypeIcon({ type, className = 'w-5 h-5' }: AlertTypeIconProps) {
  const iconProps = {
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (type) {
    case 'tx_failed':
      // X circle icon
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6" />
          <path d="M9 9l6 6" />
        </svg>
      );

    case 'balance_threshold':
      // Wallet/coins icon
      return (
        <svg {...iconProps}>
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 1 0 0 4h4v-4h-4z" />
        </svg>
      );

    case 'event_emitted':
      // Bell/notification icon
      return (
        <svg {...iconProps}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );

    case 'gas_spike':
      // Flame/fire icon
      return (
        <svg {...iconProps}>
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      );

    case 'function_call':
      // Code/function icon
      return (
        <svg {...iconProps}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );

    case 'token_transfer':
      // Arrow transfer icon
      return (
        <svg {...iconProps}>
          <path d="M17 1l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 23l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );

    case 'large_transaction':
      // Large coin/diamond icon
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v12" />
          <path d="M6 10h12" />
          <path d="M6 14h12" />
        </svg>
      );

    default:
      // Generic alert icon
      return (
        <svg {...iconProps}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
  }
}

export function getConditionLabel(type: AlertConditionType): string {
  const labels: Record<AlertConditionType, string> = {
    tx_failed: 'Transaction Failed',
    balance_threshold: 'Balance Threshold',
    event_emitted: 'Event Emitted',
    gas_spike: 'Gas Spike',
    function_call: 'Function Call',
    token_transfer: 'Token Transfer',
    large_transaction: 'Large Transaction',
  };
  return labels[type] || type;
}

export function getConditionColor(type: AlertConditionType): string {
  const colors: Record<AlertConditionType, string> = {
    tx_failed: 'text-red-400',
    balance_threshold: 'text-amber-400',
    event_emitted: 'text-green-400',
    gas_spike: 'text-purple-400',
    function_call: 'text-cyan-400',
    token_transfer: 'text-blue-400',
    large_transaction: 'text-gold-400',
  };
  return colors[type] || 'text-dark-400';
}

// Aliases for backward compatibility
export const getConditionTypeLabel = getConditionLabel;
export const getConditionTypeColor = getConditionColor;
