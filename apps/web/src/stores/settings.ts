import { create } from 'zustand';
import type {
  UserProfile,
  UpdateProfileRequest,
  NotificationPreference,
  UpdateNotificationPreferenceRequest,
  ApiKeyResponse,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
} from '@movewatch/shared';

interface SettingsState {
  // Profile
  profile: UserProfile | null;
  isLoadingProfile: boolean;

  // Notification preferences
  preferences: NotificationPreference | null;
  isLoadingPreferences: boolean;

  // API Keys
  apiKeys: ApiKeyResponse[];
  isLoadingApiKeys: boolean;
  isCreatingApiKey: boolean;
  isRevokingApiKey: boolean;

  // Newly created key (shown once)
  newlyCreatedKey: CreateApiKeyResponse | null;

  // Error state
  error: string | null;

  // Profile actions
  fetchProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<boolean>;
  disconnectWallet: () => Promise<boolean>;

  // Preferences actions
  fetchPreferences: () => Promise<void>;
  updatePreferences: (data: UpdateNotificationPreferenceRequest) => Promise<boolean>;

  // API Key actions
  fetchApiKeys: () => Promise<void>;
  createApiKey: (data: CreateApiKeyRequest) => Promise<CreateApiKeyResponse | null>;
  revokeApiKey: (id: string) => Promise<boolean>;
  clearNewlyCreatedKey: () => void;

  // UI actions
  clearError: () => void;
}

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

// Helper to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
  // In a real app, get the session/token
  // For now, use X-User-ID header
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Try to get user ID from session (simplified for now)
  if (typeof window !== 'undefined') {
    // This would normally get the session from NextAuth
    // For development, we'll rely on the API's mock user fallback
  }

  return headers;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  // Initial state
  profile: null,
  isLoadingProfile: false,
  preferences: null,
  isLoadingPreferences: false,
  apiKeys: [],
  isLoadingApiKeys: false,
  isCreatingApiKey: false,
  isRevokingApiKey: false,
  newlyCreatedKey: null,
  error: null,

  // Fetch user profile
  fetchProfile: async () => {
    set({ isLoadingProfile: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/users/me`, { headers });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const profile = await response.json();
      set({ profile, isLoadingProfile: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
        isLoadingProfile: false,
      });
    }
  },

  // Update user profile
  updateProfile: async (data: UpdateProfileRequest) => {
    set({ isLoadingProfile: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/users/me`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const profile = await response.json();
      set({ profile, isLoadingProfile: false });
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update profile',
        isLoadingProfile: false,
      });
      return false;
    }
  },

  // Disconnect wallet
  disconnectWallet: async () => {
    set({ isLoadingProfile: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/users/me/wallet/disconnect`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to disconnect wallet');
      }

      // Refresh profile
      await get().fetchProfile();
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to disconnect wallet',
        isLoadingProfile: false,
      });
      return false;
    }
  },

  // Fetch notification preferences
  fetchPreferences: async () => {
    set({ isLoadingPreferences: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/users/me/preferences`, { headers });

      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }

      const preferences = await response.json();
      set({ preferences, isLoadingPreferences: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch preferences',
        isLoadingPreferences: false,
      });
    }
  },

  // Update notification preferences
  updatePreferences: async (data: UpdateNotificationPreferenceRequest) => {
    set({ isLoadingPreferences: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/users/me/preferences`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      const preferences = await response.json();
      set({ preferences, isLoadingPreferences: false });
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update preferences',
        isLoadingPreferences: false,
      });
      return false;
    }
  },

  // Fetch API keys
  fetchApiKeys: async () => {
    set({ isLoadingApiKeys: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api-keys`, { headers });

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      set({ apiKeys: data.apiKeys, isLoadingApiKeys: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch API keys',
        isLoadingApiKeys: false,
      });
    }
  },

  // Create API key
  createApiKey: async (data: CreateApiKeyRequest) => {
    set({ isCreatingApiKey: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api-keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create API key');
      }

      const newKey = await response.json() as CreateApiKeyResponse;

      // Add masked version to list and store full key for display
      set((state) => ({
        apiKeys: [
          {
            id: newKey.id,
            name: newKey.name,
            keyPrefix: newKey.keyPrefix,
            lastUsedAt: null,
            usageCount: 0,
            expiresAt: newKey.expiresAt,
            revokedAt: null,
            createdAt: newKey.createdAt,
          },
          ...state.apiKeys,
        ],
        newlyCreatedKey: newKey,
        isCreatingApiKey: false,
      }));

      return newKey;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create API key',
        isCreatingApiKey: false,
      });
      return null;
    }
  },

  // Revoke API key
  revokeApiKey: async (id: string) => {
    set({ isRevokingApiKey: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api-keys/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      // Update key in list to show as revoked
      set((state) => ({
        apiKeys: state.apiKeys.map((key) =>
          key.id === id
            ? { ...key, revokedAt: new Date().toISOString() }
            : key
        ),
        isRevokingApiKey: false,
      }));

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to revoke API key',
        isRevokingApiKey: false,
      });
      return false;
    }
  },

  // Clear newly created key (user has copied it)
  clearNewlyCreatedKey: () => set({ newlyCreatedKey: null }),

  // Clear error
  clearError: () => set({ error: null }),
}));
