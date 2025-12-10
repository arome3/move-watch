import type { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../lib/redis.js';
import { RATE_LIMITS } from '@movewatch/shared';

// Rate limit window: 24 hours
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60 * 24;

/**
 * Get client IP address from request
 * Handles proxy headers for production deployments
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Rate limiting middleware for simulation endpoint
 * Uses Redis sliding window for accurate limiting
 */
export function rateLimit(endpoint: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // For MVP, all users are anonymous with FREE tier limits
      const limit = RATE_LIMITS.FREE;
      const ip = getClientIp(req);
      const key = `ratelimit:${endpoint}:${ip}`;

      const { allowed, remaining } = await checkRateLimit(
        key,
        limit,
        RATE_LIMIT_WINDOW_SECONDS
      );

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);

      if (!allowed) {
        return res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: `Rate limit exceeded. You can perform ${limit} simulations per day.`,
            details: {
              limit,
              remaining: 0,
              resetInSeconds: RATE_LIMIT_WINDOW_SECONDS,
            },
          },
        });
      }

      next();
    } catch (error) {
      // If Redis fails, allow the request but log the error
      console.error('Rate limit check failed:', error);
      next();
    }
  };
}
