/**
 * x402 Payment API Routes
 *
 * Endpoints for payment history, usage tracking, and pricing information.
 * These endpoints support the x402 payment protocol integration.
 */

import { Router, type Router as RouterType, Response, NextFunction } from 'express';
import { z } from 'zod';
import { optionalAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  getPaymentsByUserId,
  getPaymentsByWalletAddress,
  getPaymentStats,
} from '../services/paymentService.js';
import { getUsageQuota, getNextResetTime } from '../services/usageTracker.js';
import {
  getAllPricing,
  getPaymentAddress,
  getPaymentNetwork,
  PRICING_CONFIG,
} from '../config/pricing.js';

const router: RouterType = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const paymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  wallet: z.string().optional(), // For querying by wallet address
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /payments
 * List payment history for authenticated user or wallet address
 */
router.get(
  '/',
  optionalAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = paymentsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parseResult.error.flatten().fieldErrors,
          },
        });
      }

      const { page, limit, wallet } = parseResult.data;

      // Determine which identifier to use
      const userId = req.user?.id;
      const walletAddress = wallet || (req.headers['x-wallet-address'] as string);

      if (!userId && !walletAddress) {
        return res.status(400).json({
          error: {
            code: 'IDENTIFIER_REQUIRED',
            message: 'Either authentication or wallet address is required',
          },
        });
      }

      // Fetch payments
      let result;
      if (userId) {
        result = await getPaymentsByUserId(userId, { page, limit });
      } else {
        result = await getPaymentsByWalletAddress(walletAddress!, { page, limit });
      }

      res.json({
        payments: result.payments,
        total: result.total,
        page,
        limit,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /payments/stats
 * Get payment statistics for authenticated user
 */
router.get(
  '/stats',
  optionalAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required for payment statistics',
          },
        });
      }

      const stats = await getPaymentStats(userId);

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /usage
 * Get current usage quota for the user/wallet
 */
router.get(
  '/usage',
  optionalAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Determine identifier
      const userId = req.user?.id;
      const walletAddress = req.headers['x-wallet-address'] as string;
      const identifier = userId || walletAddress;

      if (!identifier) {
        return res.status(400).json({
          error: {
            code: 'IDENTIFIER_REQUIRED',
            message: 'Either authentication or X-Wallet-Address header is required',
          },
        });
      }

      // Get current usage
      const quota = await getUsageQuota(identifier);

      // Get limits from pricing config
      const simulationsLimit = PRICING_CONFIG['POST /v1/simulate']?.freeLimit || 0;
      const alertsLimit = PRICING_CONFIG['POST /v1/alerts']?.freeLimit || 0;
      const actionsLimit = PRICING_CONFIG['POST /v1/actions/:id/test']?.freeLimit || 0;
      const monitoringLimit = PRICING_CONFIG['GET /v1/monitoring/stats']?.freeLimit || 0;

      // Calculate next reset time (most restrictive is daily)
      const resetAt = getNextResetTime('day');

      res.json({
        quota: {
          simulationsToday: quota.simulationsToday,
          simulationsLimit,
          alertsCreated: quota.alertsCreated,
          alertsLimit,
          actionsExecuted: quota.actionsExecuted,
          actionsLimit,
          monitoringCalls: quota.monitoringCalls,
          monitoringLimit,
        },
        resetAt: resetAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /pricing
 * Get pricing configuration for all endpoints
 */
router.get('/pricing', async (req, res, next) => {
  try {
    const pricing = getAllPricing();

    let paymentAddress: string;
    try {
      paymentAddress = getPaymentAddress();
    } catch {
      paymentAddress = '0x... (not configured)';
    }

    const network = getPaymentNetwork();

    res.json({
      pricing,
      paymentAddress,
      network,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
