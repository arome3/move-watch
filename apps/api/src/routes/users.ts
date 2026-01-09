import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import type { UpdateNotificationPreferenceRequest } from '@movewatch/shared';
import * as userService from '../services/userService.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router: RouterType = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// Update profile schema
const updateProfileSchema = z.object({
  name: z.string().max(100, 'Name too long').optional(),
  image: z.string().url('Invalid image URL').optional(),
});

// Update preferences schema
const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  emailAddress: z.string().email('Invalid email address').optional().nullable(),
});

// ============================================================================
// PROFILE ROUTES
// ============================================================================

/**
 * GET /users/me
 * Get current user profile
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const profile = await userService.getProfile(userId);

    if (!profile) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /users/me
 * Update current user profile
 */
router.patch('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const parseResult = updateProfileSchema.safeParse(req.body);

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

    const profile = await userService.updateProfile(userId, parseResult.data);

    if (!profile) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// WALLET ROUTES
// ============================================================================

/**
 * POST /users/me/wallet/disconnect
 * Disconnect wallet from user account
 */
router.post('/me/wallet/disconnect', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    await userService.disconnectWallet(userId);

    res.json({
      success: true,
      message: 'Wallet disconnected successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot disconnect wallet')) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
    }
    next(error);
  }
});

// ============================================================================
// NOTIFICATION PREFERENCES ROUTES
// ============================================================================

/**
 * GET /users/me/preferences
 * Get notification preferences
 */
router.get('/me/preferences', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const preferences = await userService.getPreferences(userId);

    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /users/me/preferences
 * Update notification preferences
 */
router.patch('/me/preferences', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const parseResult = updatePreferencesSchema.safeParse(req.body);

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

    const preferences = await userService.updatePreferences(userId, parseResult.data as UpdateNotificationPreferenceRequest);

    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

export default router;
