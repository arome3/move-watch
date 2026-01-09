'use client';

import { useGuardianStore } from '@/stores/guardian';
import { NETWORK_CONFIGS, type Network } from '@movewatch/shared';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;
    await onAnalyze();
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
          <div>
            <input
              type="text"
              value={moduleAddress}
              onChange={(e) => setModuleAddress(e.target.value)}
              placeholder="0x1"
              className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm text-dark-100 font-mono
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         ${errors.moduleAddress ? 'border-red-500' : 'border-dark-700'}`}
            />
          </div>
          <span className="text-dark-500 font-mono text-sm">::</span>
          <div>
            <input
              type="text"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder="module"
              className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm text-dark-100 font-mono
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         ${errors.moduleName ? 'border-red-500' : 'border-dark-700'}`}
            />
          </div>
          <span className="text-dark-500 font-mono text-sm">::</span>
          <div>
            <input
              type="text"
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value)}
              placeholder="function"
              className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm text-dark-100 font-mono
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         ${errors.functionName ? 'border-red-500' : 'border-dark-700'}`}
            />
          </div>
        </div>
        {(errors.moduleAddress || errors.moduleName || errors.functionName) && (
          <p className="text-xs text-red-400">
            {errors.moduleAddress || errors.moduleName || errors.functionName}
          </p>
        )}
      </div>

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
