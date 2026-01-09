'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useActionsStore } from '@/stores/actions';
import { ActionForm } from '@/components/actions/ActionForm';

export default function EditActionPage() {
  const params = useParams();
  const router = useRouter();
  const actionId = params.id as string;

  const {
    selectedAction: action,
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
    fetchAction,
    updateAction,
    loadActionToForm,
    isLoading,
    isUpdating,
    error,
    clearError,
  } = useActionsStore();

  // Fetch action and load into form
  useEffect(() => {
    fetchAction(actionId);
  }, [actionId, fetchAction]);

  // Load action data into form when it arrives
  useEffect(() => {
    if (action && action.id === actionId) {
      loadActionToForm(action);
    }
  }, [action, actionId, loadActionToForm]);

  const handleSubmit = async () => {
    const updated = await updateAction(actionId);
    if (updated) {
      router.push(`/alerts-and-actions/actions/${actionId}`);
    }
  };

  const handleCancel = () => {
    router.push(`/alerts-and-actions/actions/${actionId}`);
  };

  if (isLoading && !action) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-700 rounded w-1/3" />
          <div className="h-4 bg-dark-700 rounded w-1/2" />
          <div className="h-64 bg-dark-700 rounded" />
        </div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-dark-200 mb-2">Action Not Found</h2>
          <p className="text-dark-400 mb-6">
            The action you&apos;re trying to edit doesn&apos;t exist.
          </p>
          <Link
            href="/alerts-and-actions?tab=actions"
            className="text-primary-400 hover:text-primary-300 transition-colors"
          >
            Back to Alerts & Actions
          </Link>
        </div>
      </div>
    );
  }

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
          <li>
            <Link
              href={`/alerts-and-actions/actions/${actionId}`}
              className="text-dark-400 hover:text-dark-300 transition-colors truncate max-w-[150px] inline-block"
            >
              {action.name}
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
          Back to Action
        </button>
        <h1 className="text-2xl font-display font-bold text-dark-100">Edit Action</h1>
        <p className="text-sm text-dark-400 mt-1">
          Modify your action&apos;s trigger, code, or settings
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

      {/* Warning about enabled actions */}
      {action.enabled && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl backdrop-blur-sm">
          <p className="text-sm text-amber-400">
            <strong>Warning:</strong> This action is currently enabled. Changes will take effect
            immediately after saving.
          </p>
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
        isSubmitting={isUpdating}
        submitLabel="Save Changes"
      />
    </div>
  );
}
