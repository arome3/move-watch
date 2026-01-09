'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChannelsStore } from '@/stores/channels';
import { ChannelForm, type ChannelFormData } from '@/components/channels/ChannelForm';
import type { ChannelType, ChannelConfig } from '@movewatch/shared';
import Link from 'next/link';

export default function EditChannelPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    selectedChannel,
    isLoading,
    error,
    fetchChannel,
    updateChannel,
    isSaving,
    clearError,
    clearSelectedChannel,
  } = useChannelsStore();

  useEffect(() => {
    fetchChannel(id);
    return () => clearSelectedChannel();
  }, [id, fetchChannel, clearSelectedChannel]);

  const handleSubmit = async (data: ChannelFormData) => {
    try {
      await updateChannel(id, {
        name: data.name,
        config: data.config as unknown as ChannelConfig['config'],
      });
      router.push(`/alerts-and-actions/channels/${id}`);
    } catch {
      // Error is set in store
    }
  };

  const handleCancel = () => {
    clearError();
    router.push(`/alerts-and-actions/channels/${id}`);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-4 w-24 bg-dark-700 rounded mb-4" />
          <div className="h-8 w-48 bg-dark-700 rounded mb-8" />
          <div className="bg-dark-800 rounded-lg p-6">
            <div className="h-6 w-32 bg-dark-700 rounded mb-4" />
            <div className="h-4 w-full bg-dark-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !selectedChannel) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12 bg-dark-800 rounded-lg">
          <h2 className="text-lg font-medium text-dark-200 mb-2">Channel not found</h2>
          <p className="text-sm text-dark-400 mb-4">{error || 'The channel you are looking for does not exist.'}</p>
          <Link
            href="/alerts-and-actions?tab=channels"
            className="text-primary-400 hover:text-primary-300 text-sm"
          >
            Back to Channels
          </Link>
        </div>
      </div>
    );
  }

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
          Back to Channel
        </button>
        <h1 className="text-2xl font-bold text-dark-100">Edit Channel</h1>
        <p className="text-sm text-dark-400 mt-1">
          Update your channel configuration
        </p>
      </div>

      {/* Form */}
      <div className="bg-dark-800 rounded-lg p-6">
        <ChannelForm
          initialValues={{
            name: selectedChannel.name,
            type: selectedChannel.type.toLowerCase() as ChannelType,
            config: selectedChannel.config as unknown as Record<string, unknown>,
          }}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSaving}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
}
