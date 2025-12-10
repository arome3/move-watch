import { create } from 'zustand';
import type {
  AlertResponse,
  AlertCondition,
  ChannelConfig,
  CreateAlertRequest,
  UpdateAlertRequest,
  TestNotificationResult,
  AlertTriggersResponse,
  Network,
} from '@movewatch/shared';
import * as alertsApi from '@/lib/alertsApi';

interface AlertsState {
  // Data
  alerts: AlertResponse[];
  selectedAlert: AlertResponse | null;
  triggers: AlertTriggersResponse | null;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isTesting: boolean;

  // Error state
  error: string | null;

  // Form state for create/edit
  formName: string;
  formNetwork: Network;
  formCondition: AlertCondition | null;
  formChannels: ChannelConfig[];
  formCooldown: number;
  formErrors: Record<string, string>;

  // Test results
  testResults: TestNotificationResult[] | null;

  // Actions - Data fetching
  fetchAlerts: () => Promise<void>;
  fetchAlert: (id: string) => Promise<void>;
  fetchTriggers: (id: string, limit?: number, offset?: number) => Promise<void>;

  // Actions - CRUD
  createAlert: () => Promise<AlertResponse | null>;
  updateAlert: (id: string, updates?: UpdateAlertRequest) => Promise<AlertResponse | null>;
  deleteAlert: (id: string) => Promise<boolean>;
  toggleAlert: (id: string, enabled: boolean) => Promise<void>;
  testAlert: (id: string) => Promise<void>;

  // Actions - Form
  setFormName: (name: string) => void;
  setFormNetwork: (network: Network) => void;
  setFormCondition: (condition: AlertCondition | null) => void;
  addChannel: (channel: ChannelConfig) => void;
  updateChannel: (index: number, channel: ChannelConfig) => void;
  removeChannel: (index: number) => void;
  setFormCooldown: (seconds: number) => void;
  resetForm: () => void;
  loadAlertToForm: (alert: AlertResponse) => void;
  validateForm: () => boolean;

  // Actions - UI
  setSelectedAlert: (alert: AlertResponse | null) => void;
  clearError: () => void;
  clearTestResults: () => void;
}

const initialFormState = {
  formName: '',
  formNetwork: 'testnet' as Network,
  formCondition: null as AlertCondition | null,
  formChannels: [] as ChannelConfig[],
  formCooldown: 60,
  formErrors: {} as Record<string, string>,
};

export const useAlertsStore = create<AlertsState>()((set, get) => ({
  // Initial state
  alerts: [],
  selectedAlert: null,
  triggers: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  isTesting: false,
  error: null,
  testResults: null,
  ...initialFormState,

  // Fetch all alerts
  fetchAlerts: async () => {
    set({ isLoading: true, error: null });
    try {
      const alerts = await alertsApi.fetchAlerts();
      set({ alerts, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch alerts',
        isLoading: false,
      });
    }
  },

  // Fetch single alert
  fetchAlert: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const alert = await alertsApi.getAlert(id);
      set({ selectedAlert: alert, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch alert',
        isLoading: false,
      });
    }
  },

  // Fetch trigger history
  fetchTriggers: async (id: string, limit = 10, offset = 0) => {
    set({ isLoading: true, error: null });
    try {
      const triggers = await alertsApi.getAlertTriggers(id, limit, offset);
      set({ triggers, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch triggers',
        isLoading: false,
      });
    }
  },

  // Create new alert
  createAlert: async () => {
    const state = get();

    if (!state.validateForm()) {
      return null;
    }

    if (!state.formCondition) {
      set({ formErrors: { condition: 'Please configure a condition' } });
      return null;
    }

    if (state.formChannels.length === 0) {
      set({ formErrors: { channels: 'Please add at least one notification channel' } });
      return null;
    }

    set({ isCreating: true, error: null });

    try {
      const request: CreateAlertRequest = {
        name: state.formName,
        network: state.formNetwork,
        condition: state.formCondition,
        channels: state.formChannels,
        cooldownSeconds: state.formCooldown,
      };

      const alert = await alertsApi.createAlert(request);

      // Add to list
      set((s) => ({
        alerts: [alert, ...s.alerts],
        isCreating: false,
      }));

      // Reset form
      get().resetForm();

      return alert;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create alert',
        isCreating: false,
      });
      return null;
    }
  },

  // Update alert
  updateAlert: async (id: string, updates?: UpdateAlertRequest) => {
    set({ isUpdating: true, error: null });

    try {
      // If no updates provided, build from form state
      const state = get();
      const updateData: UpdateAlertRequest = updates || {
        name: state.formName,
        network: state.formNetwork,
        condition: state.formCondition || undefined,
        channels: state.formChannels.length > 0 ? state.formChannels : undefined,
        cooldownSeconds: state.formCooldown,
      };

      const alert = await alertsApi.updateAlert(id, updateData);

      // Update in list
      set((s) => ({
        alerts: s.alerts.map((a) => (a.id === id ? alert : a)),
        selectedAlert: s.selectedAlert?.id === id ? alert : s.selectedAlert,
        isUpdating: false,
      }));

      return alert;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update alert',
        isUpdating: false,
      });
      return null;
    }
  },

  // Delete alert
  deleteAlert: async (id: string) => {
    set({ isDeleting: true, error: null });

    try {
      await alertsApi.deleteAlert(id);

      // Remove from list
      set((s) => ({
        alerts: s.alerts.filter((a) => a.id !== id),
        selectedAlert: s.selectedAlert?.id === id ? null : s.selectedAlert,
        isDeleting: false,
      }));

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete alert',
        isDeleting: false,
      });
      return false;
    }
  },

  // Toggle alert enabled/disabled
  toggleAlert: async (id: string, enabled: boolean) => {
    set({ isUpdating: true, error: null });

    try {
      const alert = await alertsApi.toggleAlert(id, enabled);

      // Update in list
      set((s) => ({
        alerts: s.alerts.map((a) => (a.id === id ? alert : a)),
        selectedAlert: s.selectedAlert?.id === id ? alert : s.selectedAlert,
        isUpdating: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to toggle alert',
        isUpdating: false,
      });
    }
  },

  // Test alert notifications
  testAlert: async (id: string) => {
    set({ isTesting: true, error: null, testResults: null });

    try {
      const results = await alertsApi.testAlert(id);
      set({ testResults: results, isTesting: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to test alert',
        isTesting: false,
      });
    }
  },

  // Form actions
  setFormName: (formName) => set({ formName }),
  setFormNetwork: (formNetwork) => set({ formNetwork }),
  setFormCondition: (formCondition) => set({ formCondition }),

  addChannel: (channel) =>
    set((s) => ({ formChannels: [...s.formChannels, channel] })),

  updateChannel: (index, channel) =>
    set((s) => ({
      formChannels: s.formChannels.map((c, i) => (i === index ? channel : c)),
    })),

  removeChannel: (index) =>
    set((s) => ({
      formChannels: s.formChannels.filter((_, i) => i !== index),
    })),

  setFormCooldown: (formCooldown) => set({ formCooldown }),

  resetForm: () => set(initialFormState),

  loadAlertToForm: (alert: AlertResponse) => {
    // We need to fetch the full channel configs from the API
    // For now, just load what we have
    set({
      formName: alert.name,
      formNetwork: alert.network,
      formCondition: alert.conditionConfig,
      formCooldown: alert.cooldownSeconds,
      // Channels need to be fetched separately since AlertResponse only has summary
      formChannels: [],
      formErrors: {},
    });
  },

  validateForm: () => {
    const state = get();
    const errors: Record<string, string> = {};

    if (!state.formName.trim()) {
      errors.name = 'Name is required';
    } else if (state.formName.length > 100) {
      errors.name = 'Name must be 100 characters or less';
    }

    if (!state.formCondition) {
      errors.condition = 'Please configure a condition';
    }

    if (state.formChannels.length === 0) {
      errors.channels = 'Please add at least one notification channel';
    }

    if (state.formCooldown < 0 || state.formCooldown > 86400) {
      errors.cooldown = 'Cooldown must be between 0 and 86400 seconds';
    }

    const isValid = Object.keys(errors).length === 0;
    set({ formErrors: errors });
    return isValid;
  },

  // UI actions
  setSelectedAlert: (selectedAlert) => set({ selectedAlert }),
  clearError: () => set({ error: null }),
  clearTestResults: () => set({ testResults: null }),
}));
