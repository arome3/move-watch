'use client';

import { useState } from 'react';
import { useSimulatorStore, type DemoPreset } from '@/stores/simulator';

// Demo presets showcasing different scenarios on Movement Network
const DEMO_PRESETS: DemoPreset[] = [
  // ============================================================================
  // MOVEMENT NETWORK - SUCCESS SCENARIOS
  // ============================================================================
  {
    id: 'move-transfer',
    name: 'MOVE Token Transfer',
    description: 'Transfer MOVE tokens on Movement Network',
    category: 'success',
    moduleAddress: '0x1',
    moduleName: 'coin',
    functionName: 'transfer',
    typeArguments: ['0x1::aptos_coin::AptosCoin'], // MOVE uses AptosCoin type
    arguments: [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '100000000', // 1 MOVE (8 decimals)
    ],
    expectedResult: 'success',
  },
  {
    id: 'account-create',
    name: 'Create Account',
    description: 'Create a new account on Movement',
    category: 'success',
    moduleAddress: '0x1',
    moduleName: 'aptos_account',
    functionName: 'create_account',
    typeArguments: [],
    arguments: ['0x0000000000000000000000000000000000000000000000000000000000000002'],
    expectedResult: 'success',
  },
  {
    id: 'register-coin',
    name: 'Register Coin',
    description: 'Register to receive a new coin type',
    category: 'success',
    moduleAddress: '0x1',
    moduleName: 'managed_coin',
    functionName: 'register',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: [],
    expectedResult: 'success',
  },
  {
    id: 'batch-transfer',
    name: 'Batch Transfer Setup',
    description: 'Transfer and create account in one tx',
    category: 'success',
    moduleAddress: '0x1',
    moduleName: 'aptos_account',
    functionName: 'transfer',
    typeArguments: [],
    arguments: [
      '0x0000000000000000000000000000000000000000000000000000000000000003',
      '50000000', // 0.5 MOVE
    ],
    expectedResult: 'success',
  },

  // ============================================================================
  // ERROR SCENARIOS - Balance & Resource
  // ============================================================================
  {
    id: 'insufficient-balance',
    name: 'Insufficient Balance',
    description: 'Transfer more MOVE than available',
    category: 'error',
    moduleAddress: '0x1',
    moduleName: 'coin',
    functionName: 'transfer',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '999999999999999999', // Very large amount
    ],
    expectedResult: 'failure',
    expectedError: 'INSUFFICIENT_BALANCE',
  },
  {
    id: 'module-not-found',
    name: 'Module Not Found',
    description: 'Call a non-existent module',
    category: 'error',
    moduleAddress: '0x1',
    moduleName: 'nonexistent_module',
    functionName: 'do_something',
    typeArguments: [],
    arguments: [],
    expectedResult: 'failure',
    expectedError: 'MODULE_NOT_FOUND',
  },
  {
    id: 'function-not-found',
    name: 'Function Not Found',
    description: 'Call a non-existent function',
    category: 'error',
    moduleAddress: '0x1',
    moduleName: 'coin',
    functionName: 'nonexistent_function',
    typeArguments: [],
    arguments: [],
    expectedResult: 'failure',
    expectedError: 'FUNCTION_NOT_FOUND',
  },

  // ============================================================================
  // VALIDATION ERRORS
  // ============================================================================
  {
    id: 'invalid-address',
    name: 'Invalid Address',
    description: 'Call with malformed address argument',
    category: 'validation',
    moduleAddress: '0x1',
    moduleName: 'coin',
    functionName: 'transfer',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: [
      'not_a_valid_address', // Invalid address format
      '1000',
    ],
    expectedResult: 'failure',
    expectedError: 'INVALID_ARGUMENT',
  },
  {
    id: 'wrong-type-arg',
    name: 'Wrong Type Argument',
    description: 'Use incorrect type argument for function',
    category: 'validation',
    moduleAddress: '0x1',
    moduleName: 'coin',
    functionName: 'transfer',
    typeArguments: ['0x1::fake_module::FakeCoin'], // Non-existent type
    arguments: [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '1000',
    ],
    expectedResult: 'failure',
    expectedError: 'TYPE_MISMATCH',
  },
  {
    id: 'zero-transfer',
    name: 'Zero Amount Transfer',
    description: 'Transfer zero tokens (may fail validation)',
    category: 'validation',
    moduleAddress: '0x1',
    moduleName: 'coin',
    functionName: 'transfer',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0', // Zero amount
    ],
    expectedResult: 'failure',
    expectedError: 'INVALID_AMOUNT',
  },

  // ============================================================================
  // PERMISSION ERRORS
  // ============================================================================
  {
    id: 'unauthorized-mint',
    name: 'Unauthorized Mint',
    description: 'Attempt to mint without permission',
    category: 'permission',
    moduleAddress: '0x1',
    moduleName: 'aptos_coin',
    functionName: 'mint',
    typeArguments: [],
    arguments: [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '1000000',
    ],
    expectedResult: 'failure',
    expectedError: 'UNAUTHORIZED',
  },
  {
    id: 'freeze-account',
    name: 'Freeze Account (Admin)',
    description: 'Attempt to freeze without admin rights',
    category: 'permission',
    moduleAddress: '0x1',
    moduleName: 'coin',
    functionName: 'freeze_coin_store',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    ],
    expectedResult: 'failure',
    expectedError: 'NOT_AUTHORIZED',
  },
];

// Category colors and icons
const CATEGORY_STYLES = {
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  permission: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9-6a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  validation: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
};

export function DemoPresets() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { loadPreset } = useSimulatorStore();

  const categories = [
    { id: 'success', label: 'Success', count: DEMO_PRESETS.filter((p) => p.category === 'success').length },
    { id: 'error', label: 'Errors', count: DEMO_PRESETS.filter((p) => p.category === 'error').length },
    { id: 'permission', label: 'Permission', count: DEMO_PRESETS.filter((p) => p.category === 'permission').length },
    { id: 'validation', label: 'Validation', count: DEMO_PRESETS.filter((p) => p.category === 'validation').length },
  ];

  const filteredPresets = selectedCategory
    ? DEMO_PRESETS.filter((p) => p.category === selectedCategory)
    : DEMO_PRESETS;

  const handleSelectPreset = (preset: DemoPreset) => {
    loadPreset(preset);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-500/10 border border-primary-500/30 text-primary-400 rounded-lg hover:bg-primary-500/20 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        Demo Presets
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <div className="absolute left-0 top-full mt-2 z-50 w-96 bg-dark-800 border border-dark-700 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-dark-700">
              <h3 className="text-sm font-medium text-dark-50">Demo Transactions</h3>
              <p className="text-xs text-dark-500 mt-1">
                Pre-configured scenarios to showcase simulator features
              </p>
            </div>

            {/* Category Filter */}
            <div className="p-2 border-b border-dark-700 flex gap-1 overflow-x-auto">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-2 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                  selectedCategory === null
                    ? 'bg-dark-600 text-dark-50'
                    : 'text-dark-400 hover:text-dark-200'
                }`}
              >
                All ({DEMO_PRESETS.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-dark-600 text-dark-50'
                      : 'text-dark-400 hover:text-dark-200'
                  }`}
                >
                  {cat.label} ({cat.count})
                </button>
              ))}
            </div>

            {/* Preset List */}
            <div className="max-h-80 overflow-y-auto">
              {filteredPresets.map((preset) => {
                const style = CATEGORY_STYLES[preset.category];
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className="w-full p-3 text-left hover:bg-dark-700/50 transition-colors border-b border-dark-700/50 last:border-0"
                  >
                    <div className="flex items-start gap-3">
                      {/* Category Icon */}
                      <div className={`p-1.5 rounded-lg ${style.bg} ${style.text}`}>
                        {style.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-dark-100">
                            {preset.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] rounded ${style.bg} ${style.border} ${style.text}`}
                          >
                            {preset.expectedResult === 'success' ? 'Success' : 'Fails'}
                          </span>
                        </div>
                        <p className="text-xs text-dark-500 mt-0.5">{preset.description}</p>
                        <p className="text-[10px] text-dark-600 mt-1 font-mono truncate">
                          {preset.moduleAddress}::{preset.moduleName}::{preset.functionName}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-dark-700 bg-dark-900/50">
              <p className="text-[10px] text-dark-600 text-center">
                Click a preset to load it into the Transaction Builder
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
