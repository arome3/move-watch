'use client';

/**
 * PaymentRequired Modal
 *
 * Displays when a 402 Payment Required response is received.
 * Handles wallet connection and payment signing for x402 protocol.
 */

import { useState, useCallback, useEffect } from 'react';
import { usePaymentStore } from '@/stores/payment';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import type { PaymentRequired as PaymentRequiredType } from '@movewatch/shared';

// Icons
function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function PaymentRequiredModal() {
  const {
    isPaymentModalOpen,
    paymentDetails,
    isProcessing,
    error,
    closePaymentModal,
    setProcessing,
    setError,
    completePayment,
    cancelPayment,
  } = usePaymentStore();

  // Use Aptos wallet adapter
  const {
    connect,
    account,
    connected,
    wallets,
    signAndSubmitTransaction,
  } = useWallet();

  // Find Petra wallet from available wallets
  const petraWallet = wallets.find((w) => w.name.toLowerCase().includes('petra'));
  const isPetraAvailable = !!petraWallet;
  const walletAddress = account?.address?.toString() || null;

  const connectWallet = useCallback(async () => {
    if (!petraWallet) {
      setError('Petra wallet not found. Please install Petra wallet extension.');
      return;
    }

    try {
      setProcessing(true);
      await connect(petraWallet.name);
      setProcessing(false);
    } catch (e) {
      setError('Failed to connect wallet. Please try again.');
      setProcessing(false);
    }
  }, [petraWallet, connect, setProcessing, setError]);

  const handlePayment = useCallback(async () => {
    if (!paymentDetails || !connected || !account) return;

    try {
      setProcessing(true);
      setError(null);

      const nonce = crypto.randomUUID();
      const timestamp = Date.now();

      // Build the transfer transaction payload for Aptos/Movement
      // Using aptos_account::transfer which handles both coin transfer and account creation
      const transferPayload = {
        data: {
          function: '0x1::aptos_account::transfer' as `${string}::${string}::${string}`,
          typeArguments: [],
          functionArguments: [paymentDetails.payTo, paymentDetails.amount],
        },
      };

      // Sign and submit the transaction on-chain
      // This prompts the user in Petra wallet to approve the transfer
      console.log('[x402] Submitting payment transaction...');
      const txResponse = await signAndSubmitTransaction(transferPayload);

      console.log('[x402] Transaction submitted:', txResponse.hash);

      // Build the X-Payment header payload with the transaction hash
      // The backend will verify this transaction on-chain
      const paymentPayload = {
        transactionHash: txResponse.hash,
        senderAddress: account.address.toString(),
        amount: paymentDetails.amount,
        recipient: paymentDetails.payTo,
        nonce,
        timestamp,
      };

      // Encode as base64 for the header
      const xPaymentHeader = btoa(JSON.stringify(paymentPayload));

      // Complete the payment flow
      completePayment(xPaymentHeader);
    } catch (e: any) {
      console.error('Payment error:', e);

      // Handle common wallet errors
      if (e.message?.includes('User rejected')) {
        setError('Transaction rejected. Please approve the transaction in your wallet.');
      } else if (e.message?.includes('insufficient')) {
        setError('Insufficient MOVE balance. Please fund your wallet.');
      } else {
        setError(e.message || 'Payment failed. Please try again.');
      }
      setProcessing(false);
    }
  }, [paymentDetails, connected, account, signAndSubmitTransaction, setProcessing, setError, completePayment]);

  if (!isPaymentModalOpen || !paymentDetails) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-dark-900 rounded-2xl p-6 max-w-md w-full mx-4 border border-dark-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
            <CreditCardIcon className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Payment Required</h3>
            <p className="text-sm text-dark-400">x402 Protocol</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-dark-300 mb-4">{paymentDetails.description}</p>

        {/* Payment Details */}
        <div className="bg-dark-800/50 rounded-xl p-4 mb-6 border border-dark-700/50">
          <div className="flex justify-between items-center mb-3">
            <span className="text-dark-400">Amount</span>
            <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
              {paymentDetails.amountFormatted}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-dark-500">Resource</span>
            <span className="text-dark-300 font-mono text-xs">{paymentDetails.resource}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-dark-500">Network</span>
            <span className="text-dark-300 capitalize">{paymentDetails.network.replace('movement-', '')}</span>
          </div>
        </div>

        {/* Wallet Status */}
        {!connected && (
          <div className="mb-6">
            {!isPetraAvailable ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-sm text-red-400 mb-2">Petra wallet not detected</p>
                <a
                  href="https://petra.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-amber-400 hover:text-amber-300 underline"
                >
                  Install Petra Wallet
                </a>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors border border-dark-600"
              >
                <WalletIcon className="w-5 h-5" />
                {isProcessing ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        )}

        {connected && walletAddress && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-6 flex items-center gap-2">
            <CheckIcon className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm text-green-400">Wallet Connected</p>
              <p className="text-xs text-dark-400 font-mono">
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={cancelPayment}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={isProcessing || !connected}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <LoadingSpinner className="w-5 h-5" />
                Processing...
              </>
            ) : (
              <>
                Pay {paymentDetails.amountFormatted}
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-dark-500 text-center mt-4">
          Powered by x402 Protocol on Movement Network
        </p>
      </div>
    </div>
  );
}

export default PaymentRequiredModal;
