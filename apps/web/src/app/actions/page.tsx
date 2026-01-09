'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActionsStore } from '@/stores/actions';
import { ActionsList } from '@/components/actions/ActionsList';

export default function ActionsPage() {
  const router = useRouter();
  const {
    actions,
    isLoading,
    error,
    fetchActions,
    toggleAction,
    deleteAction,
    isUpdating,
    isDeleting,
    clearError,
  } = useActionsStore();

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleCreate = () => {
    router.push('/actions/new');
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await toggleAction(id, enabled);
  };

  const handleDelete = async (id: string) => {
    await deleteAction(id);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Web3 Actions</h1>
          <p className="text-sm text-dark-400 mt-1">
            Serverless functions that run in response to on-chain events, blocks, or schedules
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white
                     rounded-lg font-medium text-sm transition-colors
                     flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Action
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Summary */}
      {actions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
            <div className="text-2xl font-bold text-dark-100">{actions.length}</div>
            <div className="text-sm text-dark-400">Total Actions</div>
          </div>
          <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
            <div className="text-2xl font-bold text-green-400">
              {actions.filter((a) => a.enabled).length}
            </div>
            <div className="text-sm text-dark-400">Active</div>
          </div>
          <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
            <div className="text-2xl font-bold text-dark-100">
              {actions.reduce((sum, a) => sum + a.executionCount, 0)}
            </div>
            <div className="text-sm text-dark-400">Total Executions</div>
          </div>
          <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
            <div className="text-2xl font-bold text-primary-400">
              {(() => {
                const total = actions.reduce((sum, a) => sum + a.executionCount, 0);
                const success = actions.reduce((sum, a) => sum + a.successCount, 0);
                return total > 0 ? `${Math.round((success / total) * 100)}%` : 'N/A';
              })()}
            </div>
            <div className="text-sm text-dark-400">Success Rate</div>
          </div>
        </div>
      )}

      {/* Actions List */}
      <ActionsList
        actions={actions}
        isLoading={isLoading}
        onToggle={handleToggle}
        onDelete={handleDelete}
        isUpdating={isUpdating}
        isDeleting={isDeleting}
      />
    </div>
  );
}
