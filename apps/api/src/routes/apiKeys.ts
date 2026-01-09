import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import * as apiKeyService from '../services/apiKeyService.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router: RouterType = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// Create API key schema
const createApiKeySchema = z.object({
  name: z.string().max(100, 'Name too long').optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api-keys
 * List all API keys for the authenticated user (masked)
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const result = await apiKeyService.getApiKeys(userId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api-keys
 * Create a new API key
 * Returns the full key ONCE - it cannot be retrieved again
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const parseResult = createApiKeySchema.safeParse(req.body);

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

    const apiKey = await apiKeyService.createApiKey(userId, parseResult.data);

    res.status(201).json({
      ...apiKey,
      message: 'API key created successfully. Save this key - it will not be shown again!',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api-keys/:id
 * Get a specific API key (masked)
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const apiKey = await apiKeyService.getApiKeyById(id, userId);

    if (!apiKey) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'API key not found',
        },
      });
    }

    res.json(apiKey);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api-keys/:id
 * Revoke an API key (soft delete)
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const revoked = await apiKeyService.revokeApiKey(id, userId);

    if (!revoked) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'API key not found',
        },
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
