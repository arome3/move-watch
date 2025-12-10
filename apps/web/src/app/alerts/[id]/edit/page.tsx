'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAlertsStore } from '@/stores/alerts';
import { AlertForm } from '@/components/alerts/AlertForm';

export default function EditAlertPage() {
  const router = useRouter();
  const params = useParams();
  const alertId = params.id as string;
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    selectedAlert,
    formName,
    formNetwork,
    formCondition,
    formChannels,
    formCooldown,
    formErrors,
    isLoading,
    isUpdating,
    error,
    fetchAlert,
    setFormName,
    setFormNetwork,
    setFormCondition,
    addChannel,
    removeChannel,
    setFormCooldown,
    updateAlert,
    loadAlertToForm,
    resetForm,
  } = useAlertsStore();

  // Fetch alert and load to form
  useEffect(() => {
    if (alertId) {
      fetchAlert(alertId);
    }
    return () => resetForm();
  }, [alertId, fetchAlert, resetForm]);

  // Load alert data into form once fetched
  useEffect(() => {
    if (selectedAlert && !isInitialized) {
      loadAlertToForm(selectedAlert);
      setIsInitialized(true);
    }
  }, [selectedAlert, isInitialized, loadAlertToForm]);

  const handleSubmit = async () => {
    const alert = await updateAlert(alertId);
    if (alert) {
      router.push(`/alerts/${alertId}`);
    }
  };

  const handleCancel = () => {
    router.push(`/alerts/${alertId}`);
  };

  if (isLoading && !selectedAlert) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-800 rounded w-1/3" />
          <div className="h-4 bg-slate-800 rounded w-1/2" />
          <div className="space-y-4">
            <div className="h-24 bg-slate-800 rounded-lg" />
            <div className="h-48 bg-slate-800 rounded-lg" />
            <div className="h-32 bg-slate-800 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!selectedAlert && !isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">?</div>
          <h2 className="text-xl font-semibold text-slate-200 mb-2">Alert not found</h2>
          <p className="text-slate-400 mb-6">This alert may have been deleted.</p>
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <button
          onClick={handleCancel}
          className="text-sm text-slate-400 hover:text-slate-300 mb-4 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Alert
        </button>
        <h1 className="text-2xl font-bold text-slate-100">Edit Alert</h1>
        <p className="text-sm text-slate-400 mt-1">
          Modify alert conditions and notification settings
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Alert Form */}
      <AlertForm
        name={formName}
        network={formNetwork}
        condition={formCondition}
        channels={formChannels}
        cooldown={formCooldown}
        errors={formErrors}
        onNameChange={setFormName}
        onNetworkChange={setFormNetwork}
        onConditionChange={setFormCondition}
        onAddChannel={addChannel}
        onRemoveChannel={removeChannel}
        onCooldownChange={setFormCooldown}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isUpdating}
        submitLabel="Save Changes"
      />
    </div>
  );
}
