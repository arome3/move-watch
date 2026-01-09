'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
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
    formChannelIds,
    formCooldown,
    formErrors,
    isLoading,
    isUpdating,
    error,
    fetchAlert,
    setFormName,
    setFormNetwork,
    setFormCondition,
    setFormChannelIds,
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
      router.push(`/alerts-and-actions/alerts/${alertId}`);
    }
  };

  const handleCancel = () => {
    router.push(`/alerts-and-actions/alerts/${alertId}`);
  };

  if (isLoading && !selectedAlert) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-dark-800 rounded w-1/3" />
          <div className="h-4 bg-dark-800 rounded w-1/2" />
          <div className="space-y-4">
            <div className="h-24 bg-dark-800 rounded-lg" />
            <div className="h-48 bg-dark-800 rounded-lg" />
            <div className="h-32 bg-dark-800 rounded-lg" />
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
          <h2 className="text-xl font-semibold text-dark-200 mb-2">Alert not found</h2>
          <p className="text-dark-400 mb-6">This alert may have been deleted.</p>
          <Link
            href="/alerts-and-actions?tab=alerts"
            className="text-primary-400 hover:text-primary-300"
          >
            Back to Alerts & Actions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link
              href="/alerts-and-actions?tab=alerts"
              className="text-dark-400 hover:text-dark-300 transition-colors"
            >
              Alerts & Actions
            </Link>
          </li>
          <li className="text-dark-600">/</li>
          <li>
            <Link
              href="/alerts-and-actions?tab=alerts"
              className="text-dark-400 hover:text-dark-300 transition-colors"
            >
              Alerts
            </Link>
          </li>
          <li className="text-dark-600">/</li>
          <li>
            <Link
              href={`/alerts-and-actions/alerts/${alertId}`}
              className="text-dark-400 hover:text-dark-300 transition-colors truncate max-w-[150px] inline-block"
            >
              {selectedAlert?.name || 'Alert'}
            </Link>
          </li>
          <li className="text-dark-600">/</li>
          <li className="text-dark-200">Edit</li>
        </ol>
      </nav>

      {/* Page Header */}
      <div className="mb-8">
        <button
          onClick={handleCancel}
          className="text-sm text-dark-400 hover:text-dark-300 mb-4 flex items-center gap-1 group"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Alert
        </button>
        <h1 className="text-2xl font-display font-bold text-dark-100">Edit Alert</h1>
        <p className="text-sm text-dark-400 mt-1">
          Modify alert conditions and notification settings
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Alert Form */}
      <AlertForm
        name={formName}
        network={formNetwork}
        condition={formCondition}
        channelIds={formChannelIds}
        cooldown={formCooldown}
        errors={formErrors}
        onNameChange={setFormName}
        onNetworkChange={setFormNetwork}
        onConditionChange={setFormCondition}
        onChannelIdsChange={setFormChannelIds}
        onCooldownChange={setFormCooldown}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isUpdating}
        submitLabel="Save Changes"
      />
    </div>
  );
}
