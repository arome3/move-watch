import { Router } from 'express';
import { z } from 'zod';
import * as alertService from '../services/alerts.js';
import { testNotificationChannels } from '../services/notifications.js';

const router = Router();

// Mock user ID for development (auth deferred)
const MOCK_USER_ID = alertService.MOCK_USER_ID;

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
]);

// Channel schemas using discriminated union
const channelSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('discord'),
    config: z.object({
      webhookUrl: z.string().url('Invalid Discord webhook URL'),
    }),
  }),
  z.object({
    type: z.literal('slack'),
    config: z.object({
      webhookUrl: z.string().url('Invalid Slack webhook URL'),
    }),
  }),
  z.object({
    type: z.literal('telegram'),
    config: z.object({
      botToken: z.string().min(1, 'Bot token is required'),
      chatId: z.string().min(1, 'Chat ID is required'),
    }),
  }),
  z.object({
    type: z.literal('webhook'),
    config: z.object({
      url: z.string().url('Invalid webhook URL'),
      authHeader: z.string().optional(),
      authValue: z.string().optional(),
    }),
  }),
]);

// Create alert schema
const createAlertSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  network: z.enum(['mainnet', 'testnet', 'devnet']).optional(),
  condition: conditionSchema,
  channels: z.array(channelSchema).min(1, 'At least one channel required').max(5, 'Maximum 5 channels'),
  cooldownSeconds: z.number().int().min(0).max(86400).optional(),
});

// Update alert schema (all fields optional)
const updateAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  network: z.enum(['mainnet', 'testnet', 'devnet']).optional(),
  condition: conditionSchema.optional(),
  channels: z.array(channelSchema).min(1).max(5).optional(),
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
router.get('/', async (req, res, next) => {
  try {
    const alerts = await alertService.getAlerts(MOCK_USER_ID);

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
 */
router.post('/', async (req, res, next) => {
  try {
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

    const alert = await alertService.createAlert(MOCK_USER_ID, parseResult.data);

    res.status(201).json(alert);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /alerts/:id
 * Get a specific alert
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const alert = await alertService.getAlertById(id, MOCK_USER_ID);

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
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

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

    const alert = await alertService.updateAlert(id, MOCK_USER_ID, parseResult.data);

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
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await alertService.deleteAlert(id, MOCK_USER_ID);

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
router.post('/:id/test', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get the alert to access its channels
    const alert = await alertService.getAlertById(id, MOCK_USER_ID);

    if (!alert) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Alert not found',
        },
      });
    }

    // We need the full channel configs, not just the summary
    // Fetch the alert with full channel data from the database
    const { prisma } = await import('../lib/prisma.js');
    const fullAlert = await prisma.alert.findUnique({
      where: { id },
      include: { channels: true },
    });

    if (!fullAlert) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Alert not found',
        },
      });
    }

    // Test all channels
    const results = await testNotificationChannels(
      fullAlert.channels.map((c) => ({
        type: c.type,
        config: c.config,
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
router.get('/:id/triggers', async (req, res, next) => {
  try {
    const { id } = req.params;

    const parseResult = paginationSchema.safeParse(req.query);
    const { limit, offset } = parseResult.success
      ? parseResult.data
      : { limit: 10, offset: 0 };

    const result = await alertService.getTriggers(id, MOCK_USER_ID, limit, offset);

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
