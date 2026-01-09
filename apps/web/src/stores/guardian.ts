import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Network,
  GuardianCheckRequest,
  GuardianCheckResponse,
  DemoTransaction,
  RiskPattern,
} from '@movewatch/shared';

interface GuardianState {
  // Form state
  network: Network;
  moduleAddress: string;
  moduleName: string;
  functionName: string;
  typeArguments: string[];
  argumentsJson: string;
  sender: string;

  // Demo transactions
  demoTransactions: DemoTransaction[];
  selectedDemoId: string | null;

  // Patterns
  patterns: RiskPattern[];
  patternsLoaded: boolean;

  // Analysis result
  result: GuardianCheckResponse | null;
  isAnalyzing: boolean;
  error: string | null;

  // History
  recentAnalyses: Array<{
    id: string;
    shareId: string;
    functionName: string;
    overallRisk: string;
    riskScore: number;
    createdAt: string;
  }>;

  // Validation
  isValid: boolean;
  errors: Record<string, string>;

  // Actions - Form
  setNetwork: (network: Network) => void;
  setModuleAddress: (address: string) => void;
  setModuleName: (name: string) => void;
  setFunctionName: (name: string) => void;
  addTypeArgument: () => void;
  removeTypeArgument: (index: number) => void;
  setTypeArgument: (index: number, value: string) => void;
  setArgumentsJson: (json: string) => void;
  setSender: (address: string) => void;

  // Actions - Demo
  setDemoTransactions: (demos: DemoTransaction[]) => void;
  selectDemo: (demoId: string | null) => void;
  loadDemoTransaction: (demo: DemoTransaction) => void;

  // Actions - Patterns
  setPatterns: (patterns: RiskPattern[]) => void;

  // Actions - Analysis
  setResult: (result: GuardianCheckResponse | null) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setError: (error: string | null) => void;
  addToHistory: (result: GuardianCheckResponse, functionName: string) => void;
  clearHistory: () => void;

  // Actions - Utils
  buildRequest: () => GuardianCheckRequest;
  reset: () => void;
  validate: () => boolean;
  getFullFunctionPath: () => string;
}

const initialState = {
  network: 'testnet' as Network,
  moduleAddress: '0x1',
  moduleName: 'coin',
  functionName: 'transfer',
  typeArguments: ['0x1::aptos_coin::AptosCoin'],
  argumentsJson: '["0x0000000000000000000000000000000000000000000000000000000000000001", "1000000"]',
  sender: '',
  demoTransactions: [] as DemoTransaction[],
  selectedDemoId: null as string | null,
  patterns: [] as RiskPattern[],
  patternsLoaded: false,
  result: null as GuardianCheckResponse | null,
  isAnalyzing: false,
  error: null as string | null,
  recentAnalyses: [] as Array<{
    id: string;
    shareId: string;
    functionName: string;
    overallRisk: string;
    riskScore: number;
    createdAt: string;
  }>,
  isValid: true,
  errors: {} as Record<string, string>,
};

export const useGuardianStore = create<GuardianState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Form actions
      setNetwork: (network) => {
        set({ network, selectedDemoId: null });
        get().validate();
      },

      setModuleAddress: (moduleAddress) => {
        // Keep original case - Move addresses are case-sensitive
        set({ moduleAddress, selectedDemoId: null });
        get().validate();
      },

      setModuleName: (moduleName) => {
        set({ moduleName, selectedDemoId: null });
        get().validate();
      },

      setFunctionName: (functionName) => {
        set({ functionName, selectedDemoId: null });
        get().validate();
      },

      addTypeArgument: () => {
        set((state) => ({
          typeArguments: [...state.typeArguments, ''],
          selectedDemoId: null,
        }));
      },

      removeTypeArgument: (index) => {
        set((state) => ({
          typeArguments: state.typeArguments.filter((_, i) => i !== index),
          selectedDemoId: null,
        }));
      },

      setTypeArgument: (index, value) => {
        set((state) => ({
          typeArguments: state.typeArguments.map((arg, i) => (i === index ? value : arg)),
          selectedDemoId: null,
        }));
      },

      setArgumentsJson: (argumentsJson) => {
        // Limit input size to prevent abuse (50KB max)
        const MAX_ARGUMENTS_SIZE = 50 * 1024;
        const truncated = argumentsJson.length > MAX_ARGUMENTS_SIZE
          ? argumentsJson.slice(0, MAX_ARGUMENTS_SIZE)
          : argumentsJson;
        set({ argumentsJson: truncated, selectedDemoId: null });
        get().validate();
      },

      setSender: (sender) => {
        // Keep original case - Move addresses are case-sensitive
        set({ sender, selectedDemoId: null });
      },

      // Demo actions
      setDemoTransactions: (demoTransactions) => set({ demoTransactions }),

      selectDemo: (demoId) => {
        const { demoTransactions, loadDemoTransaction } = get();
        const demo = demoTransactions.find((d) => d.id === demoId);
        if (demo) {
          loadDemoTransaction(demo);
        }
        set({ selectedDemoId: demoId });
      },

      loadDemoTransaction: (demo) => {
        // Parse function path: 0x1::module::function
        const pathMatch = demo.functionPath.match(/^(0x[a-fA-F0-9]+)::(\w+)::(\w+)$/);
        if (pathMatch) {
          set({
            network: demo.network,
            moduleAddress: pathMatch[1],
            moduleName: pathMatch[2],
            functionName: pathMatch[3],
            typeArguments: demo.typeArguments,
            argumentsJson: JSON.stringify(demo.arguments, null, 2),
            sender: demo.sender || '',
            result: null,
            error: null,
          });
        }
      },

      // Pattern actions
      setPatterns: (patterns) => set({ patterns, patternsLoaded: true }),

      // Analysis actions
      setResult: (result) => set({ result, error: null }),

      setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

      setError: (error) => set({ error, result: null }),

      addToHistory: (result, functionName) => {
        set((state) => ({
          recentAnalyses: [
            {
              id: result.id,
              shareId: result.shareId,
              functionName,
              overallRisk: result.overallRisk,
              riskScore: result.riskScore,
              createdAt: result.createdAt,
            },
            ...state.recentAnalyses.slice(0, 9), // Keep last 10
          ],
        }));
      },

      clearHistory: () => set({ recentAnalyses: [] }),

      // Utils
      getFullFunctionPath: () => {
        const { moduleAddress, moduleName, functionName } = get();
        return `${moduleAddress}::${moduleName}::${functionName}`;
      },

      buildRequest: (): GuardianCheckRequest => {
        const state = get();
        let args: unknown[] = [];

        try {
          args = JSON.parse(state.argumentsJson);
        } catch {
          args = [];
        }

        return {
          network: state.network,
          functionName: `${state.moduleAddress}::${state.moduleName}::${state.functionName}`,
          typeArguments: state.typeArguments.filter(Boolean),
          arguments: args,
          sender: state.sender || undefined,
        };
      },

      reset: () =>
        set({
          ...initialState,
          demoTransactions: get().demoTransactions, // Keep demos
          patterns: get().patterns, // Keep patterns
          patternsLoaded: get().patternsLoaded,
        }),

      validate: () => {
        const state = get();
        const errors: Record<string, string> = {};

        // Validate module address - allow short addresses like 0x1
        if (!state.moduleAddress.match(/^0x[a-fA-F0-9]+$/i)) {
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

        // Validate arguments JSON with size and depth checks
        const MAX_ARGUMENTS_SIZE = 50 * 1024;
        const MAX_NESTING_DEPTH = 10;

        if (state.argumentsJson.length > MAX_ARGUMENTS_SIZE) {
          errors.argumentsJson = `Arguments too large (max ${MAX_ARGUMENTS_SIZE / 1024}KB)`;
        } else {
          try {
            const parsed = JSON.parse(state.argumentsJson);
            if (!Array.isArray(parsed)) {
              errors.argumentsJson = 'Arguments must be an array';
            } else {
              // Check nesting depth
              const checkDepth = (obj: unknown, depth: number): boolean => {
                if (depth > MAX_NESTING_DEPTH) return false;
                if (typeof obj !== 'object' || obj === null) return true;
                if (Array.isArray(obj)) {
                  return obj.every((item) => checkDepth(item, depth + 1));
                }
                return Object.values(obj).every((val) => checkDepth(val, depth + 1));
              };
              if (!checkDepth(parsed, 0)) {
                errors.argumentsJson = `Arguments too deeply nested (max ${MAX_NESTING_DEPTH} levels)`;
              }
            }
          } catch {
            errors.argumentsJson = 'Invalid JSON format';
          }
        }

        // Validate sender if provided - allow short addresses like 0x1
        if (state.sender && !state.sender.match(/^0x[a-fA-F0-9]+$/i)) {
          errors.sender = 'Invalid sender address format';
        }

        const isValid = Object.keys(errors).length === 0;
        set({ errors, isValid });
        return isValid;
      },
    }),
    {
      name: 'movewatch-guardian',
      partialize: (state) => ({
        network: state.network,
        recentAnalyses: state.recentAnalyses,
      }),
    }
  )
);

// Selector for risk level color
export const getRiskColor = (risk: string): string => {
  switch (risk) {
    case 'CRITICAL':
      return 'text-red-500';
    case 'HIGH':
      return 'text-orange-500';
    case 'MEDIUM':
      return 'text-yellow-500';
    case 'LOW':
      return 'text-green-500';
    default:
      return 'text-gray-500';
  }
};

// Selector for risk level background
export const getRiskBgColor = (risk: string): string => {
  switch (risk) {
    case 'CRITICAL':
      return 'bg-red-500/10 border-red-500/30';
    case 'HIGH':
      return 'bg-orange-500/10 border-orange-500/30';
    case 'MEDIUM':
      return 'bg-yellow-500/10 border-yellow-500/30';
    case 'LOW':
      return 'bg-green-500/10 border-green-500/30';
    default:
      return 'bg-gray-500/10 border-gray-500/30';
  }
};

// Category icons mapping
export const getCategoryIcon = (category: string): string => {
  switch (category) {
    case 'EXPLOIT':
      return '🔓';
    case 'RUG_PULL':
      return '🚨';
    case 'EXCESSIVE_COST':
      return '💸';
    case 'PERMISSION':
      return '🔑';
    default:
      return '⚠️';
  }
};
