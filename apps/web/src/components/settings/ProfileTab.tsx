'use client';

import { useState } from 'react';
import type { Session } from 'next-auth';
import type { UserProfile } from '@movewatch/shared';
import { useSettingsStore } from '@/stores/settings';

interface ProfileTabProps {
  profile: UserProfile | null;
  isLoading: boolean;
  session: Session | null;
}

export function ProfileTab({ profile, isLoading, session }: ProfileTabProps) {
  const { updateProfile, disconnectWallet, isLoadingProfile } = useSettingsStore();
  const [name, setName] = useState(profile?.name || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Update local state when profile loads
  useState(() => {
    if (profile?.name) setName(profile.name);
  });

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateProfile({ name: name || undefined });
    if (success) {
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleDisconnectWallet = async () => {
    if (!confirm('Are you sure you want to disconnect your wallet? You can reconnect it later.')) {
      return;
    }
    setIsDisconnecting(true);
    await disconnectWallet();
    setIsDisconnecting(false);
  };

  if (isLoading || isLoadingProfile) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-dark-700 rounded-full" />
            <div>
              <div className="h-5 bg-dark-700 rounded w-32 mb-2" />
              <div className="h-4 bg-dark-700 rounded w-48" />
            </div>
          </div>
          <div className="h-10 bg-dark-700 rounded" />
          <div className="h-10 bg-dark-700 rounded" />
        </div>
      </div>
    );
  }

  const displayName = profile?.name || session?.user?.name || 'Anonymous';
  const email = profile?.email || session?.user?.email;
  const walletAddress = profile?.walletAddress || session?.user?.walletAddress;

  return (
    <div className="p-6 space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        {session?.user?.image ? (
          <img
            src={session.user.image}
            alt=""
            className="w-16 h-16 rounded-full bg-dark-700"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold text-dark-100">{displayName}</h2>
          {email && <p className="text-sm text-dark-400">{email}</p>}
        </div>
      </div>

      {/* Name Field */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Display Name
        </label>
        {isEditing ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                         text-dark-100 placeholder:text-dark-600
                         focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50
                         text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setName(profile?.name || '');
                setIsEditing(false);
              }}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600
                         text-dark-300 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-dark-900 border border-dark-700 rounded-lg px-3 py-2">
            <span className="text-sm text-dark-300">
              {profile?.name || <span className="text-dark-500">Not set</span>}
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-primary-400 hover:text-primary-300"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Email Field */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Email Address
        </label>
        <div className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-sm text-dark-300">
            {email || <span className="text-dark-500">Not connected</span>}
          </span>
          {profile?.emailVerified ? (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Verified
            </span>
          ) : email ? (
            <span className="text-xs text-yellow-400">Unverified</span>
          ) : null}
        </div>
      </div>

      {/* Wallet Section */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Connected Wallet
        </label>
        {walletAddress ? (
          <div className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <code className="text-sm text-dark-300 font-mono">
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
              </code>
            </div>
            <button
              onClick={handleDisconnectWallet}
              disabled={isDisconnecting}
              className="text-xs text-red-400 hover:text-red-300 disabled:text-red-400/50"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <div className="bg-dark-900 border border-dark-700 rounded-lg p-4 text-center">
            <p className="text-sm text-dark-500 mb-3">No wallet connected</p>
            <button
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600
                         text-white rounded-lg text-sm font-medium transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className="pt-4 border-t border-dark-700">
        <h3 className="text-sm font-medium text-dark-300 mb-3">Account Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-dark-500">Account Tier</p>
            <p className="text-dark-200 capitalize">{profile?.tier || 'free'}</p>
          </div>
          <div>
            <p className="text-dark-500">Member Since</p>
            <p className="text-dark-200">
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString()
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
