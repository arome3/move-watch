'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChannelsStore } from '@/stores/channels';
import type { ChannelType } from '@movewatch/shared';
import Link from 'next/link';

export default function ChannelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    selectedChannel,
    isLoading,
    error,
    fetchChannel,
    testChannel,
    deleteChannel,
    isTesting,
    testResult,
    clearTestResult,
    clearSelectedChannel,
  } = useChannelsStore();

  useEffect(() => {
    fetchChannel(id);
    return () => clearSelectedChannel();
  }, [id, fetchChannel, clearSelectedChannel]);

  const handleEdit = () => {
    router.push(`/alerts-and-actions/channels/${id}/edit`);
  };

  const handleTest = async () => {
    await testChannel(id);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this channel? Alerts using this channel will no longer receive notifications.')) {
      await deleteChannel(id);
      router.push('/alerts-and-actions?tab=channels');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

  const channelType = selectedChannel.type.toLowerCase() as ChannelType;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/alerts-and-actions?tab=channels"
          className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-200
                     transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Channels
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark-100">{selectedChannel.name}</h1>
            <p className="text-sm text-dark-400 mt-1 capitalize">{channelType} Channel</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-200
                         rounded-lg font-medium text-sm transition-colors
                         disabled:opacity-50"
            >
              {isTesting ? 'Testing...' : 'Test Channel'}
            </button>
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white
                         rounded-lg font-medium text-sm transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-dark-700 hover:bg-red-500/20 hover:text-red-400
                         text-dark-300 rounded-lg font-medium text-sm transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            testResult.success
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.success
                ? `Test notification sent successfully${testResult.latencyMs ? ` (${testResult.latencyMs}ms)` : ''}`
                : `Test failed: ${testResult.error}`}
            </p>
            <button
              onClick={clearTestResult}
              className="text-dark-400 hover:text-dark-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Channel Info */}
      <div className="bg-dark-800 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-dark-100 mb-4">Configuration</h2>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm text-dark-400">Type</dt>
            <dd className="text-dark-100 capitalize mt-1">{channelType}</dd>
          </div>
          {channelType === 'discord' || channelType === 'slack' ? (
            <div>
              <dt className="text-sm text-dark-400">Webhook URL</dt>
              <dd className="text-dark-100 mt-1 font-mono text-sm break-all">
                {(selectedChannel.config as { webhookUrl?: string })?.webhookUrl || 'Not configured'}
              </dd>
            </div>
          ) : null}
          {channelType === 'telegram' ? (
            <>
              <div>
                <dt className="text-sm text-dark-400">Bot Token</dt>
                <dd className="text-dark-100 mt-1 font-mono text-sm">
                  ••••••••{(selectedChannel.config as { botToken?: string })?.botToken?.slice(-8) || ''}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-dark-400">Chat ID</dt>
                <dd className="text-dark-100 mt-1 font-mono text-sm">
                  {(selectedChannel.config as { chatId?: string })?.chatId || 'Not configured'}
                </dd>
              </div>
            </>
          ) : null}
          {channelType === 'webhook' ? (
            <div>
              <dt className="text-sm text-dark-400">URL</dt>
              <dd className="text-dark-100 mt-1 font-mono text-sm break-all">
                {(selectedChannel.config as { url?: string })?.url || 'Not configured'}
              </dd>
            </div>
          ) : null}
          {channelType === 'email' ? (
            <div>
              <dt className="text-sm text-dark-400">Email</dt>
              <dd className="text-dark-100 mt-1">
                {(selectedChannel.config as { email?: string })?.email || 'Not configured'}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {/* Connected Alerts */}
      <div className="bg-dark-800 rounded-lg p-6">
        <h2 className="text-lg font-medium text-dark-100 mb-4">
          Connected Alerts ({selectedChannel.alerts?.length || 0})
        </h2>
        {selectedChannel.alerts && selectedChannel.alerts.length > 0 ? (
          <ul className="divide-y divide-dark-700">
            {selectedChannel.alerts.map((alert: { id: string; name: string; enabled: boolean; channelEnabled: boolean }) => (
              <li key={alert.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      alert.enabled && alert.channelEnabled
                        ? 'bg-green-500'
                        : 'bg-dark-500'
                    }`}
                  />
                  <Link
                    href={`/alerts-and-actions/alerts/${alert.id}`}
                    className="text-dark-100 hover:text-primary-400 transition-colors"
                  >
                    {alert.name}
                  </Link>
                </div>
                <span className="text-xs text-dark-400">
                  {alert.enabled
                    ? alert.channelEnabled
                      ? 'Active'
                      : 'Channel disabled'
                    : 'Alert disabled'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-dark-400">
            This channel is not connected to any alerts yet.
          </p>
        )}
      </div>
    </div>
  );
}
