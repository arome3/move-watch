/**
 * Payment Store
 *
 * Zustand store for managing x402 payment state.
 * Handles payment modal visibility, payment processing, and transaction history.
 */

import { create } from 'zustand';
import type { PaymentRequired, PaymentResponse } from '@movewatch/shared';

interface PaymentState {
  // Payment modal state
  isPaymentModalOpen: boolean;
  paymentDetails: PaymentRequired | null;
  isProcessing: boolean;
  error: string | null;

  // Last payment response
  lastPaymentResponse: PaymentResponse | null;

  // Pending request info (for retry after payment)
  pendingRequest: {
    resolve: (xPayment: string | null) => void;
  } | null;

  // Actions
  openPaymentModal: (details: PaymentRequired) => Promise<string | null>;
  closePaymentModal: () => void;
  setProcessing: (isProcessing: boolean) => void;
  setError: (error: string | null) => void;
  completePayment: (xPayment: string) => void;
  cancelPayment: () => void;
  setLastPaymentResponse: (response: PaymentResponse | null) => void;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  isPaymentModalOpen: false,
  paymentDetails: null,
  isProcessing: false,
  error: null,
  lastPaymentResponse: null,
  pendingRequest: null,

  openPaymentModal: (details: PaymentRequired) => {
    return new Promise<string | null>((resolve) => {
      set({
        isPaymentModalOpen: true,
        paymentDetails: details,
        isProcessing: false,
        error: null,
        pendingRequest: { resolve },
      });
    });
  },

  closePaymentModal: () => {
    const { pendingRequest } = get();
    if (pendingRequest) {
      pendingRequest.resolve(null);
    }
    set({
      isPaymentModalOpen: false,
      paymentDetails: null,
      isProcessing: false,
      error: null,
      pendingRequest: null,
    });
  },

  setProcessing: (isProcessing: boolean) => {
    set({ isProcessing });
  },

  setError: (error: string | null) => {
    set({ error, isProcessing: false });
  },

  completePayment: (xPayment: string) => {
    const { pendingRequest } = get();
    if (pendingRequest) {
      pendingRequest.resolve(xPayment);
    }
    set({
      isPaymentModalOpen: false,
      paymentDetails: null,
      isProcessing: false,
      error: null,
      pendingRequest: null,
    });
  },

  cancelPayment: () => {
    const { pendingRequest } = get();
    if (pendingRequest) {
      pendingRequest.resolve(null);
    }
    set({
      isPaymentModalOpen: false,
      paymentDetails: null,
      isProcessing: false,
      error: null,
      pendingRequest: null,
    });
  },

  setLastPaymentResponse: (response: PaymentResponse | null) => {
    set({ lastPaymentResponse: response });
  },
}));
