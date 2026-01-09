import { create } from 'zustand';
import type {
  ActionResponse,
  ActionListItem,
  CreateActionRequest,
  UpdateActionRequest,
  ActionExecutionsResponse,
  TestActionResult,
  ActionSecretResponse,
  TriggerConfig,
  ActionTriggerType,
  Network,
} from '@movewatch/shared';
import * as actionsApi from '@/lib/actionsApi';

// Default TypeScript template for new actions
const DEFAULT_ACTION_CODE = `// Web3 Action - TypeScript Handler
// Access context via: ctx.triggerData, ctx.secrets, ctx.network

export default async function handler(ctx: ActionContext) {
  console.log('Action triggered:', ctx.triggerType);
  console.log('Trigger data:', ctx.triggerData);

  // Example: Read on-chain data
  // const resource = await ctx.movement.getResource(
  //   '0x1',
  //   '0x1::account::Account'
  // );

  // Example: Call a view function
  // const result = await ctx.movement.view({
  //   function: '0x1::coin::balance',
  //   typeArguments: ['0x1::aptos_coin::AptosCoin'],
  //   arguments: ['0x1'],
  // });

  // Example: Make an HTTP request
  // const response = await fetch('https://api.example.com/data');
  // const data = await response.json();

  // Return value will be stored in execution result
  return {
    success: true,
    message: 'Action executed successfully',
  };
}

// Type definitions (available globally)
interface ActionContext {
  actionId: string;
  executionId: string;
  network: 'mainnet' | 'testnet' | 'devnet';
  triggerType: 'event' | 'block' | 'schedule';
  triggerData: unknown;
  secrets: Record<string, string>;
  movement: {
    getResource: (address: string, resourceType: string) => Promise<unknown>;
    getResources: (address: string) => Promise<unknown[]>;
    view: (payload: ViewPayload) => Promise<unknown>;
    network: string;
  };
}

interface ViewPayload {
  function: string;
  typeArguments?: string[];
  arguments?: unknown[];
}
`;

interface ActionsState {
  // Data
  actions: ActionListItem[];
  selectedAction: ActionResponse | null;
  executions: ActionExecutionsResponse | null;
  secrets: ActionSecretResponse[];
  testResult: TestActionResult | null;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isTesting: boolean;
  isSavingSecret: boolean;

  // Error state
  error: string | null;

  // Form state for create/edit
  formName: string;
  formDescription: string;
  formCode: string;
  formNetwork: Network;
  formTriggerType: ActionTriggerType;
  formTriggerConfig: TriggerConfig | null;
  formMaxExecutionMs: number;
  formMemoryLimitMb: number;
  formCooldownSeconds: number;
  formErrors: Record<string, string>;

  // Actions - Data fetching
  fetchActions: () => Promise<void>;
  fetchAction: (id: string) => Promise<void>;
  fetchExecutions: (id: string, limit?: number, offset?: number) => Promise<void>;
  fetchSecrets: (id: string) => Promise<void>;

  // Actions - CRUD
  createAction: () => Promise<ActionResponse | null>;
  updateAction: (id: string, updates?: UpdateActionRequest) => Promise<ActionResponse | null>;
  deleteAction: (id: string) => Promise<boolean>;
  toggleAction: (id: string, enabled: boolean) => Promise<void>;
  testAction: (id: string, triggerData?: unknown) => Promise<void>;

  // Actions - Secrets
  setSecret: (actionId: string, name: string, value: string) => Promise<void>;
  deleteSecret: (actionId: string, name: string) => Promise<void>;

  // Actions - Form
  setFormName: (name: string) => void;
  setFormDescription: (description: string) => void;
  setFormCode: (code: string) => void;
  setFormNetwork: (network: Network) => void;
  setFormTriggerType: (type: ActionTriggerType) => void;
  setFormTriggerConfig: (config: TriggerConfig | null) => void;
  setFormMaxExecutionMs: (ms: number) => void;
  setFormMemoryLimitMb: (mb: number) => void;
  setFormCooldownSeconds: (seconds: number) => void;
  resetForm: () => void;
  loadActionToForm: (action: ActionResponse) => void;
  validateForm: () => boolean;

  // Actions - UI
  setSelectedAction: (action: ActionResponse | null) => void;
  clearError: () => void;
  clearTestResult: () => void;
}

const initialFormState = {
  formName: '',
  formDescription: '',
  formCode: DEFAULT_ACTION_CODE,
  formNetwork: 'testnet' as Network,
  formTriggerType: 'event' as ActionTriggerType,
  formTriggerConfig: null as TriggerConfig | null,
  formMaxExecutionMs: 30000,
  formMemoryLimitMb: 128,
  formCooldownSeconds: 60,
  formErrors: {} as Record<string, string>,
};

export const useActionsStore = create<ActionsState>()((set, get) => ({
  // Initial state
  actions: [],
  selectedAction: null,
  executions: null,
  secrets: [],
  testResult: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  isTesting: false,
  isSavingSecret: false,
  error: null,
  ...initialFormState,

  // Fetch all actions
  fetchActions: async () => {
    set({ isLoading: true, error: null });
    try {
      const actions = await actionsApi.fetchActions();
      set({ actions, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch actions',
        isLoading: false,
      });
    }
  },

  // Fetch single action
  fetchAction: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const action = await actionsApi.getAction(id);
      set({ selectedAction: action, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch action',
        isLoading: false,
      });
    }
  },

  // Fetch execution history
  fetchExecutions: async (id: string, limit = 10, offset = 0) => {
    set({ isLoading: true, error: null });
    try {
      const executions = await actionsApi.getExecutions(id, limit, offset);
      set({ executions, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch executions',
        isLoading: false,
      });
    }
  },

  // Fetch secrets
  fetchSecrets: async (id: string) => {
    try {
      const secrets = await actionsApi.getSecrets(id);
      set({ secrets });
    } catch (error) {
      console.error('Failed to fetch secrets:', error);
    }
  },

  // Create new action
  createAction: async () => {
    const state = get();

    if (!state.validateForm()) {
      return null;
    }

    if (!state.formTriggerConfig) {
      set({ formErrors: { ...state.formErrors, trigger: 'Please configure a trigger' } });
      return null;
    }

    set({ isCreating: true, error: null });

    try {
      const request: CreateActionRequest = {
        name: state.formName,
        description: state.formDescription || undefined,
        code: state.formCode,
        network: state.formNetwork,
        triggerType: state.formTriggerType,
        triggerConfig: state.formTriggerConfig,
        maxExecutionMs: state.formMaxExecutionMs,
        memoryLimitMb: state.formMemoryLimitMb,
        cooldownSeconds: state.formCooldownSeconds,
      };

      const action = await actionsApi.createAction(request);

      // Add to list (convert to list item)
      const listItem: ActionListItem = {
        id: action.id,
        name: action.name,
        description: action.description,
        enabled: action.enabled,
        network: action.network,
        triggerType: action.triggerType,
        lastExecutedAt: action.lastExecutedAt,
        executionCount: action.executionCount,
        successCount: action.successCount,
        failureCount: action.failureCount,
        createdAt: action.createdAt,
      };

      set((s) => ({
        actions: [listItem, ...s.actions],
        isCreating: false,
      }));

      // Reset form
      get().resetForm();

      return action;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create action',
        isCreating: false,
      });
      return null;
    }
  },

  // Update action
  updateAction: async (id: string, updates?: UpdateActionRequest) => {
    set({ isUpdating: true, error: null });

    try {
      const state = get();
      const updateData: UpdateActionRequest = updates || {
        name: state.formName,
        description: state.formDescription || undefined,
        code: state.formCode,
        network: state.formNetwork,
        triggerType: state.formTriggerType,
        triggerConfig: state.formTriggerConfig || undefined,
        maxExecutionMs: state.formMaxExecutionMs,
        memoryLimitMb: state.formMemoryLimitMb,
        cooldownSeconds: state.formCooldownSeconds,
      };

      const action = await actionsApi.updateAction(id, updateData);

      // Update in list
      const listItem: ActionListItem = {
        id: action.id,
        name: action.name,
        description: action.description,
        enabled: action.enabled,
        network: action.network,
        triggerType: action.triggerType,
        lastExecutedAt: action.lastExecutedAt,
        executionCount: action.executionCount,
        successCount: action.successCount,
        failureCount: action.failureCount,
        createdAt: action.createdAt,
      };

      set((s) => ({
        actions: s.actions.map((a) => (a.id === id ? listItem : a)),
        selectedAction: s.selectedAction?.id === id ? action : s.selectedAction,
        isUpdating: false,
      }));

      return action;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update action',
        isUpdating: false,
      });
      return null;
    }
  },

  // Delete action
  deleteAction: async (id: string) => {
    set({ isDeleting: true, error: null });

    try {
      await actionsApi.deleteAction(id);

      set((s) => ({
        actions: s.actions.filter((a) => a.id !== id),
        selectedAction: s.selectedAction?.id === id ? null : s.selectedAction,
        isDeleting: false,
      }));

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete action',
        isDeleting: false,
      });
      return false;
    }
  },

  // Toggle action enabled/disabled
  toggleAction: async (id: string, enabled: boolean) => {
    set({ isUpdating: true, error: null });

    try {
      const action = await actionsApi.toggleAction(id, enabled);

      const listItem: ActionListItem = {
        id: action.id,
        name: action.name,
        description: action.description,
        enabled: action.enabled,
        network: action.network,
        triggerType: action.triggerType,
        lastExecutedAt: action.lastExecutedAt,
        executionCount: action.executionCount,
        successCount: action.successCount,
        failureCount: action.failureCount,
        createdAt: action.createdAt,
      };

      set((s) => ({
        actions: s.actions.map((a) => (a.id === id ? listItem : a)),
        selectedAction: s.selectedAction?.id === id ? action : s.selectedAction,
        isUpdating: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to toggle action',
        isUpdating: false,
      });
    }
  },

  // Test action
  testAction: async (id: string, triggerData?: unknown) => {
    set({ isTesting: true, error: null, testResult: null });

    try {
      const result = await actionsApi.testAction(id, triggerData);
      set({ testResult: result, isTesting: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to test action',
        isTesting: false,
      });
    }
  },

  // Set secret
  setSecret: async (actionId: string, name: string, value: string) => {
    set({ isSavingSecret: true, error: null });

    try {
      await actionsApi.setSecret(actionId, { name, value });
      const secrets = await actionsApi.getSecrets(actionId);
      set({ secrets, isSavingSecret: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save secret',
        isSavingSecret: false,
      });
    }
  },

  // Delete secret
  deleteSecret: async (actionId: string, name: string) => {
    set({ isSavingSecret: true, error: null });

    try {
      await actionsApi.deleteSecret(actionId, name);
      set((s) => ({
        secrets: s.secrets.filter((sec) => sec.name !== name),
        isSavingSecret: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete secret',
        isSavingSecret: false,
      });
    }
  },

  // Form actions
  setFormName: (formName) => set({ formName }),
  setFormDescription: (formDescription) => set({ formDescription }),
  setFormCode: (formCode) => set({ formCode }),
  setFormNetwork: (formNetwork) => set({ formNetwork }),
  setFormTriggerType: (formTriggerType) => set({ formTriggerType, formTriggerConfig: null }),
  setFormTriggerConfig: (formTriggerConfig) => set({ formTriggerConfig }),
  setFormMaxExecutionMs: (formMaxExecutionMs) => set({ formMaxExecutionMs }),
  setFormMemoryLimitMb: (formMemoryLimitMb) => set({ formMemoryLimitMb }),
  setFormCooldownSeconds: (formCooldownSeconds) => set({ formCooldownSeconds }),

  resetForm: () => set(initialFormState),

  loadActionToForm: (action: ActionResponse) => {
    set({
      formName: action.name,
      formDescription: action.description || '',
      formCode: action.code,
      formNetwork: action.network,
      formTriggerType: action.triggerType,
      formTriggerConfig: action.triggerConfig,
      formMaxExecutionMs: action.maxExecutionMs,
      formMemoryLimitMb: action.memoryLimitMb,
      formCooldownSeconds: action.cooldownSeconds,
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

    if (!state.formCode.trim()) {
      errors.code = 'Code is required';
    }

    if (!state.formTriggerConfig) {
      errors.trigger = 'Please configure a trigger';
    }

    if (state.formMaxExecutionMs < 1000 || state.formMaxExecutionMs > 60000) {
      errors.maxExecutionMs = 'Timeout must be between 1 and 60 seconds';
    }

    if (state.formMemoryLimitMb < 32 || state.formMemoryLimitMb > 512) {
      errors.memoryLimitMb = 'Memory limit must be between 32 and 512 MB';
    }

    if (state.formCooldownSeconds < 0 || state.formCooldownSeconds > 86400) {
      errors.cooldownSeconds = 'Cooldown must be between 0 and 86400 seconds';
    }

    const isValid = Object.keys(errors).length === 0;
    set({ formErrors: errors });
    return isValid;
  },

  // UI actions
  setSelectedAction: (selectedAction) => set({ selectedAction }),
  clearError: () => set({ error: null }),
  clearTestResult: () => set({ testResult: null }),
}));

// Export the default code template
export { DEFAULT_ACTION_CODE };
