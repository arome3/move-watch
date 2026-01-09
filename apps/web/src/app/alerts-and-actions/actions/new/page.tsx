'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useActionsStore } from '@/stores/actions';
import { ActionForm } from '@/components/actions/ActionForm';

export default function NewActionPage() {
  const router = useRouter();
  const {
    formName,
    formDescription,
    formCode,
    formNetwork,
    formTriggerType,
    formTriggerConfig,
    formMaxExecutionMs,
    formMemoryLimitMb,
    formCooldownSeconds,
    formErrors,
    setFormName,
    setFormDescription,
    setFormCode,
    setFormNetwork,
    setFormTriggerType,
    setFormTriggerConfig,
    setFormMaxExecutionMs,
    setFormMemoryLimitMb,
    setFormCooldownSeconds,
    createAction,
    resetForm,
    isCreating,
    error,
    clearError,
  } = useActionsStore();

  // Reset form on mount
  useEffect(() => {
    resetForm();
  }, [resetForm]);

  const handleSubmit = async () => {
    const action = await createAction();
    if (action) {
      router.push(`/alerts-and-actions/actions/${action.id}`);
    }
  };

  const handleCancel = () => {
    router.push('/alerts-and-actions?tab=actions');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link
              href="/alerts-and-actions?tab=actions"
              className="text-dark-400 hover:text-dark-300 transition-colors"
            >
              Alerts & Actions
            </Link>
          </li>
          <li className="text-dark-600">/</li>
          <li>
            <Link
              href="/alerts-and-actions?tab=actions"
              className="text-dark-400 hover:text-dark-300 transition-colors"
            >
              Actions
            </Link>
          </li>
          <li className="text-dark-600">/</li>
          <li className="text-dark-200">New</li>
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
          Back to Actions
        </button>
        <h1 className="text-2xl font-display font-bold text-dark-100">Create New Action</h1>
        <p className="text-sm text-dark-400 mt-1">
          Define a serverless function that runs in response to blockchain events
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 text-sm">
            Dismiss
          </button>
        </div>
      )}

      {/* Form */}
      <ActionForm
        name={formName}
        description={formDescription}
        code={formCode}
        network={formNetwork}
        triggerType={formTriggerType}
        triggerConfig={formTriggerConfig}
        maxExecutionMs={formMaxExecutionMs}
        memoryLimitMb={formMemoryLimitMb}
        cooldownSeconds={formCooldownSeconds}
        errors={formErrors}
        onNameChange={setFormName}
        onDescriptionChange={setFormDescription}
        onCodeChange={setFormCode}
        onNetworkChange={setFormNetwork}
        onTriggerTypeChange={setFormTriggerType}
        onTriggerConfigChange={setFormTriggerConfig}
        onMaxExecutionMsChange={setFormMaxExecutionMs}
        onMemoryLimitMbChange={setFormMemoryLimitMb}
        onCooldownSecondsChange={setFormCooldownSeconds}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isCreating}
        submitLabel="Create Action"
      />
    </div>
  );
}
