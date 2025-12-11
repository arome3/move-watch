import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as monitoringService from '../services/monitoring.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const periodSchema = z.enum(['24h', '7d', '30d']);
const networkSchema = z.enum(['mainnet', 'testnet', 'devnet']);

const statsQuerySchema = z.object({
  period: periodSchema.optional().default('24h'),
  network: networkSchema.optional().default('testnet'),
  moduleAddress: z.string().optional(),
});

const transactionsQuerySchema = z.object({
  network: networkSchema.optional().default('testnet'),
  moduleAddress: z.string().optional(),
  status: z.enum(['success', 'failed']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const eventsQuerySchema = z.object({
  network: networkSchema.optional().default('testnet'),
  moduleAddress: z.string().optional(),
  eventType: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
});

const gasQuerySchema = z.object({
  period: periodSchema.optional().default('24h'),
  network: networkSchema.optional().default('testnet'),
  moduleAddress: z.string().optional(),
});

const createContractSchema = z.object({
  moduleAddress: z
    .string()
    .min(1, 'Module address is required')
    .regex(
      /^0x[a-fA-F0-9]+::\w+$/,
      'Invalid module address format. Expected: 0x...::module_name'
    ),
  name: z.string().optional(),
  network: networkSchema,
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /monitoring/stats
 * Get dashboard statistics
 */
router.get(
  '/stats',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = statsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parseResult.error.flatten().fieldErrors,
          },
        });
      }

      const { period, network, moduleAddress } = parseResult.data;

      const stats = await monitoringService.getDashboardStats(
        req.user!.id,
        period,
        network,
        moduleAddress
      );

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /monitoring/transactions
 * Get transaction list with filtering and pagination
 */
router.get(
  '/transactions',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = transactionsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parseResult.error.flatten().fieldErrors,
          },
        });
      }

      const { network, ...options } = parseResult.data;

      const result = await monitoringService.getTransactions(
        req.user!.id,
        network,
        options
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /monitoring/transactions/:hash
 * Get transaction detail by hash
 */
router.get(
  '/transactions/:hash',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hash } = req.params;
      const network = (req.query.network as string) || 'testnet';

      const transaction = await monitoringService.getTransactionDetail(
        hash,
        network as 'mainnet' | 'testnet' | 'devnet'
      );

      if (!transaction) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Transaction not found',
          },
        });
      }

      res.json(transaction);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /monitoring/events
 * Get event list with filtering and pagination
 */
router.get(
  '/events',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = eventsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parseResult.error.flatten().fieldErrors,
          },
        });
      }

      const { network, ...options } = parseResult.data;

      const result = await monitoringService.getEvents(
        req.user!.id,
        network,
        options
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /monitoring/gas
 * Get gas analytics data
 */
router.get(
  '/gas',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = gasQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parseResult.error.flatten().fieldErrors,
          },
        });
      }

      const { period, network, moduleAddress } = parseResult.data;

      const analytics = await monitoringService.getGasAnalytics(
        req.user!.id,
        period,
        network,
        moduleAddress
      );

      res.json(analytics);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /monitoring/contracts
 * Get user's watched contracts
 */
router.get(
  '/contracts',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const contracts = await monitoringService.getWatchedContracts(
        req.user!.id
      );

      res.json({ contracts });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /monitoring/contracts
 * Add a watched contract
 */
router.post(
  '/contracts',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = createContractSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parseResult.error.flatten().fieldErrors,
          },
        });
      }

      const contract = await monitoringService.addWatchedContract(
        req.user!.id,
        parseResult.data
      );

      res.status(201).json(contract);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        return res.status(409).json({
          error: {
            code: 'DUPLICATE_CONTRACT',
            message:
              'This contract is already being watched on the specified network',
          },
        });
      }
      next(error);
    }
  }
);

/**
 * DELETE /monitoring/contracts/:id
 * Remove a watched contract
 */
router.delete(
  '/contracts/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const deleted = await monitoringService.removeWatchedContract(
        req.user!.id,
        id
      );

      if (!deleted) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Watched contract not found',
          },
        });
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
