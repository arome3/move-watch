'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useActionsStore } from '@/stores/actions';
import type { ActionExecutionResponse } from '@movewatch/shared';

// Dynamically import Monaco editor to avoid SSR issues
const ActionEditor = dynamic(
  () => import('@/components/actions/ActionEditor').then((mod) => mod.ActionEditor),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg overflow-hidden border border-dark-700">
        <div className="flex items-center justify-center h-[400px] bg-dark-900">
          <div className="text-dark-400 text-sm">Loading editor...</div>
        </div>
      </div>
    ),
  }
);

const TRIGGER_ICONS: Record<string, string> = {
  event: '⚡',
  block: '📦',
  schedule: '🕐',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  running: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  success: { bg: 'bg-green-500/20', text: 'text-green-400' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400' },
  timeout: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
};

export default function ActionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const actionId = params.id as string;

  const {
    selectedAction: action,
    executions,
    isLoading,
    error,
    fetchAction,
    fetchExecutions,
    toggleAction,
    deleteAction,
    testAction,
    testResult,
    isTesting,
    isUpdating,
    clearError,
    clearTestResult,
  } = useActionsStore();

  const [activeTab, setActiveTab] = useState<'code' | 'executions' | 'secrets'>('code');

  useEffect(() => {
    fetchAction(actionId);
    fetchExecutions(actionId);
  }, [actionId, fetchAction, fetchExecutions]);

  const handleToggle = async () => {
    if (action) {
      await toggleAction(action.id, !action.enabled);
      fetchAction(actionId);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this action? This cannot be undone.')) {
      const deleted = await deleteAction(actionId);
      if (deleted) {
        router.push('/alerts-and-actions?tab=actions');
      }
    }
  };

  const handleTest = async () => {
    clearTestResult();
    await testAction(actionId);
    fetchExecutions(actionId);
  };

  if (isLoading && !action) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-dark-200 mb-2">Action Not Found</h2>
          <p className="text-dark-400 mb-6">
            The action you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
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

  const successRate =
    action.executionCount > 0
      ? Math.round((action.successCount / action.executionCount) * 100)
      : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <li className="text-dark-200 truncate max-w-[200px]">{action.name}</li>
        </ol>
      </nav>

      {/* Back Button */}
      <button
        onClick={() => router.push('/alerts-and-actions?tab=actions')}
        className="text-sm text-dark-400 hover:text-dark-300 mb-6 flex items-center gap-1 group"
      >
        <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Actions
      </button>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 text-sm">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <span className="text-4xl">{TRIGGER_ICONS[action.triggerType]}</span>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold text-dark-100">{action.name}</h1>
              <span
                className={`px-2 py-0.5 text-xs rounded ${
                  action.enabled
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-dark-700 text-dark-400'
                }`}
              >
                {action.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {action.description && (
              <p className="text-dark-400 mt-1">{action.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-200
                       rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {isTesting ? 'Testing...' : 'Test Run'}
          </button>
          <button
            onClick={handleToggle}
            disabled={isUpdating}
            className={`px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 ${
              action.enabled
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
            }`}
          >
            {action.enabled ? 'Disable' : 'Enable'}
          </button>
          <Link
            href={`/alerts-and-actions/actions/${action.id}/edit`}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white
                       rounded-lg text-sm transition-colors"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400
                       rounded-lg text-sm transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`mb-6 p-4 rounded-xl border backdrop-blur-sm ${
            testResult.status?.toLowerCase() === 'success'
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`font-medium ${
                testResult.status?.toLowerCase() === 'success' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              Test {testResult.status?.toLowerCase() === 'success' ? 'Passed' : 'Failed'}
            </span>
            <span className="text-sm text-dark-400">{testResult.duration ?? 0}ms</span>
          </div>
          {testResult.logs && testResult.logs.length > 0 && (
            <div className="mt-2 p-2 bg-dark-900 rounded font-mono text-xs text-dark-300 max-h-32 overflow-auto">
              {testResult.logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          )}
          {testResult.error && (
            <p className="mt-2 text-sm text-red-400">{testResult.error}</p>
          )}
          <button
            onClick={clearTestResult}
            className="mt-2 text-xs text-dark-500 hover:text-dark-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl p-4 border border-dark-700/50">
          <div className="text-2xl font-display font-bold text-dark-100">{action.executionCount}</div>
          <div className="text-xs text-dark-400 mt-1 font-medium tracking-wide uppercase">Executions</div>
        </div>
        <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl p-4 border border-dark-700/50">
          <div className="text-2xl font-display font-bold text-green-400">{action.successCount}</div>
          <div className="text-xs text-dark-400 mt-1 font-medium tracking-wide uppercase">Successful</div>
        </div>
        <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl p-4 border border-dark-700/50">
          <div className="text-2xl font-display font-bold text-red-400">{action.failureCount}</div>
          <div className="text-xs text-dark-400 mt-1 font-medium tracking-wide uppercase">Failed</div>
        </div>
        <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl p-4 border border-dark-700/50">
          <div
            className={`text-2xl font-display font-bold ${
              successRate === null
                ? 'text-dark-500'
                : successRate >= 90
                  ? 'text-green-400'
                  : successRate >= 70
                    ? 'text-yellow-400'
                    : 'text-red-400'
            }`}
          >
            {successRate !== null ? `${successRate}%` : 'N/A'}
          </div>
          <div className="text-xs text-dark-400 mt-1 font-medium tracking-wide uppercase">Success Rate</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-dark-700">
        {(['code', 'executions', 'secrets'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-primary-400 border-primary-400'
                : 'text-dark-400 border-transparent hover:text-dark-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'code' && (
        <div className="space-y-4">
          <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl p-4 border border-dark-700/50">
            <h3 className="text-sm font-medium text-dark-300 mb-3">Trigger Configuration</h3>
            <pre className="text-xs text-dark-400 bg-dark-900 p-3 rounded overflow-auto">
              {JSON.stringify(action.triggerConfig, null, 2)}
            </pre>
          </div>
          <ActionEditor value={action.code} onChange={() => {}} readOnly height="400px" />
        </div>
      )}

      {activeTab === 'executions' && (
        <ExecutionsTab executions={executions?.executions || []} />
      )}

      {activeTab === 'secrets' && (
        <SecretsTab actionId={action.id} secretNames={action.secretNames} />
      )}
    </div>
  );
}

function ExecutionsTab({ executions }: { executions: ActionExecutionResponse[] }) {
  if (executions.length === 0) {
    return (
      <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl p-8 border border-dark-700/50 text-center">
        <p className="text-dark-400">No executions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {executions.map((exec) => (
        <div
          key={exec.id}
          className="bg-dark-800/60 backdrop-blur-sm rounded-xl p-4 border border-dark-700/50"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span
                className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[exec.status]?.bg} ${STATUS_COLORS[exec.status]?.text}`}
              >
                {exec.status}
              </span>
              <span className="text-sm text-dark-400">
                {exec.durationMs}ms
              </span>
            </div>
            <span className="text-xs text-dark-500">
              {new Date(exec.createdAt).toLocaleString()}
            </span>
          </div>

          {exec.logs.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-dark-500 cursor-pointer hover:text-dark-400">
                View logs ({exec.logs.length})
              </summary>
              <div className="mt-2 p-2 bg-dark-900 rounded font-mono text-xs text-dark-300 max-h-32 overflow-auto">
                {exec.logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </details>
          )}

          {exec.error && (
            <div className="mt-2 text-sm text-red-400">
              {exec.error.message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SecretsTab({
  actionId,
  secretNames,
}: {
  actionId: string;
  secretNames: string[];
}) {
  const { setSecret, deleteSecret, isSavingSecret } = useActionsStore();
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = async () => {
    if (!newName || !newValue) return;
    await setSecret(actionId, newName, newValue);
    setNewName('');
    setNewValue('');
  };

  const handleDelete = async (name: string) => {
    if (confirm(`Delete secret "${name}"?`)) {
      await deleteSecret(actionId, name);
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing secrets */}
      <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl border border-dark-700/50">
        <div className="px-4 py-3 border-b border-dark-700/50">
          <h3 className="text-sm font-medium text-dark-300">Secrets</h3>
          <p className="text-xs text-dark-500 mt-1">
            Encrypted values accessible via ctx.secrets in your action code
          </p>
        </div>
        <div className="p-4">
          {secretNames.length === 0 ? (
            <p className="text-sm text-dark-500">No secrets configured</p>
          ) : (
            <div className="space-y-2">
              {secretNames.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between bg-dark-900 px-3 py-2 rounded"
                >
                  <span className="font-mono text-sm text-dark-300">{name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dark-500">***</span>
                    <button
                      onClick={() => handleDelete(name)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add new secret */}
      <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl p-4 border border-dark-700/50">
        <h3 className="text-sm font-medium text-dark-300 mb-3">Add Secret</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            placeholder="SECRET_NAME"
            className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                       text-dark-100 placeholder:text-dark-600 font-mono
                       focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="password"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Secret value"
            className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                       text-dark-100 placeholder:text-dark-600
                       focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleAdd}
            disabled={!newName || !newValue || isSavingSecret}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white
                       rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {isSavingSecret ? 'Saving...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
