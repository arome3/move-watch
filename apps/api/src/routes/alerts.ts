import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import * as alertService from '../services/alerts.js';
import { testNotificationChannels } from '../services/notifications.js';
// Note: Alerts use subscription-based access, not x402 micropayments
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router: RouterType = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// Condition schemas using discriminated union
const conditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('tx_failed'),
    moduleAddress: z.string().min(1, 'Module address is required'),
    functionName: z.string().optional(),
  }),
  z.object({
    type: z.literal('balance_threshold'),
    address: z.string().regex(/^0x[a-fA-F0-9]{1,64}$/, 'Invalid address format'),
    tokenType: z.string().min(1, 'Token type is required'),
    threshold: z.string().regex(/^\d+$/, 'Threshold must be a numeric string'),
    operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']),
  }),
  z.object({
    type: z.literal('event_emitted'),
    eventType: z.string().min(1, 'Event type is required'),
    filters: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('gas_spike'),
    moduleAddress: z.string().min(1, 'Module address is required'),
    thresholdMultiplier: z.number().min(1, 'Multiplier must be at least 1'),
  }),
  // New condition types for Movement developers
  z.object({
    type: z.literal('function_call'),
    moduleAddress: z.string().min(1, 'Module address is required'),
    moduleName: z.string().min(1, 'Module name is required'),
    functionName: z.string().min(1, 'Function name is required'),
    trackSuccess: z.boolean().optional().default(true),
    trackFailed: z.boolean().optional().default(false),
    filters: z.object({
      sender: z.string().regex(/^0x[a-fA-F0-9]{1,64}$/).optional(),
      minGas: z.number().int().min(0).optional(),
    }).optional(),
  }),
  z.object({
    type: z.literal('token_transfer'),
    tokenType: z.string().min(1, 'Token type is required'),
    direction: z.enum(['in', 'out', 'both']),
    address: z.string().regex(/^0x[a-fA-F0-9]{1,64}$/, 'Invalid address format'),
    minAmount: z.string().regex(/^\d+$/, 'Min amount must be a numeric string').optional(),
    maxAmount: z.string().regex(/^\d+$/, 'Max amount must be a numeric string').optional(),
  }),
  z.object({
    type: z.literal('large_transaction'),
    tokenType: z.string().min(1, 'Token type is required'),
    threshold: z.string().regex(/^\d+$/, 'Threshold must be a numeric string'),
    addresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{1,64}$/)).optional(),
  }),
]);

// Create alert schema - now uses channelIds instead of inline channels
const createAlertSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  network: z.enum(['mainnet', 'testnet', 'devnet']).optional(),
  condition: conditionSchema,
  channelIds: z.array(z.string()).min(1, 'At least one channel required').max(10, 'Maximum 10 channels'),
  cooldownSeconds: z.number().int().min(0).max(86400).optional(),
});

// Update alert schema (all fields optional)
const updateAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  network: z.enum(['mainnet', 'testnet', 'devnet']).optional(),
  condition: conditionSchema.optional(),
  channelIds: z.array(z.string()).min(1).max(10).optional(),
  cooldownSeconds: z.number().int().min(0).max(86400).optional(),
});

// Pagination schema
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /alerts
 * List all alerts for the authenticated user
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const alerts = await alertService.getAlerts(userId);

    res.json({
      alerts,
      total: alerts.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /alerts
 * Create a new alert
 *
 * Access: Subscription-based (limit based on plan)
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const parseResult = createAlertSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }

    const alert = await alertService.createAlert(userId, parseResult.data);

    res.status(201).json(alert);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /alerts/:id
 * Get a specific alert
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const alert = await alertService.getAlertById(id, userId);

    if (!alert) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Alert not found',
        },
      });
    }

    res.json(alert);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /alerts/:id
 * Update an existing alert
 */
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const parseResult = updateAlertSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }

    const alert = await alertService.updateAlert(id, userId, parseResult.data);

    if (!alert) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Alert not found',
        },
      });
    }

    res.json(alert);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /alerts/:id
 * Delete an alert
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const deleted = await alertService.deleteAlert(id, userId);

    if (!deleted) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Alert not found',
        },
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /alerts/:id/test
 * Send a test notification to all configured channels
 */
router.post('/:id/test', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Fetch the alert with full channel data via junction table
    const { prisma } = await import('../lib/prisma.js');
    const fullAlert = await prisma.alert.findFirst({
      where: { id, userId },
      include: {
        alertChannels: {
          where: { enabled: true },
          include: {
            channel: true,
          },
        },
      },
    });

    if (!fullAlert) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Alert not found',
        },
      });
    }

    if (fullAlert.alertChannels.length === 0) {
      return res.status(400).json({
        error: {
          code: 'NO_CHANNELS',
          message: 'Alert has no enabled channels configured',
        },
      });
    }

    // Test all channels
    const results = await testNotificationChannels(
      fullAlert.alertChannels.map((ac) => ({
        type: ac.channel.type,
        config: ac.channel.config,
      }))
    );

    res.json({ results });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /alerts/:id/triggers
 * Get trigger history for an alert
 */
router.get('/:id/triggers', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const parseResult = paginationSchema.safeParse(req.query);
    const { limit, offset } = parseResult.success
      ? parseResult.data
      : { limit: 10, offset: 0 };

    const result = await alertService.getTriggers(id, userId, limit, offset);

    if (!result) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Alert not found',
        },
      });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
