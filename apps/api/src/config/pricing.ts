/**
 * x402 Pricing Configuration
 *
 * Defines pricing for each API endpoint in MOVE tokens.
 * 1 MOVE = 100,000,000 octas (8 decimal places)
 *
 * Pricing strategy:
 * - Simulation: 0.001 MOVE (cheap, high volume)
 * - Alerts: 0.005 MOVE (medium, creates persistent resource)
 * - Actions: 0.01 MOVE (expensive, executes compute)
 * - Monitoring: 0.001 MOVE (cheap, read-only)
 */

import type { EndpointPricing } from '@movewatch/shared';

// Pricing configuration for all paid endpoints
export const PRICING_CONFIG: Record<string, EndpointPricing> = {
  // Transaction Simulation - core feature
  'POST /v1/simulate': {
    endpoint: 'POST /v1/simulate',
    priceOctas: '100000',        // 0.001 MOVE
    priceFormatted: '0.001 MOVE',
    priceUsd: 0.001,
    freeLimit: 10,               // 10 free per day
    freePeriod: 'day',
    description: 'Simulate a Move transaction on Movement Network',
    enabled: true,
  },

  // Alert Creation - monitoring subscription
  'POST /v1/alerts': {
    endpoint: 'POST /v1/alerts',
    priceOctas: '500000',        // 0.005 MOVE
    priceFormatted: '0.005 MOVE',
    priceUsd: 0.005,
    freeLimit: 3,                // 3 free alerts total
    freePeriod: 'month',
    description: 'Create an on-chain monitoring alert',
    enabled: true,
  },

  // Action Test Execution - compute resource
  'POST /v1/actions/:id/test': {
    endpoint: 'POST /v1/actions/:id/test',
    priceOctas: '1000000',       // 0.01 MOVE
    priceFormatted: '0.01 MOVE',
    priceUsd: 0.01,
    freeLimit: 5,                // 5 free tests per day
    freePeriod: 'day',
    description: 'Execute a Web3 Action in test mode',
    enabled: true,
  },

  // Monitoring Stats - analytics data
  'GET /v1/monitoring/stats': {
    endpoint: 'GET /v1/monitoring/stats',
    priceOctas: '100000',        // 0.001 MOVE
    priceFormatted: '0.001 MOVE',
    priceUsd: 0.001,
    freeLimit: 20,               // 20 free per day
    freePeriod: 'day',
    description: 'Fetch dashboard analytics and statistics',
    enabled: true,
  },

  // Guardian Risk Analysis - AI-powered security checks
  'POST /v1/guardian/check': {
    endpoint: 'POST /v1/guardian/check',
    priceOctas: '500000',        // 0.005 MOVE
    priceFormatted: '0.005 MOVE',
    priceUsd: 0.005,
    freeLimit: 5,                // 5 free per day
    freePeriod: 'day',
    description: 'AI-powered transaction risk analysis with exploit detection',
    enabled: true,
  },

  // ========================================================================
  // AI Agent Endpoints (x402 payment required, no free tier)
  // ========================================================================

  // Simulation for AI Trading Agents
  'POST /v1/simulate/agent': {
    endpoint: 'POST /v1/simulate/agent',
    priceOctas: '100000',        // 0.001 MOVE
    priceFormatted: '0.001 MOVE',
    priceUsd: 0.001,
    freeLimit: 0,                // No free tier - agents pay per use
    freePeriod: 'day',
    description: 'Simulate transaction for AI trading agent before execution',
    enabled: true,
  },

  // Guardian Analysis for AI Trading Agents
  'POST /v1/guardian/check/agent': {
    endpoint: 'POST /v1/guardian/check/agent',
    priceOctas: '500000',        // 0.005 MOVE
    priceFormatted: '0.005 MOVE',
    priceUsd: 0.005,
    freeLimit: 0,                // No free tier - agents pay per use
    freePeriod: 'day',
    description: 'Security scan for AI trading agent before execution',
    enabled: true,
  },
};

// All priced endpoints
export const PRICED_ENDPOINTS = Object.keys(PRICING_CONFIG);

/**
 * Get pricing configuration for an endpoint
 * Returns null if endpoint is not priced
 */
export function getPricingConfig(endpoint: string): EndpointPricing | null {
  // Handle parameterized routes like /v1/actions/:id/test
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  return PRICING_CONFIG[normalizedEndpoint] || null;
}

/**
 * Normalize endpoint by replacing dynamic segments with placeholders
 * e.g., "POST /v1/actions/abc123/test" -> "POST /v1/actions/:id/test"
 */
function normalizeEndpoint(endpoint: string): string {
  // Handle actions/:id/test pattern
  const actionsPattern = /^(POST \/v1\/actions\/)([^/]+)(\/test)$/;
  if (actionsPattern.test(endpoint)) {
    return endpoint.replace(actionsPattern, '$1:id$3');
  }

  return endpoint;
}

/**
 * Get all pricing configurations
 */
export function getAllPricing(): EndpointPricing[] {
  return Object.values(PRICING_CONFIG);
}

/**
 * Get the MoveWatch payment address
 */
export function getPaymentAddress(): string {
  const address = process.env.MOVEWATCH_PAYMENT_ADDRESS;
  if (!address) {
    // Use a dummy address in development (payments will fail but won't crash)
    if (process.env.NODE_ENV !== 'production') {
      return '0x0000000000000000000000000000000000000000000000000000000000000001';
    }
    throw new Error('MOVEWATCH_PAYMENT_ADDRESS environment variable not set');
  }
  return address;
}

/**
 * Get the network for payments
 */
export function getPaymentNetwork(): 'movement-testnet' | 'movement-mainnet' {
  return (process.env.PAYMENT_NETWORK as any) || 'movement-testnet';
}
