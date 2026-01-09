'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useActionsStore } from '@/stores/actions';
import { ActionForm } from '@/components/actions/ActionForm';
import { TemplateGallery } from '@/components/actions/TemplateGallery';
import type { ActionTemplate } from '@/lib/actionsApi';
import type { TriggerConfig } from '@movewatch/shared';

type ViewMode = 'gallery' | 'form';

export default function NewActionPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(null);

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

  const handleSelectTemplate = (template: ActionTemplate) => {
    setSelectedTemplate(template);

    // Pre-fill form with template data
    setFormName(template.name);
    setFormDescription(template.description);
    setFormCode(template.code);
    setFormNetwork(template.network === 'both' ? 'mainnet' : template.network);
    setFormTriggerType(template.triggerType);
    setFormTriggerConfig(template.triggerConfig as unknown as TriggerConfig);

    // Switch to form view
    setViewMode('form');
  };

  const handleStartFromScratch = () => {
    resetForm();
    setSelectedTemplate(null);
    setViewMode('form');
  };

  const handleBackToGallery = () => {
    setViewMode('gallery');
    setSelectedTemplate(null);
  };

  const handleSubmit = async () => {
    const action = await createAction();
    if (action) {
      router.push(`/actions/${action.id}`);
    }
  };

  const handleCancel = () => {
    if (viewMode === 'form') {
      // Go back to gallery instead of leaving page
      handleBackToGallery();
    } else {
      router.push('/actions');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm">
        <ol className="flex items-center gap-2 text-dark-400">
          <li>
            <Link href="/actions" className="hover:text-dark-300 transition-colors">
              Actions
            </Link>
          </li>
          <li>/</li>
          <li className="text-dark-200">New Action</li>
        </ol>
      </nav>

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark-100">Create New Action</h1>
            <p className="text-sm text-dark-400 mt-1">
              {viewMode === 'gallery'
                ? 'Choose a template or start from scratch'
                : selectedTemplate
                  ? `Based on: ${selectedTemplate.name}`
                  : 'Define a serverless function that runs in response to blockchain events'}
            </p>
          </div>
          {viewMode === 'form' && (
            <button
              onClick={handleBackToGallery}
              className="px-3 py-1.5 text-sm text-dark-400 hover:text-dark-300
                         flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Templates
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 text-sm">
            Dismiss
          </button>
        </div>
      )}

      {/* Template Selection Note */}
      {viewMode === 'form' && selectedTemplate && (
        <div className="mb-6 p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-primary-400 mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-primary-300 font-medium">Template loaded</p>
              <p className="text-xs text-primary-400/80 mt-1">
                Review and customize the code below. You&apos;ll need to configure the required secrets
                after creating the action.
                {selectedTemplate.requiredSecrets.length > 0 && (
                  <span className="block mt-1">
                    Required: {selectedTemplate.requiredSecrets.map(s => s.name).join(', ')}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === 'gallery' ? (
        <TemplateGallery
          onSelectTemplate={handleSelectTemplate}
          onStartFromScratch={handleStartFromScratch}
        />
      ) : (
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
      )}
    </div>
  );
}
