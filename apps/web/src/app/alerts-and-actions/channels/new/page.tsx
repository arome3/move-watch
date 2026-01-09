'use client';

import { useRouter } from 'next/navigation';
import { useChannelsStore } from '@/stores/channels';
import { ChannelForm, type ChannelFormData } from '@/components/channels/ChannelForm';
import type { CreateNotificationChannelRequest, ChannelConfig } from '@movewatch/shared';

export default function NewChannelPage() {
  const router = useRouter();
  const { createChannel, isSaving, error, clearError } = useChannelsStore();

  const handleSubmit = async (data: ChannelFormData) => {
    try {
      // Cast form data to the API request type
      const request: CreateNotificationChannelRequest = {
        name: data.name,
        type: data.type,
        config: data.config as unknown as ChannelConfig['config'],
      };
      await createChannel(request);
      router.push('/alerts-and-actions?tab=channels');
    } catch {
      // Error is set in store
    }
  };

  const handleCancel = () => {
    clearError();
    router.push('/alerts-and-actions?tab=channels');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-200
                     transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Channels
        </button>
        <h1 className="text-2xl font-bold text-dark-100">Create Channel</h1>
        <p className="text-sm text-dark-400 mt-1">
          Create a new notification channel to receive alerts
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-dark-800 rounded-lg p-6">
        <ChannelForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSaving}
          submitLabel="Create Channel"
        />
      </div>
    </div>
  );
}
