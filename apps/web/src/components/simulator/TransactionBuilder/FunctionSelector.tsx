'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSimulatorStore } from '@/stores/simulator';
import {
  getPopularModules,
  searchModules,
  listAccountModules,
  getModuleFunctions,
  getFunctionDetails,
  type PopularModule,
  type ModuleSearchResult,
  type FunctionInfo,
  type ArgumentField,
} from '@/lib/api';
import { useDebouncedCallback } from 'use-debounce';

interface ModuleSuggestion {
  address: string;
  name: string;
  description?: string;
  isPopular?: boolean;
}

// Helper to determine input type based on Move type
function getInputTypeForMoveType(moveType: string): 'text' | 'number' | 'boolean' | 'address' | 'array' | 'object' {
  const type = moveType.toLowerCase();
  if (type === 'address' || type.includes('address')) return 'address';
  if (type === 'bool') return 'boolean';
  if (type.startsWith('u') && !type.includes('vector')) return 'number';
  if (type.includes('vector') || type.includes('[]')) return 'array';
  if (type.includes('struct') || type.includes('{')) return 'object';
  return 'text';
}

// Helper to get placeholder text based on Move type
function getPlaceholderForType(moveType: string): string {
  const type = moveType.toLowerCase();
  if (type === 'address' || type.includes('address')) return '0x1...';
  if (type === 'bool') return 'true or false';
  if (type === 'u8') return '0-255';
  if (type === 'u16') return '0-65535';
  if (type === 'u32') return '0-4294967295';
  if (type === 'u64') return '0 (e.g., 1000000)';
  if (type === 'u128') return '0';
  if (type === 'u256') return '0';
  if (type.includes('vector<u8>')) return '0x... (hex bytes)';
  if (type.includes('vector')) return '["item1", "item2"]';
  if (type.includes('string') || type === '0x1::string::String') return 'Enter text...';
  return 'Enter value...';
}

export function FunctionSelector() {
  const {
    network,
    moduleAddress,
    moduleName,
    functionName,
    setModuleAddress,
    setModuleName,
    setFunctionName,
    setArgumentsJson,
    setTypeArgument,
    setArgumentFields: setStoreArgumentFields,
    errors,
  } = useSimulatorStore();

  // State for suggestions and dropdowns
  const [showModuleSuggestions, setShowModuleSuggestions] = useState(false);
  const [moduleSuggestions, setModuleSuggestions] = useState<ModuleSuggestion[]>([]);
  const [popularModules, setPopularModules] = useState<PopularModule[]>([]);
  const [accountModules, setAccountModules] = useState<string[]>([]);
  const [functions, setFunctions] = useState<FunctionInfo[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<FunctionInfo | null>(null);
  const [localArgumentFields, setLocalArgumentFields] = useState<ArgumentField[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  const [isLoadingFunctions, setIsLoadingFunctions] = useState(false);
  const [showFunctionDropdown, setShowFunctionDropdown] = useState(false);
  const [showModuleDropdown, setShowModuleDropdown] = useState(false);

  const moduleInputRef = useRef<HTMLInputElement>(null);
  const moduleNameInputRef = useRef<HTMLInputElement>(null);
  const functionInputRef = useRef<HTMLInputElement>(null);
  const moduleNameContainerRef = useRef<HTMLDivElement>(null);
  const functionContainerRef = useRef<HTMLDivElement>(null);

  // Load popular modules on mount
  useEffect(() => {
    getPopularModules().then(setPopularModules);
  }, []);

  // Debounced search for module suggestions
  const searchModuleSuggestions = useDebouncedCallback(async (query: string) => {
    if (query.length < 2) {
      setModuleSuggestions(
        popularModules.map((m) => ({ ...m, isPopular: true }))
      );
      return;
    }

    const results = await searchModules(network, query);
    setModuleSuggestions(results);
  }, 300);

  // Load account modules when address changes
  const loadAccountModules = useCallback(async (address: string) => {
    if (!address.match(/^0x[a-fA-F0-9]+$/)) {
      setAccountModules([]);
      return;
    }

    setIsLoadingModules(true);
    try {
      const modules = await listAccountModules(network, address);
      setAccountModules(modules);
    } finally {
      setIsLoadingModules(false);
    }
  }, [network]);

  // Load functions when module changes
  const loadFunctions = useCallback(async (address: string, module: string) => {
    if (!address || !module) {
      setFunctions([]);
      return;
    }

    setIsLoadingFunctions(true);
    try {
      const funcs = await getModuleFunctions(network, address, module, 'entry');
      setFunctions(funcs);
    } finally {
      setIsLoadingFunctions(false);
    }
  }, [network]);

  // Load function details when function changes
  const loadFunctionDetails = useCallback(async (address: string, module: string, func: string) => {
    if (!address || !module || !func) {
      setSelectedFunction(null);
      setLocalArgumentFields([]);
      setStoreArgumentFields([]);
      return;
    }

    const details = await getFunctionDetails(network, address, module, func);
    if (details) {
      setSelectedFunction(details.function);
      setLocalArgumentFields(details.argumentFields);

      // Update store with argument field info for ArgumentsEditor
      // The API's ArgumentField already has the fields we need
      setStoreArgumentFields(details.argumentFields.map((field, index) => ({
        index,
        name: field.name,
        type: field.type,
        inputType: field.inputType || getInputTypeForMoveType(field.type),
        placeholder: field.placeholder || getPlaceholderForType(field.type),
        description: field.description || `Argument ${index + 1}`,
        required: field.required ?? true,
      })));

      // Auto-populate type arguments if the function has type parameters
      if (details.function.typeParameters > 0) {
        // Keep existing type arguments or add empty ones
        const state = useSimulatorStore.getState();
        const currentTypeArgs = state.typeArguments;
        for (let i = currentTypeArgs.length; i < details.function.typeParameters; i++) {
          useSimulatorStore.getState().addTypeArgument();
        }
      }
    }
  }, [network, setStoreArgumentFields]);

  // Handle module address input change
  const handleAddressChange = (value: string) => {
    setModuleAddress(value);
    searchModuleSuggestions(value);

    // If value looks complete, load modules for this address
    if (value.match(/^0x[a-fA-F0-9]{1,64}$/)) {
      loadAccountModules(value);
    }
  };

  // Handle selecting a module suggestion
  const handleSelectSuggestion = (suggestion: ModuleSuggestion) => {
    setModuleAddress(suggestion.address);
    setModuleName(suggestion.name);
    setShowModuleSuggestions(false);
    loadAccountModules(suggestion.address);
    loadFunctions(suggestion.address, suggestion.name);
    functionInputRef.current?.focus();
  };

  // Handle module name change
  const handleModuleNameChange = (value: string) => {
    setModuleName(value);
    setFunctionName('');
    setFunctions([]);

    if (value && moduleAddress) {
      loadFunctions(moduleAddress, value);
    }
  };

  // Handle selecting a module from dropdown
  const handleSelectModule = (module: string) => {
    setModuleName(module);
    setShowModuleDropdown(false);
    loadFunctions(moduleAddress, module);
    functionInputRef.current?.focus();
  };

  // Handle function name change
  const handleFunctionNameChange = (value: string) => {
    setFunctionName(value);

    if (value && moduleAddress && moduleName) {
      loadFunctionDetails(moduleAddress, moduleName, value);
    }
  };

  // Handle selecting a function from dropdown
  const handleSelectFunction = (func: FunctionInfo) => {
    setFunctionName(func.name);
    setShowFunctionDropdown(false);
    setSelectedFunction(func);
    loadFunctionDetails(moduleAddress, moduleName, func.name);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!moduleInputRef.current?.contains(e.target as Node)) {
        setShowModuleSuggestions(false);
      }
      // Use container refs to properly detect clicks inside dropdowns
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

  return (
    <div className="space-y-4">
      {/* Module Address with Auto-complete */}
      <div className="space-y-2 relative">
        <label htmlFor="moduleAddress" className="block text-sm font-medium text-dark-300">
          Module Address
        </label>
        <div className="relative">
          <input
            ref={moduleInputRef}
            id="moduleAddress"
            type="text"
            value={moduleAddress}
            onChange={(e) => handleAddressChange(e.target.value)}
            onFocus={() => {
              setShowModuleSuggestions(true);
              if (!moduleAddress || moduleAddress.length < 2) {
                setModuleSuggestions(popularModules.map((m) => ({ ...m, isPopular: true })));
              }
            }}
            placeholder="0x1 or search by module name..."
            className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono text-dark-100
                       placeholder:text-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500
                       focus:border-transparent transition-colors pr-8
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
        {errors.moduleAddress && (
          <p className="text-xs text-red-400">{errors.moduleAddress}</p>
        )}

        {/* Module Suggestions Dropdown */}
        {showModuleSuggestions && moduleSuggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
            {moduleSuggestions.some((s) => s.isPopular) && (
              <div className="px-3 py-2 text-xs text-dark-500 border-b border-dark-700">
                Popular Modules
              </div>
            )}
            {moduleSuggestions.map((suggestion, idx) => (
              <button
                key={`${suggestion.address}-${suggestion.name}-${idx}`}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full px-3 py-2 text-left hover:bg-dark-700 flex items-center gap-3 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-dark-100 font-medium truncate">
                    {suggestion.name}
                  </div>
                  <div className="text-xs text-dark-500 font-mono truncate">
                    {suggestion.address}
                  </div>
                  {suggestion.description && (
                    <div className="text-xs text-dark-400 mt-0.5">
                      {suggestion.description}
                    </div>
                  )}
                </div>
                {suggestion.isPopular && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-primary-500/10 text-primary-400 rounded">
                    Popular
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Module Name & Function Name (side by side) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Module Name with Dropdown */}
        <div ref={moduleNameContainerRef} className="space-y-2 relative">
          <label htmlFor="moduleName" className="block text-sm font-medium text-dark-300">
            Module Name
          </label>
          <div className="relative">
            <input
              ref={moduleNameInputRef}
              id="moduleName"
              type="text"
              value={moduleName}
              onChange={(e) => handleModuleNameChange(e.target.value)}
              onFocus={() => accountModules.length > 0 && setShowModuleDropdown(true)}
              placeholder="coin"
              className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono text-dark-100
                         placeholder:text-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500
                         focus:border-transparent transition-colors
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
          </div>
          {errors.moduleName && (
            <p className="text-xs text-red-400">{errors.moduleName}</p>
          )}

          {/* Module Dropdown */}
          {showModuleDropdown && accountModules.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {accountModules.map((mod) => (
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

        {/* Function Name with Dropdown */}
        <div ref={functionContainerRef} className="space-y-2 relative">
          <label htmlFor="functionName" className="block text-sm font-medium text-dark-300">
            Function Name
          </label>
          <div className="relative">
            <input
              ref={functionInputRef}
              id="functionName"
              type="text"
              value={functionName}
              onChange={(e) => handleFunctionNameChange(e.target.value)}
              onFocus={() => functions.length > 0 && setShowFunctionDropdown(true)}
              placeholder="transfer"
              className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono text-dark-100
                         placeholder:text-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500
                         focus:border-transparent transition-colors
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
          </div>
          {errors.functionName && (
            <p className="text-xs text-red-400">{errors.functionName}</p>
          )}

          {/* Function Dropdown */}
          {showFunctionDropdown && functions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
              {functions.map((func) => (
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

      {/* Function path preview */}
      <div className="bg-dark-900/50 border border-dark-800 rounded-lg px-3 py-2">
        <span className="text-xs text-dark-500">Function path: </span>
        <code className="text-xs text-primary-400 font-mono">
          {moduleAddress}::{moduleName}::{functionName}
        </code>
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
              {selectedFunction.isEntry ? 'Entry Function' : selectedFunction.isView ? 'View Function' : 'Public Function'}
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
          {selectedFunction.description && (
            <p className="text-xs text-dark-400">{selectedFunction.description}</p>
          )}
          {localArgumentFields.length > 0 && (
            <div className="text-xs text-dark-500">
              {localArgumentFields.length} argument{localArgumentFields.length !== 1 ? 's' : ''} required
            </div>
          )}
        </div>
      )}
    </div>
  );
}
