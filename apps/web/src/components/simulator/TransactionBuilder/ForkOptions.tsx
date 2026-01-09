'use client';

import { useState, useEffect } from 'react';
import { useSimulatorStore, WhatIfScenario } from '@/stores/simulator';

interface StateOverrideSupport {
  supported: boolean;
  method: string;
  version?: string;
  features: string[];
  limitations: string[];
  message: string;
  installInstructions?: string;
}

// Pre-defined what-if scenarios
const WHAT_IF_SCENARIOS: WhatIfScenario[] = [
  {
    id: 'gas-spike-2x',
    name: 'Gas Spike 2x',
    description: 'What if gas prices double?',
    gasMultiplier: 2,
  },
  {
    id: 'gas-spike-3x',
    name: 'Gas Spike 3x',
    description: 'What if gas prices triple?',
    gasMultiplier: 3,
  },
  {
    id: 'gas-spike-5x',
    name: 'Gas Spike 5x',
    description: 'Simulate extreme congestion',
    gasMultiplier: 5,
  },
  {
    id: 'gas-drop-50',
    name: 'Gas Drop 50%',
    description: 'What if gas prices halve?',
    gasMultiplier: 0.5,
  },
];

export function ForkOptions() {
  const {
    forkEnabled,
    ledgerVersion,
    stateOverrides,
    whatIfEnabled,
    gasMultiplier,
    gasUnitPrice,
    setForkEnabled,
    setLedgerVersion,
    addStateOverride,
    removeStateOverride,
    updateStateOverride,
    clearStateOverrides,
    setWhatIfEnabled,
    setGasMultiplier,
    applyWhatIfScenario,
  } = useSimulatorStore();

  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [newOverride, setNewOverride] = useState({
    address: '',
    resource_type: '',
    dataJson: '{}',
  });
  const [overrideSupport, setOverrideSupport] = useState<StateOverrideSupport | null>(null);
  const [loadingSupport, setLoadingSupport] = useState(false);

  // Fetch state override support status when component mounts
  useEffect(() => {
    const fetchSupport = async () => {
      setLoadingSupport(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/v1/simulate/state-override-support`);
        if (response.ok) {
          const data = await response.json();
          setOverrideSupport(data);
        }
      } catch (error) {
        console.error('Failed to fetch state override support:', error);
      } finally {
        setLoadingSupport(false);
      }
    };

    fetchSupport();
  }, []);

  const handleAddOverride = () => {
    if (newOverride.address && newOverride.resource_type) {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(newOverride.dataJson);
      } catch {
        // Invalid JSON - use empty object
      }
      addStateOverride({
        address: newOverride.address,
        resource_type: newOverride.resource_type,
        data,
      });
      setNewOverride({ address: '', resource_type: '', dataJson: '{}' });
      setShowOverrideForm(false);
    }
  };

  return (
    <div className="mt-4 space-y-6">
      {/* What-If Scenarios Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={whatIfEnabled}
              onChange={(e) => setWhatIfEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-dark-600 bg-dark-900 text-primary-500
                        focus:ring-primary-500 focus:ring-offset-dark-800"
            />
            <span className="text-sm font-medium text-dark-300">What-If Scenarios</span>
          </label>
          {whatIfEnabled && (
            <span className="text-xs text-primary-400">
              Effective gas price: {Math.round(gasUnitPrice * gasMultiplier)}
            </span>
          )}
        </div>

        {whatIfEnabled && (
          <div className="bg-dark-900/50 rounded-lg p-4 space-y-4">
            {/* Quick scenario buttons */}
            <div className="grid grid-cols-2 gap-2">
              {WHAT_IF_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => applyWhatIfScenario(scenario)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors
                             ${gasMultiplier === scenario.gasMultiplier
                               ? 'bg-primary-500/20 border border-primary-500 text-primary-400'
                               : 'bg-dark-800 border border-dark-700 text-dark-300 hover:border-dark-600'
                             }`}
                >
                  <span className="block font-semibold">{scenario.name}</span>
                  <span className="block text-dark-500 text-[10px] mt-0.5">{scenario.description}</span>
                </button>
              ))}
            </div>

            {/* Custom multiplier slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-dark-400">Custom Gas Multiplier</label>
                <span className="text-xs font-mono text-dark-300">{gasMultiplier}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={gasMultiplier}
                onChange={(e) => setGasMultiplier(parseFloat(e.target.value))}
                className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer
                          accent-primary-500"
              />
              <div className="flex justify-between text-[10px] text-dark-600">
                <span>0.1x</span>
                <span>5x</span>
                <span>10x</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fork State Section */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={forkEnabled}
            onChange={(e) => setForkEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-dark-600 bg-dark-900 text-primary-500
                      focus:ring-primary-500 focus:ring-offset-dark-800"
          />
          <span className="text-sm font-medium text-dark-300">Fork Historical State</span>
        </label>

        {forkEnabled && (
          <div className="bg-dark-900/50 rounded-lg p-4 space-y-4">
            {/* Ledger Version Input */}
            <div className="space-y-2">
              <label className="block text-xs text-dark-400">
                Ledger Version (leave empty for latest)
              </label>
              <input
                type="text"
                value={ledgerVersion}
                onChange={(e) => setLedgerVersion(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g., 123456789"
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                          font-mono text-dark-100 placeholder:text-dark-600 focus:outline-none
                          focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-[10px] text-dark-500">
                Fork blockchain state at a specific block height for time-travel simulation
              </p>
            </div>

            {/* State Overrides */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-dark-400">State Overrides</label>
                {loadingSupport ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-dark-700 text-dark-400 rounded font-medium">
                    Checking...
                  </span>
                ) : overrideSupport?.supported ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded font-medium">
                    Available
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded font-medium">
                    Coming Soon
                  </span>
                )}
              </div>

              {/* Status Message */}
              {overrideSupport?.supported ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-[11px] text-green-400/90 leading-relaxed">
                    <strong>State overrides enabled!</strong> You can modify account balances before simulation
                    to test "what-if" scenarios.
                  </p>
                  {overrideSupport.limitations && overrideSupport.limitations.length > 0 && (
                    <ul className="mt-2 text-[10px] text-green-400/70 list-disc list-inside space-y-0.5">
                      {overrideSupport.limitations.slice(0, 2).map((limitation, i) => (
                        <li key={i}>{limitation}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-[11px] text-yellow-400/90 leading-relaxed">
                    <strong>Coming Soon:</strong> State overrides allow you to modify account balances
                    before simulation. This feature is being configured on our servers.
                  </p>
                  <p className="mt-1 text-[10px] text-yellow-400/60">
                    Historical ledger version forking above is fully functional.
                  </p>
                </div>
              )}

              {/* Existing overrides */}
              {stateOverrides.length > 0 && (
                <div className="space-y-2">
                  {stateOverrides.map((override, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-dark-800 rounded-lg px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-dark-200 truncate">
                          {override.address.slice(0, 8)}...{override.resource_type.split('::').pop()}
                        </div>
                        <div className="text-[10px] text-dark-500 truncate">
                          {JSON.stringify(override.data).slice(0, 30)}...
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStateOverride(index)}
                        className="ml-2 text-dark-500 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={clearStateOverrides}
                    className="text-xs text-dark-500 hover:text-red-400 transition-colors"
                  >
                    Clear all overrides
                  </button>
                </div>
              )}

              {/* New override form */}
              {showOverrideForm && (
                <div className="bg-dark-800 rounded-lg p-3 space-y-3">
                  <div className="space-y-2">
                    <label className="block text-[10px] text-dark-500 uppercase tracking-wide">
                      Account Address
                    </label>
                    <input
                      type="text"
                      value={newOverride.address}
                      onChange={(e) => setNewOverride({ ...newOverride, address: e.target.value })}
                      placeholder="0x..."
                      className="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1.5 text-xs
                                font-mono text-dark-100 placeholder:text-dark-600 focus:outline-none
                                focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] text-dark-500 uppercase tracking-wide">
                      Resource Type
                    </label>
                    <input
                      type="text"
                      value={newOverride.resource_type}
                      onChange={(e) => setNewOverride({ ...newOverride, resource_type: e.target.value })}
                      placeholder="0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
                      className="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1.5 text-xs
                                font-mono text-dark-100 placeholder:text-dark-600 focus:outline-none
                                focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] text-dark-500 uppercase tracking-wide">
                      Override Data (JSON)
                    </label>
                    <textarea
                      value={newOverride.dataJson}
                      onChange={(e) => setNewOverride({ ...newOverride, dataJson: e.target.value })}
                      placeholder='{"coin": {"value": "100000000"}}'
                      rows={3}
                      className="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1.5 text-xs
                                font-mono text-dark-100 placeholder:text-dark-600 focus:outline-none
                                focus:ring-1 focus:ring-primary-500 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddOverride}
                      disabled={!newOverride.address || !newOverride.resource_type}
                      className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:bg-dark-700
                                disabled:text-dark-500 text-white text-xs font-medium py-1.5 rounded
                                transition-colors"
                    >
                      Add Override
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOverrideForm(false);
                        setNewOverride({ address: '', resource_type: '', dataJson: '{}' });
                      }}
                      className="px-3 bg-dark-700 text-dark-300 text-xs font-medium py-1.5 rounded
                                hover:bg-dark-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {stateOverrides.length === 0 && !showOverrideForm && (
                <button
                  type="button"
                  onClick={() => setShowOverrideForm(true)}
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  + Add Override
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-dark-500">
        Use fork options to test against historical state or simulate edge cases.
        {overrideSupport?.supported && ' State overrides use CLI simulation sessions for isolated testing.'}
      </p>
    </div>
  );
}
