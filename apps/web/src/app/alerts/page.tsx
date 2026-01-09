'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAlertsStore } from '@/stores/alerts';
import { AlertsList } from '@/components/alerts/AlertsList';

export default function AlertsPage() {
  const router = useRouter();
  const {
    alerts,
    isLoading,
    error,
    fetchAlerts,
    toggleAlert,
    testAlert,
    deleteAlert,
    isUpdating,
    isTesting,
  } = useAlertsStore();

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleCreate = () => {
    router.push('/alerts/new');
  };

  const handleView = (id: string) => {
    router.push(`/alerts/${id}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/alerts/${id}/edit`);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await toggleAlert(id, enabled);
  };

  const handleTest = async (id: string) => {
    await testAlert(id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this alert? This action cannot be undone.')) {
      await deleteAlert(id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Alerts</h1>
          <p className="text-sm text-dark-400 mt-1">
            Monitor on-chain activity and get notified when conditions are met
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
          New Alert
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Alerts List */}
      <AlertsList
        alerts={alerts}
        isLoading={isLoading}
        onView={handleView}
        onEdit={handleEdit}
        onToggle={handleToggle}
        onTest={handleTest}
        onDelete={handleDelete}
        isToggling={isUpdating}
        isTesting={isTesting}
      />
    </div>
  );
}
