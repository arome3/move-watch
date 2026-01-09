import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import type { Prisma } from '@movewatch/database';
import { prisma } from '../lib/prisma.js';
import { testNotificationChannels } from '../services/notifications.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { rateLimiters } from '../middleware/rateLimit.js';
import {
  encryptChannelConfig,
  getDisplayConfig,
  getNotificationConfig,
} from '../services/channelConfigService.js';

const router: RouterType = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// Channel config schemas using discriminated union
const channelConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('discord'),
    webhookUrl: z.string().url('Invalid Discord webhook URL'),
  }),
  z.object({
    type: z.literal('slack'),
    webhookUrl: z.string().url('Invalid Slack webhook URL'),
  }),
  z.object({
    type: z.literal('telegram'),
    botToken: z.string().min(1, 'Bot token is required'),
    chatId: z.string().min(1, 'Chat ID is required'),
  }),
  z.object({
    type: z.literal('webhook'),
    url: z.string().url('Invalid webhook URL'),
    authHeader: z.string().optional(),
    authValue: z.string().optional(),
  }),
  z.object({
    type: z.literal('email'),
    email: z.string().email('Invalid email address'),
  }),
]);

// Create channel schema
const createChannelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  type: z.enum(['discord', 'slack', 'telegram', 'webhook', 'email']),
  config: z.record(z.unknown()), // Validated more specifically below
});

// Update channel schema
const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateChannelConfig(type: string, config: Record<string, unknown>) {
  const configWithType = { type, ...config };
  return channelConfigSchema.safeParse(configWithType);
}

function formatChannel(channel: {
  id: string;
  name: string;
  type: string;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
  _count?: { alertChannels: number };
}) {
  const channelType = channel.type.toLowerCase();
  return {
    id: channel.id,
    name: channel.name,
    type: channelType,
    // SECURITY: Mask sensitive config fields (webhook URLs, bot tokens)
    config: getDisplayConfig(channelType, channel.config),
    alertCount: channel._count?.alertChannels ?? 0,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /channels
 * List all notification channels for the authenticated user
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const channels = await prisma.notificationChannel.findMany({
      where: { userId },
      include: {
        _count: {
          select: { alertChannels: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      channels: channels.map(formatChannel),
      total: channels.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /channels
 * Create a new notification channel
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const parseResult = createChannelSchema.safeParse(req.body);

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

    const { name, type, config } = parseResult.data;

    // Validate config for the specific channel type
    const configValidation = validateChannelConfig(type, config as Record<string, unknown>);
    if (!configValidation.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid channel configuration',
          details: configValidation.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }

    // SECURITY: Encrypt sensitive fields in config before storing
    const encryptedConfig = encryptChannelConfig(type, config as Record<string, unknown>);

    const channel = await prisma.notificationChannel.create({
      data: {
        userId,
        name,
        type: type.toUpperCase() as 'DISCORD' | 'SLACK' | 'TELEGRAM' | 'WEBHOOK' | 'EMAIL',
        config: encryptedConfig as Prisma.InputJsonValue,
      },
      include: {
        _count: {
          select: { alertChannels: true },
        },
      },
    });

    res.status(201).json(formatChannel(channel));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /channels/:id
 * Get a specific notification channel
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const channel = await prisma.notificationChannel.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { alertChannels: true },
        },
        alertChannels: {
          include: {
            alert: {
              select: {
                id: true,
                name: true,
                enabled: true,
              },
            },
          },
        },
      },
    });

    if (!channel) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Channel not found',
        },
      });
    }

    res.json({
      ...formatChannel(channel),
      alerts: channel.alertChannels.map((ac) => ({
        id: ac.alert.id,
        name: ac.alert.name,
        enabled: ac.alert.enabled,
        channelEnabled: ac.enabled,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /channels/:id
 * Update an existing notification channel
 */
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const parseResult = updateChannelSchema.safeParse(req.body);

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

    // Check if channel exists and belongs to user
    const existing = await prisma.notificationChannel.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Channel not found',
        },
      });
    }

    const { name, config } = parseResult.data;

    // If config is being updated, validate it
    if (config) {
      const configValidation = validateChannelConfig(
        existing.type.toLowerCase(),
        config as Record<string, unknown>
      );
      if (!configValidation.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid channel configuration',
            details: configValidation.error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }
    }

    // SECURITY: Encrypt sensitive fields if config is being updated
    const encryptedConfig = config
      ? encryptChannelConfig(existing.type.toLowerCase(), config as Record<string, unknown>)
      : undefined;

    const channel = await prisma.notificationChannel.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(encryptedConfig && { config: encryptedConfig as Prisma.InputJsonValue }),
      },
      include: {
        _count: {
          select: { alertChannels: true },
        },
      },
    });

    res.json(formatChannel(channel));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /channels/:id
 * Delete a notification channel
 *
 * Query params:
 * - force: If true, delete even if channel is in use by alerts
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const force = req.query.force === 'true';

    // Check if channel exists and belongs to user
    const existing = await prisma.notificationChannel.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { alertChannels: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Channel not found',
        },
      });
    }

    // Block deletion if channel is in use (unless force=true)
    if (existing._count.alertChannels > 0 && !force) {
      return res.status(409).json({
        error: {
          code: 'CHANNEL_IN_USE',
          message: `This channel is used by ${existing._count.alertChannels} alert(s). Delete those alerts first, or use ?force=true to delete anyway.`,
          alertCount: existing._count.alertChannels,
        },
      });
    }

    await prisma.notificationChannel.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /channels/:id/test
 * Send a test notification to this channel
 * Rate limited to 5 tests per minute per user
 */
router.post('/:id/test', requireAuth, rateLimiters.channelTest, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const channel = await prisma.notificationChannel.findFirst({
      where: { id, userId },
    });

    if (!channel) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Channel not found',
        },
      });
    }

    // SECURITY: Decrypt config before testing notification
    const decryptedConfig = getNotificationConfig(
      channel.type.toLowerCase(),
      channel.config
    );

    const results = await testNotificationChannels([
      {
        type: channel.type,
        config: decryptedConfig,
      },
    ]);

    res.json({
      success: results[0]?.success ?? false,
      latencyMs: results[0]?.latencyMs,
      error: results[0]?.error,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
