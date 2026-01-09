'use client';

import { useState } from 'react';
import type { ApiKeyResponse } from '@movewatch/shared';
import { useSettingsStore } from '@/stores/settings';
import { ApiKeyRow } from './ApiKeyRow';
import { CreateKeyModal } from './CreateKeyModal';

interface ApiKeysTabProps {
  apiKeys: ApiKeyResponse[];
  isLoading: boolean;
}

export function ApiKeysTab({ apiKeys, isLoading }: ApiKeysTabProps) {
  const { newlyCreatedKey, clearNewlyCreatedKey, isLoadingApiKeys } = useSettingsStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Separate active and revoked keys
  const activeKeys = apiKeys.filter((key) => !key.revokedAt);
  const revokedKeys = apiKeys.filter((key) => key.revokedAt);

  if (isLoading || isLoadingApiKeys) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="flex justify-between mb-6">
            <div className="h-6 bg-dark-700 rounded w-32" />
            <div className="h-9 bg-dark-700 rounded w-32" />
          </div>
          <div className="h-20 bg-dark-700 rounded" />
          <div className="h-20 bg-dark-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-dark-100">API Keys</h3>
          <p className="text-sm text-dark-400 mt-1">
            Manage API keys for programmatic access to MoveWatch
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white
                     rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create API Key
        </button>
      </div>

      {/* Newly Created Key Banner */}
      {newlyCreatedKey && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-green-400">
                API Key Created Successfully
              </span>
            </div>
            <button
              onClick={clearNewlyCreatedKey}
              className="text-green-400 hover:text-green-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-green-300/70 mb-3">
            Make sure to copy your API key now. You won&apos;t be able to see it again!
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-dark-900 px-3 py-2 rounded text-sm text-dark-100 font-mono overflow-x-auto">
              {newlyCreatedKey.key}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newlyCreatedKey.key);
              }}
              className="px-3 py-2 bg-dark-700 hover:bg-dark-600 text-dark-300
                         rounded text-sm font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
          </div>
        </div>
      )}

      {/* API Usage Info */}
      <div className="bg-dark-900/50 rounded-lg border border-dark-700 p-4">
        <h4 className="text-sm font-medium text-dark-200 mb-2">Using API Keys</h4>
        <p className="text-xs text-dark-400 mb-3">
          Include your API key in the <code className="px-1 py-0.5 bg-dark-800 rounded">X-API-Key</code> header:
        </p>
        <pre className="bg-dark-900 rounded p-3 text-xs text-dark-300 overflow-x-auto">
{`curl -H "X-API-Key: mw_live_..." \\
  https://api.movewatch.io/v1/alerts`}
        </pre>
      </div>

      {/* Active Keys */}
      <div>
        <h4 className="text-sm font-medium text-dark-300 mb-3">
          Active Keys ({activeKeys.length})
        </h4>
        {activeKeys.length === 0 ? (
          <div className="bg-dark-900/50 rounded-lg border border-dark-700 p-8 text-center">
            <svg className="w-12 h-12 text-dark-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <p className="text-sm text-dark-500 mb-3">No API keys yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              Create your first API key
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {activeKeys.map((key) => (
              <ApiKeyRow key={key.id} apiKey={key} />
            ))}
          </div>
        )}
      </div>

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-dark-500 mb-3">
            Revoked Keys ({revokedKeys.length})
          </h4>
          <div className="space-y-2 opacity-60">
            {revokedKeys.map((key) => (
              <ApiKeyRow key={key.id} apiKey={key} />
            ))}
          </div>
        </div>
      )}

      {/* Create Key Modal */}
      {showCreateModal && (
        <CreateKeyModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
