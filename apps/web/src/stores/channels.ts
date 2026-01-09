import { create } from 'zustand';
import type {
  NotificationChannelResponse,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
} from '@movewatch/shared';
import * as channelsApi from '@/lib/channelsApi';

interface ChannelsState {
  // Data
  channels: NotificationChannelResponse[];
  selectedChannel: (NotificationChannelResponse & { alerts?: Array<{ id: string; name: string; enabled: boolean; channelEnabled: boolean }> }) | null;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;

  // Errors
  error: string | null;
  testResult: { success: boolean; latencyMs?: number; error?: string } | null;

  // Actions
  fetchChannels: () => Promise<void>;
  fetchChannel: (id: string) => Promise<void>;
  createChannel: (request: CreateNotificationChannelRequest) => Promise<NotificationChannelResponse>;
  updateChannel: (id: string, request: UpdateNotificationChannelRequest) => Promise<void>;
  deleteChannel: (id: string, force?: boolean) => Promise<void>;
  testChannel: (id: string) => Promise<void>;
  clearError: () => void;
  clearTestResult: () => void;
  clearSelectedChannel: () => void;
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  // Initial state
  channels: [],
  selectedChannel: null,
  isLoading: false,
  isSaving: false,
  isTesting: false,
  error: null,
  testResult: null,

  // Fetch all channels
  fetchChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const { channels } = await channelsApi.getChannels();
      set({ channels, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load channels',
        isLoading: false,
      });
    }
  },

  // Fetch single channel with details
  fetchChannel: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const channel = await channelsApi.getChannel(id);
      set({ selectedChannel: channel, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load channel',
        isLoading: false,
      });
    }
  },

  // Create a new channel
  createChannel: async (request: CreateNotificationChannelRequest) => {
    set({ isSaving: true, error: null });
    try {
      const channel = await channelsApi.createChannel(request);
      set((state) => ({
        channels: [channel, ...state.channels],
        isSaving: false,
      }));
      return channel;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create channel',
        isSaving: false,
      });
      throw error;
    }
  },

  // Update an existing channel
  updateChannel: async (id: string, request: UpdateNotificationChannelRequest) => {
    set({ isSaving: true, error: null });
    try {
      const updated = await channelsApi.updateChannel(id, request);
      set((state) => ({
        channels: state.channels.map((c) => (c.id === id ? updated : c)),
        selectedChannel: state.selectedChannel?.id === id
          ? { ...state.selectedChannel, ...updated }
          : state.selectedChannel,
        isSaving: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update channel',
        isSaving: false,
      });
      throw error;
    }
  },

  // Delete a channel
  deleteChannel: async (id: string, force?: boolean) => {
    set({ isSaving: true, error: null });
    try {
      await channelsApi.deleteChannel(id, force);
      set((state) => ({
        channels: state.channels.filter((c) => c.id !== id),
        selectedChannel: state.selectedChannel?.id === id ? null : state.selectedChannel,
        isSaving: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete channel',
        isSaving: false,
      });
      throw error;
    }
  },

  // Test a channel
  testChannel: async (id: string) => {
    set({ isTesting: true, testResult: null });
    try {
      const result = await channelsApi.testChannel(id);
      set({ testResult: result, isTesting: false });
    } catch (error) {
      set({
        testResult: {
          success: false,
          error: error instanceof Error ? error.message : 'Test failed',
        },
        isTesting: false,
      });
    }
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Clear test result
  clearTestResult: () => set({ testResult: null }),

  // Clear selected channel
  clearSelectedChannel: () => set({ selectedChannel: null }),
}));
