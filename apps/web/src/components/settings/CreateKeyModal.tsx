'use client';

import { useState } from 'react';
import { useSettingsStore } from '@/stores/settings';

interface CreateKeyModalProps {
  onClose: () => void;
}

export function CreateKeyModal({ onClose }: CreateKeyModalProps) {
  const { createApiKey, isCreatingApiKey } = useSettingsStore();
  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState<string>('never');

  const handleCreate = async () => {
    let expiresInDays: number | undefined;

    if (expiresIn !== 'never') {
      expiresInDays = parseInt(expiresIn, 10);
    }

    const result = await createApiKey({
      name: name || undefined,
      expiresInDays,
    });

    if (result) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-dark-100">Create API Key</h2>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-dark-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Key Name <span className="text-dark-500">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Server, CI/CD Pipeline"
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                         text-dark-100 placeholder:text-dark-600
                         focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-dark-500 mt-1">
              A descriptive name to help identify this key
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Expiration
            </label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                         text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="never">Never expires</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
            </select>
          </div>

          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex gap-2">
              <svg className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-yellow-300/80">
                Your API key will only be shown once after creation. Make sure to copy it immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-dark-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600
                       text-dark-300 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreatingApiKey}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50
                       text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isCreatingApiKey ? 'Creating...' : 'Create Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
