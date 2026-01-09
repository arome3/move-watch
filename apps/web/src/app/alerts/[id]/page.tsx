'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAlertsStore } from '@/stores/alerts';
import { AlertDetail } from '@/components/alerts/AlertDetail';

export default function AlertDetailPage() {
  const router = useRouter();
  const params = useParams();
  const alertId = params.id as string;
  const [triggersOffset, setTriggersOffset] = useState(0);
  const TRIGGERS_LIMIT = 10;

  const {
    selectedAlert,
    triggers,
    isLoading,
    isUpdating,
    isTesting,
    error,
    fetchAlert,
    fetchTriggers,
    toggleAlert,
    testAlert,
    deleteAlert,
  } = useAlertsStore();

  useEffect(() => {
    if (alertId) {
      fetchAlert(alertId);
      fetchTriggers(alertId, TRIGGERS_LIMIT, 0);
    }
  }, [alertId, fetchAlert, fetchTriggers]);

  const handleToggle = async () => {
    if (selectedAlert) {
      await toggleAlert(alertId, !selectedAlert.enabled);
    }
  };

  const handleTest = async () => {
    await testAlert(alertId);
  };

  const handleEdit = () => {
    router.push(`/alerts/${alertId}/edit`);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this alert? This action cannot be undone.')) {
      const success = await deleteAlert(alertId);
      if (success) {
        router.push('/alerts');
      }
    }
  };

  const handleLoadMoreTriggers = useCallback(async () => {
    const newOffset = triggersOffset + TRIGGERS_LIMIT;
    await fetchTriggers(alertId, TRIGGERS_LIMIT, newOffset);
    setTriggersOffset(newOffset);
  }, [alertId, triggersOffset, fetchTriggers]);

  if (isLoading && !selectedAlert) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-dark-800 rounded w-1/3" />
          <div className="h-4 bg-dark-800 rounded w-1/2" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-dark-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">:(</div>
          <h2 className="text-xl font-semibold text-dark-200 mb-2">Failed to load alert</h2>
          <p className="text-dark-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/alerts')}
            className="text-primary-400 hover:text-primary-300"
          >
            Back to alerts
          </button>
        </div>
      </div>
    );
  }

  if (!selectedAlert) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">?</div>
          <h2 className="text-xl font-semibold text-dark-200 mb-2">Alert not found</h2>
          <p className="text-dark-400 mb-6">This alert may have been deleted.</p>
          <button
            onClick={() => router.push('/alerts')}
            className="text-primary-400 hover:text-primary-300"
          >
            Back to alerts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <button
        onClick={() => router.push('/alerts')}
        className="text-sm text-dark-400 hover:text-dark-300 mb-6 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Alerts
      </button>

      <AlertDetail
        alert={selectedAlert}
        triggers={triggers?.triggers || []}
        totalTriggers={triggers?.total || 0}
        isLoadingTriggers={isLoading}
        onToggle={handleToggle}
        onTest={handleTest}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onLoadMoreTriggers={handleLoadMoreTriggers}
        isToggling={isUpdating}
        isTesting={isTesting}
      />
    </div>
  );
}
