'use client';

import Link from 'next/link';
import type { ActionListItem } from '@movewatch/shared';
import { ActionCard } from './ActionCard';

interface ActionsListProps {
  actions: ActionListItem[];
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
  isLoading?: boolean;
}

export function ActionsList({
  actions,
  onToggle,
  onDelete,
  isUpdating,
  isDeleting,
  isLoading,
}: ActionsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-dark-800 rounded-lg border border-dark-700 p-4 animate-pulse"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-dark-700 rounded" />
              <div className="flex-1">
                <div className="h-4 bg-dark-700 rounded w-1/3 mb-2" />
                <div className="h-3 bg-dark-700 rounded w-1/2" />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-3 bg-dark-700 rounded w-20" />
              <div className="h-3 bg-dark-700 rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="bg-dark-800 rounded-lg border border-dark-700 p-8 text-center">
        <div className="text-4xl mb-4">🤖</div>
        <h3 className="text-lg font-medium text-dark-200 mb-2">No Actions Yet</h3>
        <p className="text-dark-400 mb-6 max-w-md mx-auto">
          Web3 Actions let you run custom code in response to on-chain events, new blocks, or
          scheduled intervals.
        </p>
        <Link
          href="/alerts-and-actions/actions/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600
                     text-white rounded-lg font-medium text-sm transition-colors"
        >
          <span>+</span>
          Create Your First Action
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actions.map((action) => (
        <ActionCard
          key={action.id}
          action={action}
          onToggle={onToggle}
          onDelete={onDelete}
          isUpdating={isUpdating}
          isDeleting={isDeleting}
        />
      ))}
    </div>
  );
}

export { ActionCard } from './ActionCard';
