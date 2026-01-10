'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGuardianStore } from '@/stores/guardian';
import { NETWORK_CONFIGS, type Network } from '@movewatch/shared';
import {
  listAccountModules,
  getModuleFunctions,
  getFunctionDetails,
  type FunctionInfo,
} from '@/lib/api';
import { useDebouncedCallback } from 'use-debounce';

const NETWORKS: { value: Network; label: string }[] = [
  { value: 'testnet', label: NETWORK_CONFIGS.testnet.name },
  { value: 'mainnet', label: NETWORK_CONFIGS.mainnet.name },
  { value: 'devnet', label: NETWORK_CONFIGS.devnet.name },
];

interface GuardianFormProps {
  onAnalyze: () => Promise<void>;
  isLoading: boolean;
}

export function GuardianForm({ onAnalyze, isLoading }: GuardianFormProps) {
  const {
    network,
    moduleAddress,
    moduleName,
    functionName,
    typeArguments,
    argumentsJson,
    sender,
    isValid,
    errors,
    setNetwork,
    setModuleAddress,
    setModuleName,
    setFunctionName,
    addTypeArgument,
    removeTypeArgument,
    setTypeArgument,
    setArgumentsJson,
    setSender,
  } = useGuardianStore();

  // State for dropdowns and loading
  const [accountModules, setAccountModules] = useState<string[]>([]);
  const [functions, setFunctions] = useState<FunctionInfo[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<FunctionInfo | null>(null);
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  const [isLoadingFunctions, setIsLoadingFunctions] = useState(false);
  const [showModuleDropdown, setShowModuleDropdown] = useState(false);
  const [showFunctionDropdown, setShowFunctionDropdown] = useState(false);

  // Refs to prevent infinite loops
  const lastFetchedRef = useRef<{ address: string; module: string; func: string; network: string } | null>(null);
  const moduleNameContainerRef = useRef<HTMLDivElement>(null);
  const functionContainerRef = useRef<HTMLDivElement>(null);

  // Load account modules when address changes (debounced)
  const loadAccountModules = useDebouncedCallback(async (address: string, currentNetwork: string) => {
    if (!address.match(/^0x[a-fA-F0-9]+$/)) {
      setAccountModules([]);
      return;
    }

    setIsLoadingModules(true);
    try {
      const modules = await listAccountModules(currentNetwork as Network, address);
      setAccountModules(modules);
    } catch (err) {
      console.error('Failed to load modules:', err);
      setAccountModules([]);
    } finally {
      setIsLoadingModules(false);
    }
  }, 500);

  // Load functions when module changes (debounced)
  const loadFunctions = useDebouncedCallback(async (address: string, module: string, currentNetwork: string) => {
    if (!address || !module) {
      setFunctions([]);
      return;
    }

    setIsLoadingFunctions(true);
    try {
      const funcs = await getModuleFunctions(currentNetwork as Network, address, module, 'entry');
      setFunctions(funcs);
    } catch (err) {
      console.error('Failed to load functions:', err);
      setFunctions([]);
    } finally {
      setIsLoadingFunctions(false);
    }
  }, 500);

  // Load function details (display only, no store modification)
  const loadFunctionInfo = useCallback(async (address: string, module: string, func: string, currentNetwork: string) => {
    if (!address || !module || !func) {
      setSelectedFunction(null);
      return;
    }

    // Skip if we already fetched this combination
    const cacheKey = `${address}::${module}::${func}::${currentNetwork}`;
    if (lastFetchedRef.current &&
        lastFetchedRef.current.address === address &&
        lastFetchedRef.current.module === module &&
        lastFetchedRef.current.func === func &&
        lastFetchedRef.current.network === currentNetwork) {
      return;
    }

    try {
      const details = await getFunctionDetails(currentNetwork as Network, address, module, func);
      if (details) {
        setSelectedFunction(details.function);
        lastFetchedRef.current = { address, module, func, network: currentNetwork };
      }
    } catch (err) {
      console.error('Failed to load function details:', err);
      setSelectedFunction(null);
    }
  }, []);

  // Auto-populate form when user selects a function from dropdown
  const handleSelectFunction = async (func: FunctionInfo) => {
    setFunctionName(func.name);
    setShowFunctionDropdown(false);
    setSelectedFunction(func);

    // Auto-populate type arguments and arguments
    try {
      const details = await getFunctionDetails(network, moduleAddress, moduleName, func.name);
      if (details) {
        const store = useGuardianStore.getState();

        // Clear existing type arguments (use getState to get fresh count each time)
        const currentCount = store.typeArguments.length;
        for (let i = currentCount - 1; i >= 0; i--) {
          store.removeTypeArgument(i);
        }

        // Add empty type args based on function's type parameters
        for (let i = 0; i < details.function.typeParameters; i++) {
          store.addTypeArgument();
        }

        // Update arguments placeholder based on params (excluding &signer)
        const nonSignerFields = details.argumentFields.filter(f => f.type !== '&signer' && f.type !== 'signer');
        if (nonSignerFields.length > 0) {
          const placeholderArgs = nonSignerFields.map((field) => {
            if (field.type.includes('address')) return '"0x1"';
            if (field.type.includes('u64') || field.type.includes('u128') || field.type.includes('u256')) return '0';
            if (field.type === 'bool') return 'false';
            if (field.type.includes('vector')) return '[]';
            if (field.type.includes('Object')) return '"0x1"';
            return '""';
          });
          store.setArgumentsJson(`[${placeholderArgs.join(', ')}]`);
        } else {
          store.setArgumentsJson('[]');
        }

        lastFetchedRef.current = { address: moduleAddress, module: moduleName, func: func.name, network };
      }
    } catch (err) {
      console.error('Failed to auto-populate function details:', err);
    }
  };

  // Effect: Load modules when address changes
  useEffect(() => {
    if (moduleAddress) {
      loadAccountModules(moduleAddress, network);
    }
  }, [moduleAddress, network]);

  // Effect: Load functions when module changes
  useEffect(() => {
    if (moduleAddress && moduleName) {
      loadFunctions(moduleAddress, moduleName, network);
    }
  }, [moduleAddress, moduleName, network]);

  // Effect: Load function info (display only) when function changes
  useEffect(() => {
    if (moduleAddress && moduleName && functionName) {
      loadFunctionInfo(moduleAddress, moduleName, functionName, network);
    }
  }, [moduleAddress, moduleName, functionName, network, loadFunctionInfo]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!moduleNameContainerRef.current?.contains(e.target as Node)) {
        setShowModuleDropdown(false);
      }
      if (!functionContainerRef.current?.contains(e.target as Node)) {
        setShowFunctionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;
    await onAnalyze();
  };

  const handleSelectModule = (module: string) => {
    setModuleName(module);
    setShowModuleDropdown(false);
    setFunctionName(''); // Clear function when module changes
    setSelectedFunction(null);
    lastFetchedRef.current = null;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Network Selection */}
      <div className="space-y-2">
        <label htmlFor="network" className="block text-sm font-medium text-dark-300">
          Network
        </label>
        <select
          id="network"
          value={network}
          onChange={(e) => setNetwork(e.target.value as Network)}
          className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-100
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          {NETWORKS.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </select>
      </div>

      {/* Function Path */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-dark-300">Function Path</label>
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-center">
          {/* Module Address */}
          <div className="relative">
            <input
              type="text"
              value={moduleAddress}
              onChange={(e) => setModuleAddress(e.target.value)}
              placeholder="0x1"
              className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm text-dark-100 font-mono
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         ${errors.moduleAddress ? 'border-red-500' : 'border-dark-700'}`}
            />
            {isLoadingModules && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <svg className="animate-spin h-4 w-4 text-dark-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
          </div>
          <span className="text-dark-500 font-mono text-sm">::</span>

          {/* Module Name with Dropdown */}
          <div ref={moduleNameContainerRef} className="relative">
            <input
              type="text"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              onFocus={() => accountModules.length > 0 && setShowModuleDropdown(true)}
              placeholder="module"
              className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm text-dark-100 font-mono
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-8
                         ${errors.moduleName ? 'border-red-500' : 'border-dark-700'}`}
            />
            {accountModules.length > 0 && (
              <button
                type="button"
                onClick={() => setShowModuleDropdown(!showModuleDropdown)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {/* Module Dropdown */}
            {showModuleDropdown && accountModules.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {accountModules
                  .filter(mod => mod.toLowerCase().includes(moduleName.toLowerCase()))
                  .slice(0, 20)
                  .map((mod) => (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => handleSelectModule(mod)}
                    className={`w-full px-3 py-2 text-left text-sm font-mono hover:bg-dark-700 transition-colors
                               ${mod === moduleName ? 'bg-dark-700 text-primary-400' : 'text-dark-100'}`}
                  >
                    {mod}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-dark-500 font-mono text-sm">::</span>

          {/* Function Name with Dropdown */}
          <div ref={functionContainerRef} className="relative">
            <input
              type="text"
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value)}
              onFocus={() => functions.length > 0 && setShowFunctionDropdown(true)}
              placeholder="function"
              className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm text-dark-100 font-mono
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-8
                         ${errors.functionName ? 'border-red-500' : 'border-dark-700'}`}
            />
            {isLoadingFunctions && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <svg className="animate-spin h-4 w-4 text-dark-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
            {!isLoadingFunctions && functions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFunctionDropdown(!showFunctionDropdown)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {/* Function Dropdown */}
            {showFunctionDropdown && functions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-xl max-h-64 overflow-y-auto min-w-[250px]">
                {functions
                  .filter(f => f.name.toLowerCase().includes(functionName.toLowerCase()))
                  .map((func) => (
                  <button
                    key={func.name}
                    type="button"
                    onClick={() => handleSelectFunction(func)}
                    className={`w-full px-3 py-2 text-left hover:bg-dark-700 transition-colors
                               ${func.name === functionName ? 'bg-dark-700' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                        func.isEntry ? 'bg-green-500/10 text-green-400' :
                        func.isView ? 'bg-blue-500/10 text-blue-400' :
                        'bg-dark-600 text-dark-300'
                      }`}>
                        {func.isEntry ? 'entry' : func.isView ? 'view' : 'public'}
                      </span>
                      <span className="text-sm font-mono text-dark-100">{func.name}</span>
                    </div>
                    <div className="text-xs text-dark-500 mt-1 font-mono truncate">
                      {func.signature}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {(errors.moduleAddress || errors.moduleName || errors.functionName) && (
          <p className="text-xs text-red-400">
            {errors.moduleAddress || errors.moduleName || errors.functionName}
          </p>
        )}
      </div>

      {/* Selected Function Info */}
      {selectedFunction && (
        <div className="bg-dark-900/30 border border-dark-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded ${
              selectedFunction.isEntry ? 'bg-green-500/10 text-green-400' :
              selectedFunction.isView ? 'bg-blue-500/10 text-blue-400' :
              'bg-dark-600 text-dark-300'
            }`}>
              {selectedFunction.isEntry ? 'Entry' : selectedFunction.isView ? 'View' : 'Public'}
            </span>
            {selectedFunction.typeParameters > 0 && (
              <span className="px-2 py-0.5 text-xs bg-purple-500/10 text-purple-400 rounded">
                {selectedFunction.typeParameters} Type Params
              </span>
            )}
          </div>
          <div className="text-xs text-dark-400 font-mono bg-dark-900 rounded px-2 py-1 overflow-x-auto">
            {selectedFunction.signature}
          </div>
        </div>
      )}

      {/* Type Arguments */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-dark-300">Type Arguments</label>
          <button
            type="button"
            onClick={addTypeArgument}
            className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            + Add
          </button>
        </div>
        {typeArguments.length === 0 ? (
          <p className="text-xs text-dark-500 italic">No type arguments</p>
        ) : (
          <div className="space-y-2">
            {typeArguments.map((arg, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={arg}
                  onChange={(e) => setTypeArgument(index, e.target.value)}
                  placeholder="0x1::coin::CoinType"
                  className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-100 font-mono
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => removeTypeArgument(index)}
                  className="text-dark-500 hover:text-red-400 transition-colors px-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Function Arguments */}
      <div className="space-y-2">
        <label htmlFor="arguments" className="block text-sm font-medium text-dark-300">
          Arguments (JSON)
        </label>
        <textarea
          id="arguments"
          value={argumentsJson}
          onChange={(e) => setArgumentsJson(e.target.value)}
          placeholder='["arg1", 100, true]'
          rows={3}
          className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm text-dark-100 font-mono
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none
                     ${errors.argumentsJson ? 'border-red-500' : 'border-dark-700'}`}
        />
        {errors.argumentsJson && <p className="text-xs text-red-400">{errors.argumentsJson}</p>}
      </div>

      {/* Sender (optional) */}
      <div className="space-y-2">
        <label htmlFor="sender" className="block text-sm font-medium text-dark-300">
          Sender Address <span className="text-dark-500">(optional)</span>
        </label>
        <input
          id="sender"
          type="text"
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          placeholder="0x..."
          className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm text-dark-100 font-mono
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     ${errors.sender ? 'border-red-500' : 'border-dark-700'}`}
        />
        {errors.sender && <p className="text-xs text-red-400">{errors.sender}</p>}
      </div>

      {/* Analyze Button */}
      <button
        type="submit"
        disabled={!isValid || isLoading}
        className={`w-full py-3 px-4 rounded-xl font-medium text-sm transition-all mt-4
                   flex items-center justify-center gap-2
                   ${
                     isValid && !isLoading
                       ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/25'
                       : 'bg-dark-700 text-dark-500 cursor-not-allowed'
                   }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Analyzing...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Analyze Transaction
          </>
        )}
      </button>

      {/* Pricing info */}
      <p className="text-center text-xs text-dark-500">
        0.005 MOVE per analysis | 5 free per day
      </p>
    </form>
  );
}
