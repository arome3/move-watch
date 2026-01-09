'use client';

import { useState, useEffect } from 'react';
import type { NotificationPreference } from '@movewatch/shared';
import { useSettingsStore } from '@/stores/settings';

interface NotificationsTabProps {
  preferences: NotificationPreference | null;
  isLoading: boolean;
}

export function NotificationsTab({ preferences, isLoading }: NotificationsTabProps) {
  const { updatePreferences, isLoadingPreferences } = useSettingsStore();
  const [emailEnabled, setEmailEnabled] = useState(preferences?.emailEnabled ?? true);
  const [emailAddress, setEmailAddress] = useState(preferences?.emailAddress || '');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when preferences load
  useEffect(() => {
    if (preferences) {
      setEmailEnabled(preferences.emailEnabled);
      setEmailAddress(preferences.emailAddress || '');
      setHasChanges(false);
    }
  }, [preferences]);

  // Track changes
  useEffect(() => {
    if (preferences) {
      const changed =
        emailEnabled !== preferences.emailEnabled ||
        emailAddress !== (preferences.emailAddress || '');
      setHasChanges(changed);
    }
  }, [emailEnabled, emailAddress, preferences]);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updatePreferences({
      emailEnabled,
      emailAddress: emailAddress || undefined,
    });
    if (success) {
      setHasChanges(false);
    }
    setIsSaving(false);
  };

  const handleReset = () => {
    if (preferences) {
      setEmailEnabled(preferences.emailEnabled);
      setEmailAddress(preferences.emailAddress || '');
      setHasChanges(false);
    }
  };

  if (isLoading || isLoadingPreferences) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-5 bg-dark-700 rounded w-48 mb-4" />
          <div className="h-16 bg-dark-700 rounded" />
          <div className="h-10 bg-dark-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-medium text-dark-100">Notification Preferences</h3>
        <p className="text-sm text-dark-400 mt-1">
          Configure how you want to receive notifications from MoveWatch
        </p>
      </div>

      {/* Email Notifications */}
      <div className="bg-dark-900/50 rounded-lg border border-dark-700 p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="text-sm font-medium text-dark-200 flex items-center gap-2">
              <svg className="w-4 h-4 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Notifications
            </h4>
            <p className="text-xs text-dark-500 mt-1">
              Receive alert notifications via email
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dark-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500 peer-checked:after:bg-white"></div>
          </label>
        </div>

        {emailEnabled && (
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Notification Email Address
            </label>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="Enter email for notifications"
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                         text-dark-100 placeholder:text-dark-600
                         focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-dark-500 mt-1">
              Leave empty to use your account email
            </p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-400">Per-Alert Channels</h4>
            <p className="text-xs text-blue-300/70 mt-1">
              Each alert can have its own notification channels (Discord, Slack, Telegram, etc.).
              Configure them when creating or editing alerts.
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600
                       text-dark-300 rounded-lg text-sm font-medium transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50
                       text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
