'use client';

import { useSimulatorStore } from '@/stores/simulator';
import { FaucetButton } from './FaucetButton';

export function GasOptions() {
  const {
    maxGasAmount,
    gasUnitPrice,
    sender,
    detailedTrace,
    setMaxGasAmount,
    setGasUnitPrice,
    setSender,
    setDetailedTrace,
    errors,
  } = useSimulatorStore();

  return (
    <div className="mt-4 space-y-4">
      {/* Sender Address */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="sender" className="block text-sm font-medium text-dark-300">
            Sender Address (optional)
          </label>
          {/* Faucet Button - Only shown on testnet/devnet */}
          <FaucetButton />
        </div>
        <input
          id="sender"
          type="text"
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          placeholder="0x... (leave empty for anonymous simulation)"
          className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono text-dark-100
                     placeholder:text-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500
                     focus:border-transparent transition-colors
                     ${errors.sender ? 'border-red-500' : 'border-dark-700'}`}
        />
        {errors.sender && <p className="text-xs text-red-400">{errors.sender}</p>}
        <p className="text-xs text-dark-500">
          Specify a sender address to simulate from that account&apos;s state
        </p>
      </div>

      {/* Gas Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="maxGas" className="block text-sm font-medium text-dark-300">
            Max Gas Amount
          </label>
          <input
            id="maxGas"
            type="number"
            value={maxGasAmount}
            onChange={(e) => setMaxGasAmount(parseInt(e.target.value) || 100000)}
            min={1}
            className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                      font-mono text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500
                      focus:border-transparent transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="gasPrice" className="block text-sm font-medium text-dark-300">
            Gas Unit Price
          </label>
          <input
            id="gasPrice"
            type="number"
            value={gasUnitPrice}
            onChange={(e) => setGasUnitPrice(parseInt(e.target.value) || 100)}
            min={1}
            className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                      font-mono text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500
                      focus:border-transparent transition-colors"
          />
        </div>
      </div>

      <p className="text-xs text-dark-500">
        These values affect gas estimation. Default values work for most simulations.
      </p>

      {/* Detailed Trace Toggle */}
      <div className="pt-4 border-t border-dark-800">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-dark-300">
                Detailed Execution Trace
              </span>
              <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                CLI
              </span>
            </div>
            <p className="text-xs text-dark-500 mt-1">
              Get per-instruction gas profiling using Aptos CLI
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDetailedTrace(!detailedTrace)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-900 ${
              detailedTrace ? 'bg-primary-500' : 'bg-dark-700'
            }`}
            role="switch"
            aria-checked={detailedTrace}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                detailedTrace ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {detailedTrace && (
          <div className="mt-3 bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
            <p className="text-[11px] text-purple-400/90">
              <strong>Real trace mode enabled.</strong> Results will show actual per-instruction gas usage
              from the Move VM. Requires Aptos CLI on the server.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
