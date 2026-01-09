/**
 * x402 Payment Middleware
 *
 * Implements the x402 HTTP payment protocol for MoveWatch.
 * Returns 402 Payment Required when free quota is exceeded,
 * and processes payments via the X-Payment header.
 *
 * Protocol flow:
 * 1. Client requests a protected endpoint
 * 2. Server checks if user has free quota remaining
 * 3. If quota exceeded, returns 402 with X-Payment-Required header
 * 4. Client signs a MOVE transfer and retries with X-Payment header
 * 5. Server verifies signature and submits transaction on-chain
 * 6. After confirmation, original request is processed
 * 7. Response includes X-Payment-Response header with tx hash
 */

import type { Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import type { AuthenticatedRequest } from './auth.js';
import type { PaymentRequired, PaymentResponse } from '@movewatch/shared';
import { verifyPayment, settlePayment } from '../services/x402Facilitator.js';
import { checkUsageQuota, incrementUsage } from '../services/usageTracker.js';
import { recordPayment } from '../services/paymentService.js';
import {
  getPricingConfig,
  getPaymentAddress,
  getPaymentNetwork,
} from '../config/pricing.js';

// Header names for x402 protocol
const PAYMENT_REQUIRED_HEADER = 'X-Payment-Required';
const PAYMENT_HEADER = 'X-Payment';
const PAYMENT_RESPONSE_HEADER = 'X-Payment-Response';

// Additional headers for quota information
const QUOTA_REMAINING_HEADER = 'X-Quota-Remaining';
const QUOTA_LIMIT_HEADER = 'X-Quota-Limit';

/**
 * Factory function to create x402 payment middleware for an endpoint
 *
 * @param endpointKey - The endpoint identifier (e.g., "POST /v1/simulate")
 * @returns Express middleware function
 */
export function requirePayment(endpointKey: string) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Check if payments are disabled globally (for development)
      if (process.env.DISABLE_PAYMENTS === 'true') {
        return next();
      }

      // 1. Get pricing configuration for this endpoint
      const pricing = getPricingConfig(endpointKey);

      if (!pricing || !pricing.enabled) {
        // No payment required for this endpoint
        return next();
      }

      // 2. Determine user identifier (userId, wallet address, or IP)
      const identifier = getIdentifier(req);

      // 3. Check if user has free quota remaining
      const quotaExceeded = await checkUsageQuota(identifier, endpointKey, pricing);

      if (!quotaExceeded) {
        // User still has free quota - increment and proceed
        await incrementUsage(identifier, endpointKey);

        // Add quota headers for transparency
        res.setHeader(QUOTA_REMAINING_HEADER, String(pricing.freeLimit - 1));
        res.setHeader(QUOTA_LIMIT_HEADER, String(pricing.freeLimit));

        return next();
      }

      // 4. Check for X-Payment header
      const paymentHeader = req.headers[PAYMENT_HEADER.toLowerCase()] as string;

      if (!paymentHeader) {
        // Return 402 Payment Required
        return send402Response(res, pricing, req.method, req.path);
      }

      // 5. Generate unique request ID for this payment
      const requestId = nanoid();

      // 6. Verify the payment
      console.log(`[x402] Verifying payment for ${endpointKey}...`);
      const verification = await verifyPayment(
        paymentHeader,
        pricing.priceOctas,
        requestId
      );

      if (!verification.valid) {
        console.warn(`[x402] Payment verification failed: ${verification.error}`);
        res.status(402).json({
          error: {
            code: 'PAYMENT_INVALID',
            message: verification.error || 'Payment verification failed',
          },
        });
        return;
      }

      // 7. Settle the payment on-chain
      console.log(`[x402] Settling payment for ${endpointKey}...`);
      const settlement = await settlePayment(paymentHeader, requestId);

      if (!settlement.success) {
        console.error(`[x402] Payment settlement failed: ${settlement.error}`);
        res.status(402).json({
          error: {
            code: 'PAYMENT_FAILED',
            message: settlement.error || 'Payment settlement failed',
          },
        });
        return;
      }

      // 8. Record the payment in database
      await recordPayment({
        userId: req.user?.id,
        payerAddress: verification.payerAddress!,
        amount: pricing.priceOctas,
        amountFormatted: pricing.priceFormatted,
        transactionHash: settlement.transactionHash!,
        endpoint: endpointKey,
        requestId,
        priceOctas: pricing.priceOctas,
        priceUsd: pricing.priceUsd,
      });

      console.log(
        `[x402] Payment confirmed: ${settlement.transactionHash} for ${endpointKey}`
      );

      // 9. Add payment response header
      const paymentResponse: PaymentResponse = {
        transactionHash: settlement.transactionHash!,
        amount: pricing.priceFormatted,
        status: 'confirmed',
      };

      res.setHeader(
        PAYMENT_RESPONSE_HEADER,
        JSON.stringify(paymentResponse)
      );

      // 10. Proceed with the original request
      next();
    } catch (error) {
      console.error('[x402] Middleware error:', error);
      res.status(500).json({
        error: {
          code: 'PAYMENT_ERROR',
          message: 'Payment processing failed due to internal error',
        },
      });
    }
  };
}

/**
 * Send HTTP 402 Payment Required response
 */
function send402Response(
  res: Response,
  pricing: ReturnType<typeof getPricingConfig>,
  method: string,
  path: string
): void {
  if (!pricing) return;

  const paymentAddress = getPaymentAddress();
  const network = getPaymentNetwork();

  const paymentRequired: PaymentRequired = {
    version: '1.0',
    network,
    payTo: paymentAddress,
    asset: 'MOVE',
    amount: pricing.priceOctas,
    amountFormatted: pricing.priceFormatted,
    resource: `${method} ${path}`,
    description: pricing.description,
    validUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
    instructions: {
      type: 'transfer',
      to: paymentAddress,
      amount: pricing.priceOctas,
      memo: `MoveWatch API: ${method} ${path}`,
    },
  };

  // Encode as base64 for header
  const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString('base64');
  res.setHeader(PAYMENT_REQUIRED_HEADER, encoded);

  res.status(402).json({
    error: {
      code: 'PAYMENT_REQUIRED',
      message: 'Payment required to access this resource. Free quota exceeded.',
    },
    payment: paymentRequired,
  });
}

/**
 * Get user identifier for quota tracking
 * Priority: userId > wallet address header > IP address
 */
function getIdentifier(req: AuthenticatedRequest): string {
  // First check for authenticated user
  if (req.user?.id) {
    return req.user.id;
  }

  // Check for wallet address header (for agent requests)
  const walletHeader = req.headers['x-wallet-address'] as string;
  if (walletHeader && walletHeader.startsWith('0x')) {
    return walletHeader;
  }

  // Fall back to IP address
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ip = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor.split(',')[0].trim();
    return `ip:${ip}`;
  }

  return `ip:${req.ip || 'unknown'}`;
}

/**
 * Optional payment middleware - allows both free and paid access
 * Records payment if provided, otherwise uses free quota
 */
export function optionalPayment(endpointKey: string) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Check if payment header is provided
    const paymentHeader = req.headers[PAYMENT_HEADER.toLowerCase()] as string;

    if (paymentHeader) {
      // Process as paid request
      return requirePayment(endpointKey)(req, res, next);
    }

    // Process as free request (no payment required)
    const pricing = getPricingConfig(endpointKey);
    if (pricing) {
      const identifier = getIdentifier(req);
      await incrementUsage(identifier, endpointKey);

      // Add quota headers
      res.setHeader(QUOTA_LIMIT_HEADER, String(pricing.freeLimit));
    }

    next();
  };
}

/**
 * Middleware to check payment without enforcing
 * Useful for analytics or showing payment status
 */
export function checkPaymentStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const paymentHeader = req.headers[PAYMENT_HEADER.toLowerCase()] as string;
  const paymentResponse = req.headers[PAYMENT_RESPONSE_HEADER.toLowerCase()] as string;

  // Attach payment info to request for downstream use
  (req as any).paymentInfo = {
    hasPayment: !!paymentHeader,
    paymentResponse: paymentResponse
      ? JSON.parse(paymentResponse)
      : null,
  };

  next();
}
