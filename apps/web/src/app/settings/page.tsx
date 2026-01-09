'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useSettingsStore } from '@/stores/settings';
import { ProfileTab } from '@/components/settings/ProfileTab';
import { NotificationsTab } from '@/components/settings/NotificationsTab';
import { ApiKeysTab } from '@/components/settings/ApiKeysTab';

type TabId = 'profile' | 'notifications' | 'api-keys';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const {
    profile,
    preferences,
    apiKeys,
    isLoadingProfile,
    isLoadingPreferences,
    isLoadingApiKeys,
    error,
    fetchProfile,
    fetchPreferences,
    fetchApiKeys,
    clearError,
  } = useSettingsStore();

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/settings');
    }
  }, [status, router]);

  // Fetch data on mount
  useEffect(() => {
    if (status === 'authenticated') {
      fetchProfile();
      fetchPreferences();
      fetchApiKeys();
    }
  }, [status, fetchProfile, fetchPreferences, fetchApiKeys]);

  // Show loading state while checking auth
  if (status === 'loading') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-dark-800 rounded w-32 mb-2" />
          <div className="h-4 bg-dark-800 rounded w-64 mb-8" />
          <div className="h-12 bg-dark-800 rounded mb-6" />
          <div className="h-96 bg-dark-800 rounded" />
        </div>
      </div>
    );
  }

  // Don't render if unauthenticated (will redirect)
  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-dark-100">Settings</h1>
        <p className="text-sm text-dark-400 mt-1">
          Manage your profile, notifications, and API access
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-dark-700 mb-6">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-dark-400 hover:text-dark-300 hover:border-dark-600'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-dark-800/50 rounded-lg border border-dark-700">
        {activeTab === 'profile' && (
          <ProfileTab
            profile={profile}
            isLoading={isLoadingProfile}
            session={session}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsTab
            preferences={preferences}
            isLoading={isLoadingPreferences}
          />
        )}

        {activeTab === 'api-keys' && (
          <ApiKeysTab
            apiKeys={apiKeys}
            isLoading={isLoadingApiKeys}
          />
        )}
      </div>
    </div>
  );
}
