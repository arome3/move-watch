import type { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../lib/redis.js';
import { RATE_LIMITS, ENDPOINT_RATE_LIMITS } from '@movewatch/shared';

// Rate limit window: 24 hours (for daily limits)
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
 * Rate limiting middleware for daily limits (simulation endpoint)
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

/**
 * Rate limiting configuration options
 */
export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

/**
 * Flexible rate limiting middleware with configurable options
 *
 * @param endpoint - Endpoint name for the rate limit key prefix
 * @param options - Rate limit configuration options
 */
export function rateLimitWithOptions(
  endpoint: string,
  options: RateLimitOptions
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, windowSeconds, keyGenerator, message } = options;

      // Generate rate limit key
      const keyPart = keyGenerator
        ? keyGenerator(req)
        : getClientIp(req);
      const key = `ratelimit:${endpoint}:${keyPart}`;

      const { allowed, remaining } = await checkRateLimit(
        key,
        limit,
        windowSeconds
      );

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + windowSeconds);

      if (!allowed) {
        return res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: message || `Rate limit exceeded. Maximum ${limit} requests per ${windowSeconds} seconds.`,
            details: {
              limit,
              remaining: 0,
              resetInSeconds: windowSeconds,
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

/**
 * Pre-configured rate limiters for specific endpoints
 */
export const rateLimiters = {
  /**
   * Rate limiter for public webhook endpoints
   * Key: IP + action ID
   */
  webhook: (actionIdParam = 'id') =>
    rateLimitWithOptions('webhook', {
      ...ENDPOINT_RATE_LIMITS.WEBHOOK,
      keyGenerator: (req) => `${getClientIp(req)}:${req.params[actionIdParam]}`,
      message: 'Webhook rate limit exceeded. Maximum 60 requests per minute per action.',
    }),

  /**
   * Rate limiter for channel test endpoint
   * Key: User ID (from auth)
   */
  channelTest: rateLimitWithOptions('channel_test', {
    ...ENDPOINT_RATE_LIMITS.CHANNEL_TEST,
    keyGenerator: (req) => (req as Request & { user?: { id: string } }).user?.id || getClientIp(req),
    message: 'Test notification rate limit exceeded. Maximum 5 tests per minute.',
  }),

  /**
   * Rate limiter for alert creation
   * Key: User ID (from auth)
   */
  alertCreate: rateLimitWithOptions('alert_create', {
    ...ENDPOINT_RATE_LIMITS.ALERT_CREATE,
    keyGenerator: (req) => (req as Request & { user?: { id: string } }).user?.id || getClientIp(req),
    message: 'Alert creation rate limit exceeded. Maximum 10 alerts per minute.',
  }),

  /**
   * Rate limiter for manual action execution
   * Key: User ID (from auth)
   */
  actionExecute: rateLimitWithOptions('action_execute', {
    ...ENDPOINT_RATE_LIMITS.ACTION_EXECUTE,
    keyGenerator: (req) => (req as Request & { user?: { id: string } }).user?.id || getClientIp(req),
    message: 'Action execution rate limit exceeded. Maximum 30 executions per minute.',
  }),

  /**
   * General rate limiter for public APIs
   * Key: IP address
   */
  publicApi: rateLimitWithOptions('public_api', {
    ...ENDPOINT_RATE_LIMITS.PUBLIC_API,
    message: 'API rate limit exceeded. Maximum 100 requests per minute.',
  }),
};
