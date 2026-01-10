import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Network, SimulationRequest, SimulationResponse, StateOverride } from '@movewatch/shared';

// Argument field info from function signature
export interface ArgumentFieldInfo {
  index: number;
  name: string;
  type: string;
  inputType: 'text' | 'number' | 'boolean' | 'address' | 'array' | 'object';
  placeholder: string;
  description: string;
  required: boolean;
}

// Demo preset definition
export interface DemoPreset {
  id: string;
  name: string;
  description: string;
  category: 'success' | 'error' | 'permission' | 'validation';
  moduleAddress: string;
  moduleName: string;
  functionName: string;
  typeArguments: string[];
  arguments: unknown[];
  expectedResult: 'success' | 'failure';
  expectedError?: string;
}

// What-if scenario presets
export interface WhatIfScenario {
  id: string;
  name: string;
  description: string;
  gasMultiplier?: number;
  balanceOverride?: string;
}

interface SimulatorState {
  // Form state
  network: Network;
  moduleAddress: string;
  moduleName: string;
  functionName: string;
  typeArguments: string[];
  argumentsJson: string;
  argumentValues: string[]; // Individual argument values
  argumentFields: ArgumentFieldInfo[]; // Argument field metadata from function signature
  maxGasAmount: number;
  gasUnitPrice: number;
  sender: string;

  // Fork options
  forkEnabled: boolean;
  ledgerVersion: string;
  stateOverrides: StateOverride[];

  // What-if scenarios
  whatIfEnabled: boolean;
  gasMultiplier: number;

  // Detailed trace (CLI profiling)
  detailedTrace: boolean;

  // Validation
  isValid: boolean;
  errors: Record<string, string>;

  // Result
  result: SimulationResponse | null;
  isLoading: boolean;

  // Actions
  setNetwork: (network: Network) => void;
  setModuleAddress: (address: string) => void;
  setModuleName: (name: string) => void;
  setFunctionName: (name: string) => void;
  addTypeArgument: () => void;
  removeTypeArgument: (index: number) => void;
  setTypeArgument: (index: number, value: string) => void;
  setArgumentsJson: (json: string) => void;
  setArgumentFields: (fields: ArgumentFieldInfo[]) => void;
  setArgumentValue: (index: number, value: string) => void;
  syncArgumentsFromValues: () => void;
  setMaxGasAmount: (amount: number) => void;
  setGasUnitPrice: (price: number) => void;
  setSender: (address: string) => void;

  // Fork actions
  setForkEnabled: (enabled: boolean) => void;
  setLedgerVersion: (version: string) => void;
  addStateOverride: (override: StateOverride) => void;
  removeStateOverride: (index: number) => void;
  updateStateOverride: (index: number, override: StateOverride) => void;
  clearStateOverrides: () => void;

  // What-if actions
  setWhatIfEnabled: (enabled: boolean) => void;
  setGasMultiplier: (multiplier: number) => void;
  applyWhatIfScenario: (scenario: WhatIfScenario) => void;

  // Detailed trace actions
  setDetailedTrace: (enabled: boolean) => void;

  setResult: (result: SimulationResponse | null) => void;
  setLoading: (loading: boolean) => void;

  loadPreset: (preset: DemoPreset) => void;
  loadFromParams: (params: URLSearchParams) => void;
  getShareableUrl: () => string;
  buildRequest: () => SimulationRequest;
  reset: () => void;
  validate: () => boolean;
}

const initialState = {
  network: 'testnet' as Network,
  moduleAddress: '0x1',
  moduleName: 'coin',
  functionName: 'transfer',
  typeArguments: ['0x1::aptos_coin::AptosCoin'],
  argumentsJson: '["0x0000000000000000000000000000000000000000000000000000000000000001", "1000000"]',
  argumentValues: [] as string[],
  argumentFields: [] as ArgumentFieldInfo[],
  maxGasAmount: 100000,
  gasUnitPrice: 100,
  sender: '',

  // Fork options
  forkEnabled: false,
  ledgerVersion: '',
  stateOverrides: [] as StateOverride[],

  // What-if scenarios
  whatIfEnabled: false,
  gasMultiplier: 1,

  // Detailed trace (CLI profiling)
  detailedTrace: false,

  isValid: true,
  errors: {},
  result: null,
  isLoading: false,
};

// ============================================================================
// URL PARAMETER ENCODING/DECODING
// ============================================================================

export interface ShareableFormParams {
  n?: string; // network
  a?: string; // moduleAddress
  m?: string; // moduleName
  f?: string; // functionName
  t?: string; // typeArguments (JSON encoded)
  args?: string; // arguments (JSON encoded)
  s?: string; // sender
}

/**
 * Encode form state to URL-safe parameters
 */
export function encodeFormToUrl(state: Partial<typeof initialState>): string {
  const params = new URLSearchParams();

  if (state.network && state.network !== initialState.network) {
    params.set('n', state.network);
  }
  if (state.moduleAddress) params.set('a', state.moduleAddress);
  if (state.moduleName) params.set('m', state.moduleName);
  if (state.functionName) params.set('f', state.functionName);
  if (state.typeArguments && state.typeArguments.length > 0) {
    params.set('t', JSON.stringify(state.typeArguments));
  }
  if (state.argumentsJson && state.argumentsJson !== '[]') {
    // Compress the JSON by removing whitespace
    try {
      const parsed = JSON.parse(state.argumentsJson);
      params.set('args', JSON.stringify(parsed));
    } catch {
      params.set('args', state.argumentsJson);
    }
  }
  if (state.sender) params.set('s', state.sender);

  return params.toString();
}

/**
 * Decode URL parameters to form state
 */
export function decodeUrlToForm(searchParams: URLSearchParams): Partial<typeof initialState> {
  const result: Partial<typeof initialState> = {};

  const network = searchParams.get('n');
  if (network && ['mainnet', 'testnet', 'devnet'].includes(network)) {
    result.network = network as Network;
  }

  const moduleAddress = searchParams.get('a');
  if (moduleAddress) result.moduleAddress = moduleAddress;

  const moduleName = searchParams.get('m');
  if (moduleName) result.moduleName = moduleName;

  const functionName = searchParams.get('f');
  if (functionName) result.functionName = functionName;

  const typeArgs = searchParams.get('t');
  if (typeArgs) {
    try {
      result.typeArguments = JSON.parse(typeArgs);
    } catch {
      // Invalid JSON, ignore
    }
  }

  const args = searchParams.get('args');
  if (args) {
    try {
      // Validate it's valid JSON and format it
      const parsed = JSON.parse(args);
      result.argumentsJson = JSON.stringify(parsed, null, 2);
    } catch {
      result.argumentsJson = args;
    }
  }

  const sender = searchParams.get('s');
  if (sender) result.sender = sender;

  return result;
}

export const useSimulatorStore = create<SimulatorState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setNetwork: (network) => {
        set({ network });
        get().validate();
      },

      setModuleAddress: (moduleAddress) => {
        set({ moduleAddress: moduleAddress.toLowerCase() });
        get().validate();
      },

      setModuleName: (moduleName) => {
        set({ moduleName });
        get().validate();
      },

      setFunctionName: (functionName) => {
        set({ functionName });
        get().validate();
      },

      addTypeArgument: () => {
        set((state) => ({
          typeArguments: [...state.typeArguments, ''],
        }));
      },

      removeTypeArgument: (index) => {
        set((state) => ({
          typeArguments: state.typeArguments.filter((_, i) => i !== index),
        }));
      },

      setTypeArgument: (index, value) => {
        set((state) => ({
          typeArguments: state.typeArguments.map((arg, i) => (i === index ? value : arg)),
        }));
      },

      setArgumentsJson: (argumentsJson) => {
        set({ argumentsJson });
        get().validate();
      },

      setArgumentFields: (argumentFields) => {
        // Initialize argument values array when fields change
        const argumentValues = argumentFields.map(() => '');
        set({ argumentFields, argumentValues });
      },

      setArgumentValue: (index, value) => {
        set((state) => {
          const newValues = [...state.argumentValues];
          newValues[index] = value;
          return { argumentValues: newValues };
        });
        // Sync to JSON
        get().syncArgumentsFromValues();
      },

      syncArgumentsFromValues: () => {
        const state = get();
        if (state.argumentFields.length === 0) return;

        // Convert individual values to proper types based on field info
        const args = state.argumentValues.map((value, index) => {
          const field = state.argumentFields[index];
          if (!field || !value) return value;

          // Convert based on type
          if (field.type.startsWith('u') && !field.type.includes('vector')) {
            // Numeric types (u8, u64, u128, etc.) - keep as string for large numbers
            return value;
          }
          if (field.type === 'bool') {
            return value.toLowerCase() === 'true';
          }
          // Default: keep as string (addresses, vectors, etc.)
          return value;
        });

        set({ argumentsJson: JSON.stringify(args, null, 2) });
        get().validate();
      },

      setMaxGasAmount: (maxGasAmount) => set({ maxGasAmount }),
      setGasUnitPrice: (gasUnitPrice) => set({ gasUnitPrice }),
      setSender: (sender) => set({ sender: sender.toLowerCase() }),

      // Fork actions
      setForkEnabled: (forkEnabled) => set({ forkEnabled }),
      setLedgerVersion: (ledgerVersion) => set({ ledgerVersion }),
      addStateOverride: (override) =>
        set((state) => ({
          stateOverrides: [...state.stateOverrides, override],
        })),
      removeStateOverride: (index) =>
        set((state) => ({
          stateOverrides: state.stateOverrides.filter((_, i) => i !== index),
        })),
      updateStateOverride: (index, override) =>
        set((state) => ({
          stateOverrides: state.stateOverrides.map((o, i) => (i === index ? override : o)),
        })),
      clearStateOverrides: () => set({ stateOverrides: [] }),

      // What-if actions
      setWhatIfEnabled: (whatIfEnabled) => set({ whatIfEnabled }),
      setGasMultiplier: (gasMultiplier) => set({ gasMultiplier }),
      applyWhatIfScenario: (scenario) => {
        set((state) => ({
          whatIfEnabled: true,
          gasMultiplier: scenario.gasMultiplier ?? state.gasMultiplier,
          // Balance overrides would be added to stateOverrides
        }));
      },

      // Detailed trace actions
      setDetailedTrace: (detailedTrace) => set({ detailedTrace }),

      setResult: (result) => set({ result }),
      setLoading: (isLoading) => set({ isLoading }),

      loadPreset: (preset) => {
        set({
          moduleAddress: preset.moduleAddress,
          moduleName: preset.moduleName,
          functionName: preset.functionName,
          typeArguments: preset.typeArguments,
          argumentsJson: JSON.stringify(preset.arguments, null, 2),
          result: null, // Clear previous result
        });
        get().validate();
      },

      loadFromParams: (params) => {
        const decoded = decodeUrlToForm(params);
        if (Object.keys(decoded).length > 0) {
          set({
            ...decoded,
            result: null, // Clear previous result when loading from URL
          });
          get().validate();
        }
      },

      getShareableUrl: () => {
        const state = get();
        const params = encodeFormToUrl({
          network: state.network,
          moduleAddress: state.moduleAddress,
          moduleName: state.moduleName,
          functionName: state.functionName,
          typeArguments: state.typeArguments,
          argumentsJson: state.argumentsJson,
          sender: state.sender,
        });
        // Get the base URL from window.location
        if (typeof window !== 'undefined') {
          return `${window.location.origin}/simulator?${params}`;
        }
        return `/simulator?${params}`;
      },

      buildRequest: () => {
        const state = get();
        let args: unknown[] = [];

        try {
          args = JSON.parse(state.argumentsJson);
        } catch {
          args = [];
        }

        // Calculate effective gas price with what-if multiplier
        const effectiveGasPrice = state.whatIfEnabled
          ? Math.round(state.gasUnitPrice * state.gasMultiplier)
          : state.gasUnitPrice;

        const request: SimulationRequest = {
          network: state.network,
          sender: state.sender || undefined,
          payload: {
            function: `${state.moduleAddress}::${state.moduleName}::${state.functionName}`,
            type_arguments: state.typeArguments.filter(Boolean),
            arguments: args,
          },
          options: {
            max_gas_amount: state.maxGasAmount,
            gas_unit_price: effectiveGasPrice,
          },
        };

        // Add fork options if enabled
        if (state.forkEnabled) {
          if (state.ledgerVersion || state.stateOverrides.length > 0) {
            request.options = {
              ...request.options,
              ...(state.ledgerVersion && { ledger_version: state.ledgerVersion }),
              ...(state.stateOverrides.length > 0 && { state_overrides: state.stateOverrides }),
            };
          }
        }

        // Add detailed trace option if enabled
        if (state.detailedTrace) {
          request.options = {
            ...request.options,
            detailed_trace: true,
          };
        }

        return request;
      },

      reset: () =>
        set({
          ...initialState,
          // Reset argument fields
          argumentFields: [],
          argumentValues: [],
          // Reset fork options
          forkEnabled: false,
          ledgerVersion: '',
          stateOverrides: [],
          // Reset what-if options
          whatIfEnabled: false,
          gasMultiplier: 1,
          // Reset detailed trace
          detailedTrace: false,
          result: null,
          isLoading: false,
        }),

      validate: () => {
        const state = get();
        const errors: Record<string, string> = {};

        // Validate module address
        if (!state.moduleAddress.match(/^0x[a-fA-F0-9]+$/)) {
          errors.moduleAddress = 'Invalid address format (must start with 0x)';
        }

        // Validate module name
        if (!state.moduleName.match(/^\w+$/)) {
          errors.moduleName = 'Invalid module name (alphanumeric only)';
        }

        // Validate function name
        if (!state.functionName.match(/^\w+$/)) {
          errors.functionName = 'Invalid function name (alphanumeric only)';
        }

        // Validate arguments JSON
        try {
          const parsed = JSON.parse(state.argumentsJson);
          if (!Array.isArray(parsed)) {
            errors.argumentsJson = 'Arguments must be an array';
          }
        } catch {
          errors.argumentsJson = 'Invalid JSON format';
        }

        // Validate sender if provided
        if (state.sender && !state.sender.match(/^0x[a-fA-F0-9]{1,64}$/)) {
          errors.sender = 'Invalid sender address format';
        }

        const isValid = Object.keys(errors).length === 0;
        set({ errors, isValid });
        return isValid;
      },
    }),
    {
      name: 'movewatch-simulator',
      partialize: (state) => ({
        network: state.network,
        moduleAddress: state.moduleAddress,
        moduleName: state.moduleName,
        functionName: state.functionName,
        typeArguments: state.typeArguments,
        maxGasAmount: state.maxGasAmount,
        gasUnitPrice: state.gasUnitPrice,
      }),
    }
  )
);
