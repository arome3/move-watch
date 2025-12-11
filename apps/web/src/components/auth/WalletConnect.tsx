'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import {
  isPetraInstalled,
  getPetraWallet,
  generateNonce,
  generateAuthMessage,
} from '@/lib/wallet';

interface WalletConnectProps {
  callbackUrl?: string;
}

export function WalletConnect({ callbackUrl = '/dashboard' }: WalletConnectProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletInstalled, setWalletInstalled] = useState(false);

  useEffect(() => {
    // Check if wallet is installed (client-side only)
    setWalletInstalled(isPetraInstalled());
  }, []);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const wallet = getPetraWallet();
      if (!wallet) {
        throw new Error('Petra wallet not found');
      }

      // Connect to wallet
      const { address, publicKey } = await wallet.connect();

      // Generate authentication message
      const nonce = generateNonce();
      const message = generateAuthMessage(nonce);

      // Request signature from wallet
      const { signature } = await wallet.signMessage({
        message,
        nonce,
      });

      // Sign in with NextAuth using wallet credentials
      const result = await signIn('wallet', {
        address,
        signature: JSON.stringify({ signature, publicKey }),
        message,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      // Redirect on success
      window.location.href = callbackUrl;
    } catch (err) {
      console.error('Wallet connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsLoading(false);
    }
  };

  if (!walletInstalled) {
    return (
      <div className="space-y-4">
        <button
          disabled
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-700 text-slate-400 rounded-lg cursor-not-allowed"
        >
          <WalletIcon />
          <span>Petra Wallet Not Detected</span>
        </button>
        <p className="text-sm text-slate-500 text-center">
          <a
            href="https://petra.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-400 hover:text-primary-300 underline"
          >
            Install Petra Wallet
          </a>{' '}
          to connect with your wallet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleConnect}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium rounded-lg hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? (
          <>
            <LoadingSpinner />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <WalletIcon />
            <span>Connect with Petra Wallet</span>
          </>
        )}
      </button>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400 text-center">{error}</p>
        </div>
      )}
    </div>
  );
}

function WalletIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
