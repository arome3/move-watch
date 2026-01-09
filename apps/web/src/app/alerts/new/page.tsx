'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAlertsStore } from '@/stores/alerts';
import { AlertForm } from '@/components/alerts/AlertForm';

export default function NewAlertPage() {
  const router = useRouter();
  const {
    formName,
    formNetwork,
    formCondition,
    formChannelIds,
    formCooldown,
    formErrors,
    isCreating,
    error,
    setFormName,
    setFormNetwork,
    setFormCondition,
    setFormChannelIds,
    setFormCooldown,
    createAlert,
    resetForm,
  } = useAlertsStore();

  // Reset form on mount
  useEffect(() => {
    resetForm();
  }, [resetForm]);

  const handleSubmit = async () => {
    const alert = await createAlert();
    if (alert) {
      router.push(`/alerts/${alert.id}`);
    }
  };

  const handleCancel = () => {
    router.push('/alerts');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <button
          onClick={handleCancel}
          className="text-sm text-dark-400 hover:text-dark-300 mb-4 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Alerts
        </button>
        <h1 className="text-2xl font-bold text-dark-100">Create Alert</h1>
        <p className="text-sm text-dark-400 mt-1">
          Set up automated monitoring for on-chain conditions
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
        isSubmitting={isCreating}
        submitLabel="Create Alert"
      />
    </div>
  );
}
