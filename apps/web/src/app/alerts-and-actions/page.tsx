'use client';

import { useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlertsStore } from '@/stores/alerts';
import { useActionsStore } from '@/stores/actions';
import { useChannelsStore } from '@/stores/channels';
import { AlertsList } from '@/components/alerts/AlertsList';
import { ActionsList } from '@/components/actions/ActionsList';
import { ChannelsList } from '@/components/channels/ChannelsList';
import { AutomationsTabs } from '@/components/automations';

type TabType = 'alerts' | 'actions' | 'channels';

function AutomationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabType) || 'alerts';

  const {
    alerts,
    isLoading: alertsLoading,
    error: alertsError,
    fetchAlerts,
    toggleAlert,
    testAlert,
    deleteAlert,
    isUpdating: alertsUpdating,
    isTesting,
    testingAlertId,
  } = useAlertsStore();

  const {
    actions,
    isLoading: actionsLoading,
    error: actionsError,
    fetchActions,
    toggleAction,
    deleteAction,
    isUpdating: actionsUpdating,
    isDeleting,
    clearError: clearActionsError,
  } = useActionsStore();

  const {
    channels,
    isLoading: channelsLoading,
    error: channelsError,
    fetchChannels,
    deleteChannel,
    testChannel,
    isSaving: channelsSaving,
    isTesting: channelsTesting,
    testResult,
    clearTestResult,
    clearError: clearChannelsError,
  } = useChannelsStore();

  useEffect(() => {
    fetchAlerts();
    fetchActions();
    fetchChannels();
  }, [fetchAlerts, fetchActions, fetchChannels]);

  const setActiveTab = (tab: TabType) => {
    router.push(`/alerts-and-actions?tab=${tab}`, { scroll: false });
  };

  const handleCreateNew = () => {
    if (activeTab === 'channels') {
      router.push('/alerts-and-actions/channels/new');
    } else {
      router.push(`/alerts-and-actions/${activeTab}/new`);
    }
  };

  // Stats calculations
  const stats = useMemo(() => {
    if (activeTab === 'alerts') {
      const enabled = alerts.filter((a) => a.enabled).length;
      const totalTriggers = alerts.reduce((sum, a) => sum + a.triggerCount, 0);
      return {
        total: alerts.length,
        active: enabled,
        metric: totalTriggers,
        metricLabel: 'Total Triggers',
      };
    } else if (activeTab === 'actions') {
      const enabled = actions.filter((a) => a.enabled).length;
      const totalExecutions = actions.reduce((sum, a) => sum + a.executionCount, 0);
      const totalSuccess = actions.reduce((sum, a) => sum + a.successCount, 0);
      const successRate = totalExecutions > 0 ? Math.round((totalSuccess / totalExecutions) * 100) : 0;
      return {
        total: actions.length,
        active: enabled,
        metric: totalExecutions,
        metricLabel: 'Executions',
        successRate: totalExecutions > 0 ? `${successRate}%` : 'N/A',
      };
    } else {
      const totalAlerts = channels.reduce((sum, c) => sum + (c.alertCount || 0), 0);
      return {
        total: channels.length,
        active: 0, // Channels don't have enabled/disabled state
        metric: totalAlerts,
        metricLabel: 'Linked Alerts',
      };
    }
  }, [activeTab, alerts, actions, channels]);

  const isLoading = activeTab === 'alerts' ? alertsLoading : activeTab === 'actions' ? actionsLoading : channelsLoading;
  const error = activeTab === 'alerts' ? alertsError : activeTab === 'actions' ? actionsError : channelsError;
  const hasData = activeTab === 'alerts' ? alerts.length > 0 : activeTab === 'actions' ? actions.length > 0 : channels.length > 0;

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-gold-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl font-display font-bold text-dark-100 tracking-tight">
              Alerts & Actions
            </h1>
            <p className="text-sm text-dark-400 mt-1.5 max-w-lg">
              Monitor on-chain conditions with alerts and automate responses with serverless actions
            </p>
          </div>

          <motion.button
            onClick={handleCreateNew}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="
              group relative px-5 py-2.5 rounded-xl font-medium text-sm
              bg-gradient-to-br from-primary-500 to-primary-600
              text-white shadow-lg shadow-primary-500/25
              hover:shadow-xl hover:shadow-primary-500/30
              transition-all duration-300
              flex items-center gap-2.5 w-fit
            "
          >
            <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <svg className="w-4 h-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="relative z-10">
              New {activeTab === 'alerts' ? 'Alert' : activeTab === 'actions' ? 'Action' : 'Channel'}
            </span>
          </motion.button>
        </motion.div>

        {/* Stats Bar - Show when there's data */}
        <AnimatePresence mode="wait">
          {hasData && !isLoading && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
            >
              <StatCard
                label={`Total ${activeTab === 'alerts' ? 'Alerts' : activeTab === 'actions' ? 'Actions' : 'Channels'}`}
                value={stats.total}
              />
              {activeTab !== 'channels' && (
                <StatCard
                  label="Active"
                  value={stats.active}
                  valueClassName="text-green-400"
                />
              )}
              <StatCard
                label={stats.metricLabel}
                value={stats.metric}
              />
              {activeTab === 'actions' && (
                <StatCard
                  label="Success Rate"
                  value={stats.successRate || 'N/A'}
                  valueClassName="text-primary-400"
                />
              )}
              {activeTab === 'alerts' && (
                <StatCard
                  label="Channels"
                  value={new Set(alerts.flatMap(a => a.channels?.map(c => c.id) || [])).size}
                  valueClassName="text-gold-400"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6"
        >
          <AutomationsTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            alertsCount={alerts.length}
            actionsCount={actions.length}
            channelsCount={channels.length}
          />
        </motion.div>

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between backdrop-blur-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-sm text-red-400">{error}</p>
              </div>
              {(activeTab === 'actions' || activeTab === 'channels') && (
                <button
                  onClick={activeTab === 'actions' ? clearActionsError : clearChannelsError}
                  className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  Dismiss
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Test Result Toast for Channels */}
        {activeTab === 'channels' && testResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-6 p-4 rounded-xl border backdrop-blur-sm ${
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
          </motion.div>
        )}

        {/* Tab Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {activeTab === 'alerts' && (
              <motion.div
                key="alerts"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <AlertsList
                  alerts={alerts}
                  isLoading={alertsLoading}
                  onView={(id) => router.push(`/alerts-and-actions/alerts/${id}`)}
                  onEdit={(id) => router.push(`/alerts-and-actions/alerts/${id}/edit`)}
                  onToggle={toggleAlert}
                  onTest={testAlert}
                  onDelete={(id) => {
                    if (confirm('Are you sure you want to delete this alert? This action cannot be undone.')) {
                      deleteAlert(id);
                    }
                  }}
                  isToggling={alertsUpdating}
                  isTesting={isTesting}
                  testingAlertId={testingAlertId ?? undefined}
                />
              </motion.div>
            )}
            {activeTab === 'actions' && (
              <motion.div
                key="actions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ActionsList
                  actions={actions}
                  isLoading={actionsLoading}
                  onToggle={toggleAction}
                  onDelete={deleteAction}
                  isUpdating={actionsUpdating}
                  isDeleting={isDeleting}
                />
              </motion.div>
            )}
            {activeTab === 'channels' && (
              <motion.div
                key="channels"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ChannelsList
                  channels={channels}
                  isLoading={channelsLoading}
                  onView={(id) => router.push(`/alerts-and-actions/channels/${id}`)}
                  onEdit={(id) => router.push(`/alerts-and-actions/channels/${id}/edit`)}
                  onTest={testChannel}
                  onDelete={(id) => {
                    if (confirm('Are you sure you want to delete this channel? Alerts using this channel will no longer receive notifications.')) {
                      deleteChannel(id);
                    }
                  }}
                  isDeleting={channelsSaving}
                  isTesting={channelsTesting}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number | string;
  valueClassName?: string;
}

function StatCard({ label, value, valueClassName = 'text-dark-100' }: StatCardProps) {
  return (
    <div className="relative group">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative bg-dark-800/60 backdrop-blur-sm rounded-xl p-4 border border-dark-700/50 transition-all duration-300 group-hover:border-dark-600/50">
        <div className={`text-2xl font-bold font-display ${valueClassName}`}>
          {value}
        </div>
        <div className="text-xs text-dark-400 mt-1 font-medium tracking-wide uppercase">
          {label}
        </div>
      </div>
    </div>
  );
}

// Loading Fallback
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        <span className="text-sm text-dark-400">Loading automations...</span>
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AutomationsContent />
    </Suspense>
  );
}
