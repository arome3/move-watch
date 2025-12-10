import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Network, SimulationRequest, SimulationResponse } from '@movewatch/shared';

interface SimulatorState {
  // Form state
  network: Network;
  moduleAddress: string;
  moduleName: string;
  functionName: string;
  typeArguments: string[];
  argumentsJson: string;
  maxGasAmount: number;
  gasUnitPrice: number;
  sender: string;

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
  setMaxGasAmount: (amount: number) => void;
  setGasUnitPrice: (price: number) => void;
  setSender: (address: string) => void;

  setResult: (result: SimulationResponse | null) => void;
  setLoading: (loading: boolean) => void;

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
  maxGasAmount: 100000,
  gasUnitPrice: 100,
  sender: '',
  isValid: true,
  errors: {},
  result: null,
  isLoading: false,
};

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

      setMaxGasAmount: (maxGasAmount) => set({ maxGasAmount }),
      setGasUnitPrice: (gasUnitPrice) => set({ gasUnitPrice }),
      setSender: (sender) => set({ sender: sender.toLowerCase() }),

      setResult: (result) => set({ result }),
      setLoading: (isLoading) => set({ isLoading }),

      buildRequest: () => {
        const state = get();
        let args: unknown[] = [];

        try {
          args = JSON.parse(state.argumentsJson);
        } catch {
          args = [];
        }

        return {
          network: state.network,
          sender: state.sender || undefined,
          payload: {
            function: `${state.moduleAddress}::${state.moduleName}::${state.functionName}`,
            type_arguments: state.typeArguments.filter(Boolean),
            arguments: args,
          },
          options: {
            max_gas_amount: state.maxGasAmount,
            gas_unit_price: state.gasUnitPrice,
          },
        };
      },

      reset: () =>
        set({
          ...initialState,
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
