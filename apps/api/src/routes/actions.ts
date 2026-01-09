import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import type { CreateActionRequest, UpdateActionRequest, ActionExecutionContext, ActionTriggerType, Network, WebhookTriggerConfig } from '@movewatch/shared';
import * as actionService from '../services/actions.js';
import { setSecret, deleteSecret, listSecretNames } from '../services/secretsManager.js';
import { executeAction } from '../services/actionExecutor.js';
import { decrypt } from '../lib/crypto.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { rateLimiters } from '../middleware/rateLimit.js';
// Note: Actions use subscription-based access, not x402 micropayments
import { nanoid } from 'nanoid';
import {
  actionTemplates,
  getTemplateById,
  getTemplatesByCategory,
  getTemplatesByDifficulty,
  type ActionTemplate,
} from '../templates/actionTemplates.js';

const router: RouterType = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// Filter condition schema (for event triggers)
const filterConditionSchema = z.object({
  operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains']),
  value: z.unknown(),
});

// Trigger config schemas using discriminated union
const triggerConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('event'),
    eventType: z.string().min(1, 'Event type is required'),
    moduleAddress: z.string().optional(),
    filters: z.record(filterConditionSchema).optional(),
  }),
  z.object({
    type: z.literal('block'),
    interval: z.number().int().min(1).max(10000).default(1),
  }),
  z.object({
    type: z.literal('schedule'),
    cron: z.string().min(1, 'Cron expression is required'),
    timezone: z.string().default('UTC'),
  }),
  z.object({
    type: z.literal('webhook'),
    webhookSecret: z.string().optional(), // Auto-generated if not provided
    requireHeaders: z.record(z.string()).optional(),
    allowedIps: z.array(z.string()).optional(),
  }),
]);

// Secret schema
const secretSchema = z.object({
  name: z.string()
    .regex(/^[A-Z_][A-Z0-9_]*$/, 'Secret name must be UPPER_SNAKE_CASE (e.g., API_KEY)')
    .max(50, 'Secret name too long'),
  value: z.string().min(1, 'Secret value is required').max(10000, 'Secret value too long'),
});

// Create action schema
const createActionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  code: z.string().min(1, 'Code is required').max(50000, 'Code too long'),
  network: z.enum(['mainnet', 'testnet', 'devnet']).optional(),
  triggerType: z.enum(['event', 'block', 'schedule', 'webhook']),
  triggerConfig: triggerConfigSchema,
  maxExecutionMs: z.number().int().min(1000).max(30000).optional(),
  memoryLimitMb: z.number().int().min(16).max(128).optional(),
  cooldownSeconds: z.number().int().min(0).max(86400).optional(),
  secrets: z.array(secretSchema).max(10).optional(),
});

// Update action schema (all fields optional)
const updateActionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  code: z.string().min(1).max(50000).optional(),
  enabled: z.boolean().optional(),
  network: z.enum(['mainnet', 'testnet', 'devnet']).optional(),
  triggerType: z.enum(['event', 'block', 'schedule', 'webhook']).optional(),
  triggerConfig: triggerConfigSchema.optional(),
  maxExecutionMs: z.number().int().min(1000).max(30000).optional(),
  memoryLimitMb: z.number().int().min(16).max(128).optional(),
  cooldownSeconds: z.number().int().min(0).max(86400).optional(),
});

// Pagination schema
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

// Test action schema
const testActionSchema = z.object({
  triggerData: z.unknown().optional(),
});

// ============================================================================
// TEMPLATE ROUTES (no auth required)
// ============================================================================

/**
 * GET /actions/templates
 * List all available action templates
 *
 * Query params:
 * - category: Filter by category (defi, security, monitoring, nft, utility)
 * - difficulty: Filter by difficulty (beginner, intermediate, advanced)
 * - network: Filter by network (mainnet, testnet, both)
 */
router.get('/templates', (req, res) => {
  let templates: ActionTemplate[] = [...actionTemplates];

  // Filter by category
  const category = req.query.category as string;
  if (category && ['defi', 'security', 'monitoring', 'nft', 'utility'].includes(category)) {
    templates = templates.filter((t) => t.category === category);
  }

  // Filter by difficulty
  const difficulty = req.query.difficulty as string;
  if (difficulty && ['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
    templates = templates.filter((t) => t.difficulty === difficulty);
  }

  // Filter by network
  const network = req.query.network as string;
  if (network && ['mainnet', 'testnet', 'both'].includes(network)) {
    templates = templates.filter((t) => t.network === network || t.network === 'both');
  }

  res.json({
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      triggerType: t.triggerType,
      network: t.network,
      difficulty: t.difficulty,
      requiredSecrets: t.requiredSecrets,
    })),
    total: templates.length,
  });
});

/**
 * GET /actions/templates/:id
 * Get a specific template with full code
 */
router.get('/templates/:id', (req, res) => {
  const { id } = req.params;
  const template = getTemplateById(id);

  if (!template) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Template not found',
      },
    });
  }

  res.json(template);
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /actions
 * List all actions for the authenticated user
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const actions = await actionService.getActions(userId);

    res.json({
      actions,
      total: actions.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /actions
 * Create a new action
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const parseResult = createActionSchema.safeParse(req.body);

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

    // Validate trigger config matches trigger type
    if (parseResult.data.triggerConfig.type !== parseResult.data.triggerType) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Trigger config type must match triggerType',
        },
      });
    }

    const userId = req.user!.id;
    const action = await actionService.createAction(userId, parseResult.data as CreateActionRequest);

    res.status(201).json(action);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /actions/:id
 * Get a specific action with full details
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const action = await actionService.getActionById(id, userId);

    if (!action) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Action not found',
        },
      });
    }

    res.json(action);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /actions/:id
 * Update an existing action
 */
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const parseResult = updateActionSchema.safeParse(req.body);

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

    // Validate trigger config matches trigger type if both provided
    const data = parseResult.data;
    if (data.triggerConfig && data.triggerType && data.triggerConfig.type !== data.triggerType) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Trigger config type must match triggerType',
        },
      });
    }

    const action = await actionService.updateAction(id, userId, data as UpdateActionRequest);

    if (!action) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Action not found',
        },
      });
    }

    res.json(action);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /actions/:id
 * Delete an action
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const deleted = await actionService.deleteAction(id, userId);

    if (!deleted) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Action not found',
        },
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /actions/:id/test
 * Test execute an action with mock trigger data
 *
 * Access: Subscription-based (included in Pro and Enterprise)
 */
router.post(
  '/:id/test',
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const parseResult = testActionSchema.safeParse(req.body);
    const triggerData = parseResult.success ? parseResult.data.triggerData : undefined;

    // Verify ownership and get full action with secrets
    const action = await prisma.action.findFirst({
      where: { id, userId },
      include: {
        secrets: {
          select: { name: true, encryptedValue: true, iv: true },
        },
      },
    });

    if (!action) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Action not found',
        },
      });
    }

    // Decrypt secrets for execution context
    const secrets: Record<string, string> = {};
    for (const secret of action.secrets) {
      try {
        // The encryptedValue is stored as "ciphertext:authTag"
        const [encrypted, authTag] = secret.encryptedValue.split(':');
        secrets[secret.name] = decrypt({
          encrypted,
          iv: secret.iv,
          authTag,
        });
      } catch (decryptError) {
        console.error(`Failed to decrypt secret ${secret.name}:`, decryptError);
        // Continue without this secret - don't fail the entire test
      }
    }

    // Build test execution context
    const testExecutionId = `test_${nanoid(12)}`;
    const context: ActionExecutionContext = {
      actionId: action.id,
      executionId: testExecutionId,
      network: action.network.toLowerCase() as Network,
      triggerType: action.triggerType.toLowerCase() as ActionTriggerType,
      triggerData: triggerData || {
        type: 'test',
        triggeredAt: new Date().toISOString(),
        isTest: true,
      },
      secrets,
    };

    // Execute the action in sandbox
    const result = await executeAction(action.code, context, {
      memoryLimitMb: action.memoryLimitMb,
      timeoutMs: action.maxExecutionMs,
    });

    // Return test result (not persisted to database for test executions)
    res.json({
      executionId: testExecutionId,
      status: result.success ? 'SUCCESS' : 'FAILED',
      duration: result.durationMs,
      memoryUsedMb: result.memoryUsedMb,
      output: result.result,
      logs: result.logs,
      error: result.error,
      isTest: true,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /actions/:id/executions
 * Get execution history for an action
 */
router.get('/:id/executions', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const parseResult = paginationSchema.safeParse(req.query);
    const { limit, offset } = parseResult.success
      ? parseResult.data
      : { limit: 10, offset: 0 };

    const result = await actionService.getExecutions(id, userId, limit, offset);

    if (!result) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Action not found',
        },
      });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /actions/:id/executions/:execId
 * Get a specific execution with full details
 */
router.get('/:id/executions/:execId', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { execId } = req.params;
    const userId = req.user!.id;

    const execution = await actionService.getExecutionById(execId, userId);

    if (!execution) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Execution not found',
        },
      });
    }

    res.json(execution);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// SECRETS ROUTES
// ============================================================================

/**
 * GET /actions/:id/secrets
 * List all secret names for an action (not values)
 */
router.get('/:id/secrets', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const action = await actionService.getActionById(id, userId);
    if (!action) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Action not found',
        },
      });
    }

    const names = await listSecretNames(id);

    res.json({
      secrets: names.map((name) => ({ name, configured: true })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /actions/:id/secrets
 * Add or update a secret
 */
router.post('/:id/secrets', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const parseResult = secretSchema.safeParse(req.body);

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

    // Verify ownership
    const action = await actionService.getActionById(id, userId);
    if (!action) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Action not found',
        },
      });
    }

    const { name, value } = parseResult.data;
    await setSecret(id, name, value);

    res.status(201).json({
      name,
      configured: true,
      message: 'Secret saved successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /actions/:id/secrets/:name
 * Delete a secret
 */
router.delete('/:id/secrets/:name', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id, name } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const action = await actionService.getActionById(id, userId);
    if (!action) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Action not found',
        },
      });
    }

    const deleted = await deleteSecret(id, name);

    if (!deleted) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Secret not found',
        },
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// PUBLIC WEBHOOK ENDPOINT
// ============================================================================

/**
 * Validate HMAC signature for webhook requests
 */
function validateWebhookSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;

  // Support both "sha256=xxx" format (GitHub style) and raw signature
  const signatureValue = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureValue, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * POST /actions/webhook/:id
 * Public webhook endpoint for triggering actions
 *
 * Security:
 * - Rate limited (60 requests/minute per action per IP) to prevent abuse
 * - Validates HMAC signature if webhookSecret is configured
 * - Checks allowed IPs if configured
 * - Checks required headers if configured
 */
router.post('/webhook/:id', rateLimiters.webhook(), async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawBody = JSON.stringify(req.body);

    // Fetch action with webhook trigger config
    const action = await prisma.action.findUnique({
      where: { id },
      include: {
        secrets: {
          select: { name: true, encryptedValue: true, iv: true },
        },
      },
    });

    if (!action) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Action not found',
        },
      });
    }

    // Verify action is webhook-triggered and enabled
    if (action.triggerType !== 'WEBHOOK') {
      return res.status(400).json({
        error: {
          code: 'INVALID_TRIGGER',
          message: 'This action is not configured for webhook triggers',
        },
      });
    }

    if (!action.enabled) {
      return res.status(400).json({
        error: {
          code: 'ACTION_DISABLED',
          message: 'This action is currently disabled',
        },
      });
    }

    // Parse trigger config
    const triggerConfig = action.triggerConfig as unknown as WebhookTriggerConfig;

    // Validate webhook secret (HMAC signature)
    if (triggerConfig.webhookSecret) {
      const signature = req.headers['x-webhook-signature'] as string | undefined;
      if (!validateWebhookSignature(rawBody, signature, triggerConfig.webhookSecret)) {
        return res.status(401).json({
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Invalid or missing webhook signature',
          },
        });
      }
    }

    // Check allowed IPs
    if (triggerConfig.allowedIps && triggerConfig.allowedIps.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress || '';
      const isAllowed = triggerConfig.allowedIps.some(
        (allowedIp) => clientIp === allowedIp || clientIp.endsWith(allowedIp)
      );
      if (!isAllowed) {
        return res.status(403).json({
          error: {
            code: 'IP_NOT_ALLOWED',
            message: 'Request from this IP address is not allowed',
          },
        });
      }
    }

    // Check required headers
    if (triggerConfig.requireHeaders) {
      for (const [header, expectedValue] of Object.entries(triggerConfig.requireHeaders)) {
        const actualValue = req.headers[header.toLowerCase()];
        if (actualValue !== expectedValue) {
          return res.status(400).json({
            error: {
              code: 'MISSING_HEADER',
              message: `Required header '${header}' is missing or has incorrect value`,
            },
          });
        }
      }
    }

    // Check cooldown
    if (action.cooldownSeconds > 0) {
      const lastExecution = await prisma.actionExecution.findFirst({
        where: { actionId: id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (lastExecution) {
        const cooldownMs = action.cooldownSeconds * 1000;
        const timeSinceLastExec = Date.now() - lastExecution.createdAt.getTime();
        if (timeSinceLastExec < cooldownMs) {
          const retryAfter = Math.ceil((cooldownMs - timeSinceLastExec) / 1000);
          res.setHeader('Retry-After', retryAfter.toString());
          return res.status(429).json({
            error: {
              code: 'COOLDOWN_ACTIVE',
              message: `Action is in cooldown. Retry after ${retryAfter} seconds.`,
              retryAfter,
            },
          });
        }
      }
    }

    // Decrypt secrets for execution
    const secrets: Record<string, string> = {};
    for (const secret of action.secrets) {
      try {
        const [encrypted, authTag] = secret.encryptedValue.split(':');
        secrets[secret.name] = decrypt({
          encrypted,
          iv: secret.iv,
          authTag,
        });
      } catch (decryptError) {
        console.error(`Failed to decrypt secret ${secret.name}:`, decryptError);
      }
    }

    // Build execution context
    const executionId = `exec_${nanoid(12)}`;
    const context: ActionExecutionContext = {
      actionId: action.id,
      executionId,
      network: action.network.toLowerCase() as Network,
      triggerType: 'webhook',
      triggerData: {
        type: 'webhook',
        method: req.method,
        headers: req.headers,
        body: req.body,
        query: req.query,
        ip: req.ip || req.socket.remoteAddress,
        triggeredAt: new Date().toISOString(),
      },
      secrets,
    };

    // Execute the action
    const startTime = Date.now();
    const result = await executeAction(action.code, context, {
      memoryLimitMb: action.memoryLimitMb,
      timeoutMs: action.maxExecutionMs,
    });

    // Record execution in database
    await prisma.actionExecution.create({
      data: {
        id: executionId,
        actionId: action.id,
        status: result.success ? 'SUCCESS' : 'FAILED',
        triggerData: context.triggerData as object,
        result: result.result as object | undefined,
        logs: result.logs,
        error: result.error ? { message: result.error.message, stack: result.error.stack } : undefined,
        durationMs: result.durationMs,
        memoryUsedMb: result.memoryUsedMb,
      },
    });

    // Update action stats
    await prisma.action.update({
      where: { id },
      data: {
        lastExecutedAt: new Date(),
        executionCount: { increment: 1 },
        ...(result.success ? {} : { failureCount: { increment: 1 } }),
      },
    });

    // Return result
    res.status(result.success ? 200 : 500).json({
      executionId,
      status: result.success ? 'SUCCESS' : 'FAILED',
      duration: result.durationMs,
      output: result.result,
      ...(result.error && { error: result.error }),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
