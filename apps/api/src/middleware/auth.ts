import type { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import { prisma } from '@movewatch/database';
import { validateApiKey } from '../services/apiKeyService.js';

// Mock user ID for development (same as alerts service)
export const MOCK_USER_ID = 'mock-user-dev-001';

// Authenticated user information
export interface AuthUser {
  id: string;
  email?: string | null;
  walletAddress?: string | null;
  tier: 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
}

// Extend Express Request to include user
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

// SECURITY: X-User-ID header authentication REMOVED
// This was a critical vulnerability allowing any user impersonation
// All requests must now use JWT Bearer tokens or API keys

/**
 * Extract API key from X-API-Key header
 */
function extractApiKey(req: Request): string | null {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || Array.isArray(apiKey)) return null;
  return apiKey;
}

/**
 * Verify JWT token and extract user information
 * Validates against NextAuth.js JWT secret and looks up user in database
 */
async function verifyToken(token: string): Promise<AuthUser | null> {
  const secret = process.env.NEXTAUTH_SECRET;

  // If no secret configured, fall back to decode-only in development
  if (!secret) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('NEXTAUTH_SECRET not configured, using decode-only verification');
      return decodeTokenWithoutVerification(token);
    }
    console.error('NEXTAUTH_SECRET not configured in production');
    return null;
  }

  try {
    // Verify JWT signature using jose
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey);

    // Extract user ID from token (NextAuth uses 'sub' or 'id')
    const userId = (payload.sub || payload.id) as string;
    if (!userId) return null;

    // Look up user in database to get current tier and details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, walletAddress: true, tier: true },
    });

    if (!user) {
      console.warn(`User not found in database: ${userId}`);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      tier: user.tier.toUpperCase() as AuthUser['tier'],
    };
  } catch (error) {
    // Log specific JWT errors for debugging
    if (error instanceof jose.errors.JWTExpired) {
      console.warn('JWT token expired');
    } else if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
      console.warn('JWT signature verification failed');
    } else {
      console.error('JWT verification error:', error);
    }
    return null;
  }
}

/**
 * Decode token without verification (development fallback)
 */
function decodeTokenWithoutVerification(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    return {
      id: payload.sub || payload.id,
      email: payload.email,
      walletAddress: payload.walletAddress,
      tier: (payload.tier || 'FREE').toUpperCase() as AuthUser['tier'],
    };
  } catch {
    return null;
  }
}

/**
 * Get mock user for development
 */
function getMockUser(): AuthUser {
  return {
    id: MOCK_USER_ID,
    email: 'dev@movewatch.io',
    walletAddress: null,
    tier: 'FREE',
  };
}

/**
 * Authentication middleware - requires valid user
 * Falls back to mock user in development mode
 * Supports API keys (X-API-Key) and JWT Bearer tokens only
 * SECURITY: X-User-ID header removed - was a critical auth bypass vulnerability
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const apiKey = extractApiKey(req);
  const token = extractBearerToken(req);

  // First try API key authentication
  if (apiKey) {
    validateApiKey(apiKey)
      .then((user) => {
        if (user) {
          req.user = {
            id: user.userId,
            email: user.email,
            walletAddress: user.walletAddress,
            tier: user.tier,
          };
          next();
        } else if (process.env.NODE_ENV !== 'production') {
          console.warn('Invalid API key, using mock user for development');
          req.user = getMockUser();
          next();
        } else {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid, expired, or revoked API key',
            },
          });
        }
      })
      .catch((error) => {
        console.error('API key validation error:', error);
        if (process.env.NODE_ENV !== 'production') {
          req.user = getMockUser();
          next();
        } else {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'API key validation failed',
            },
          });
        }
      });
    return;
  }

  // Try JWT Bearer token authentication
  if (token) {
    // Verify token asynchronously
    verifyToken(token)
      .then((user) => {
        if (user) {
          req.user = user;
          next();
        } else if (process.env.NODE_ENV !== 'production') {
          // In development, fall back to mock user
          console.warn('Invalid token, using mock user for development');
          req.user = getMockUser();
          next();
        } else {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid or expired authentication token',
            },
          });
        }
      })
      .catch((error) => {
        console.error('Token verification error:', error);
        if (process.env.NODE_ENV !== 'production') {
          req.user = getMockUser();
          next();
        } else {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication failed',
            },
          });
        }
      });
  } else if (process.env.NODE_ENV !== 'production') {
    // In development without token, use mock user
    req.user = getMockUser();
    next();
  } else {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if valid token provided, otherwise continues without user
 * Falls back to mock user in development mode
 * Supports API keys (X-API-Key) and JWT Bearer tokens only
 * SECURITY: X-User-ID header removed - was a critical auth bypass vulnerability
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const apiKey = extractApiKey(req);
  const token = extractBearerToken(req);

  // First try API key authentication
  if (apiKey) {
    validateApiKey(apiKey)
      .then((user) => {
        if (user) {
          req.user = {
            id: user.userId,
            email: user.email,
            walletAddress: user.walletAddress,
            tier: user.tier,
          };
        } else if (process.env.NODE_ENV !== 'production') {
          req.user = getMockUser();
        }
        next();
      })
      .catch((error) => {
        console.error('API key validation error:', error);
        if (process.env.NODE_ENV !== 'production') {
          req.user = getMockUser();
        }
        next();
      });
    return;
  }

  // Try JWT Bearer token authentication
  if (token) {
    verifyToken(token)
      .then((user) => {
        if (user) {
          req.user = user;
        } else if (process.env.NODE_ENV !== 'production') {
          req.user = getMockUser();
        }
        next();
      })
      .catch((error) => {
        console.error('Token verification error:', error);
        if (process.env.NODE_ENV !== 'production') {
          req.user = getMockUser();
        }
        next();
      });
  } else if (process.env.NODE_ENV !== 'production') {
    // In development without token, use mock user
    req.user = getMockUser();
    next();
  } else {
    // No token in production - continue without user
    next();
  }
}

/**
 * Middleware to check user ownership of a resource
 */
export function requireOwnership(
  getUserId: (req: AuthenticatedRequest) => Promise<string | null>
) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    try {
      const resourceUserId = await getUserId(req);

      if (!resourceUserId) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Resource not found',
          },
        });
        return;
      }

      if (resourceUserId !== req.user.id) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this resource',
          },
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to verify resource ownership',
        },
      });
    }
  };
}
