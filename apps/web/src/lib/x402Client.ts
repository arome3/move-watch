/**
 * x402 API Client
 *
 * Wraps fetch requests to handle HTTP 402 Payment Required responses.
 * Automatically parses payment requirements and supports retry with payment.
 */

import { getSession } from 'next-auth/react';
import type { PaymentRequired, PaymentResponse } from '@movewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Get authentication headers for API requests
 * Uses the JWT accessToken from NextAuth session
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();

  if (session?.accessToken) {
    return {
      Authorization: `Bearer ${session.accessToken}`,
    };
  }

  return {};
}

// Header names for x402 protocol
const PAYMENT_REQUIRED_HEADER = 'x-payment-required';
const PAYMENT_HEADER = 'X-Payment';
const PAYMENT_RESPONSE_HEADER = 'x-payment-response';

export interface X402FetchOptions extends RequestInit {
  // Callback when 402 is returned - should return X-Payment header value or null to cancel
  onPaymentRequired?: (details: PaymentRequired) => Promise<string | null>;
}

export interface X402Response<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  paymentRequired?: PaymentRequired;
  paymentResponse?: PaymentResponse;
}

/**
 * Fetch with x402 payment handling
 *
 * If 402 is returned and onPaymentRequired callback is provided,
 * the callback will be called to get the X-Payment header value.
 * If the callback returns a value, the request will be retried with payment.
 */
export async function x402Fetch<T>(
  url: string,
  options: X402FetchOptions = {}
): Promise<X402Response<T>> {
  const { onPaymentRequired, ...fetchOptions } = options;
  const authHeaders = await getAuthHeaders();

  // First attempt
  let response = await fetch(`${API_URL}${url}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...fetchOptions.headers,
    },
  });

  // Check for 402 Payment Required
  if (response.status === 402) {
    // Parse payment requirements from header
    const paymentHeaderValue = response.headers.get(PAYMENT_REQUIRED_HEADER);
    let paymentRequired: PaymentRequired | undefined;

    if (paymentHeaderValue) {
      try {
        const decoded = atob(paymentHeaderValue);
        paymentRequired = JSON.parse(decoded);
      } catch (e) {
        console.error('Failed to decode payment requirements:', e);
      }
    }

    // If no callback or callback returns null, return 402 response
    if (!paymentRequired || !onPaymentRequired) {
      const data = await response.json();
      return {
        data: null,
        error: data.error || { code: 'PAYMENT_REQUIRED', message: 'Payment required' },
        paymentRequired: paymentRequired || data.payment,
      };
    }

    // Call callback to get payment
    const xPayment = await onPaymentRequired(paymentRequired);

    if (!xPayment) {
      // User cancelled payment
      const data = await response.json();
      return {
        data: null,
        error: { code: 'PAYMENT_CANCELLED', message: 'Payment cancelled by user' },
        paymentRequired,
      };
    }

    // Retry with payment
    response = await fetch(`${API_URL}${url}`, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        [PAYMENT_HEADER]: xPayment,
        ...fetchOptions.headers,
      },
    });
  }

  // Parse payment response header if present
  let paymentResponse: PaymentResponse | undefined;
  const paymentResponseHeader = response.headers.get(PAYMENT_RESPONSE_HEADER);
  if (paymentResponseHeader) {
    try {
      paymentResponse = JSON.parse(paymentResponseHeader);
    } catch (e) {
      console.error('Failed to parse payment response:', e);
    }
  }

  // Handle response
  if (!response.ok) {
    const data = await response.json();
    return {
      data: null,
      error: data.error || { code: 'REQUEST_FAILED', message: 'Request failed' },
      paymentRequired: data.payment,
      paymentResponse,
    };
  }

  const data = await response.json();
  return {
    data: data as T,
    error: null,
    paymentResponse,
  };
}

/**
 * Get pricing configuration
 */
export async function getPricing() {
  const response = await fetch(`${API_URL}/v1/payments/pricing`);
  return response.json();
}

/**
 * Get current usage quota
 */
export async function getUsageQuota(walletAddress?: string) {
  const headers: Record<string, string> = {};
  if (walletAddress) {
    headers['X-Wallet-Address'] = walletAddress;
  }

  const response = await fetch(`${API_URL}/v1/payments/usage`, { headers });
  return response.json();
}

/**
 * Get payment history
 */
export async function getPaymentHistory(
  options: { page?: number; limit?: number; wallet?: string } = {}
) {
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.wallet) params.set('wallet', options.wallet);

  const response = await fetch(`${API_URL}/v1/payments?${params.toString()}`);
  return response.json();
}
