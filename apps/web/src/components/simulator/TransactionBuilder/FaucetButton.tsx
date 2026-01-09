'use client';

import { useState } from 'react';
import { useSimulatorStore } from '@/stores/simulator';
import { requestFaucet } from '@/lib/api';

export function FaucetButton() {
  const { network, sender } = useSimulatorStore();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const isAvailable = network === 'testnet' || network === 'devnet';

  const handleRequestFaucet = async () => {
    if (!sender || isLoading) return;

    setIsLoading(true);
    setResult(null);

    try {
      const response = await requestFaucet(network, sender);
      setResult(response);

      // Clear success message after 5 seconds
      if (response.success) {
        setTimeout(() => setResult(null), 5000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAvailable) {
    return null;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleRequestFaucet}
        disabled={!sender || isLoading}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors
                   ${!sender || isLoading
                     ? 'bg-dark-700 text-dark-500 cursor-not-allowed'
                     : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                   }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Requesting...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Get Testnet MOVE
          </>
        )}
      </button>

      {/* Result message */}
      {result && (
        <div className={`text-xs px-3 py-2 rounded-lg ${
          result.success
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {result.message}
        </div>
      )}

      {/* Helper text */}
      {!sender && (
        <p className="text-xs text-dark-500">
          Enter a sender address above to request testnet tokens
        </p>
      )}
    </div>
  );
}
