'use client';

import { useState } from 'react';
import type { ApiKeyResponse } from '@movewatch/shared';
import { useSettingsStore } from '@/stores/settings';

interface ApiKeyRowProps {
  apiKey: ApiKeyResponse;
}

export function ApiKeyRow({ apiKey }: ApiKeyRowProps) {
  const { revokeApiKey, isRevokingApiKey } = useSettingsStore();
  const [isRevoking, setIsRevoking] = useState(false);

  const isRevoked = !!apiKey.revokedAt;
  const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();

  const handleRevoke = async () => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }
    setIsRevoking(true);
    await revokeApiKey(apiKey.id);
    setIsRevoking(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateString);
  };

  return (
    <div
      className={`bg-dark-900/50 rounded-lg border p-4 ${
        isRevoked || isExpired
          ? 'border-dark-700/50 opacity-60'
          : 'border-dark-700'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-dark-200 truncate">
              {apiKey.name || 'Unnamed Key'}
            </h4>
            {isRevoked && (
              <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                Revoked
              </span>
            )}
            {isExpired && !isRevoked && (
              <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                Expired
              </span>
            )}
          </div>
          <code className="text-xs text-dark-500 font-mono">
            {apiKey.keyPrefix}...
          </code>
        </div>

        {!isRevoked && !isExpired && (
          <button
            onClick={handleRevoke}
            disabled={isRevoking || isRevokingApiKey}
            className="text-xs text-red-400 hover:text-red-300 disabled:text-red-400/50"
          >
            {isRevoking ? 'Revoking...' : 'Revoke'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-dark-700/50">
        <div>
          <p className="text-xs text-dark-500">Created</p>
          <p className="text-xs text-dark-400">{formatDate(apiKey.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-dark-500">Last Used</p>
          <p className="text-xs text-dark-400">{formatRelativeTime(apiKey.lastUsedAt)}</p>
        </div>
        <div>
          <p className="text-xs text-dark-500">Usage</p>
          <p className="text-xs text-dark-400">
            {apiKey.usageCount.toLocaleString()} requests
          </p>
        </div>
      </div>

      {apiKey.expiresAt && !isRevoked && (
        <div className="mt-2 pt-2 border-t border-dark-700/50">
          <p className="text-xs text-dark-500">
            {isExpired ? 'Expired' : 'Expires'}: {formatDate(apiKey.expiresAt)}
          </p>
        </div>
      )}
    </div>
  );
}
