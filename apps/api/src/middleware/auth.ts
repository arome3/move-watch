import type { Request, Response, NextFunction } from 'express';

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

/**
 * Extract user ID from X-User-ID header (for authenticated frontend requests)
 */
function extractUserIdHeader(req: Request): string | null {
  const userId = req.headers['x-user-id'];
  if (!userId || Array.isArray(userId)) return null;
  return userId;
}

/**
 * Verify JWT token and extract user information
 * In production, this will validate against NextAuth.js JWT secret
 * For now, we accept tokens and use mock user as fallback
 */
async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    // TODO: Implement proper JWT verification with NextAuth secret
    // For now, if a token is provided, we'll try to decode it
    // In production, use jose or jsonwebtoken to verify

    // Decode JWT payload (base64url decode the middle part)
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    // Extract user info from token
    return {
      id: payload.sub || payload.id,
      email: payload.email,
      walletAddress: payload.walletAddress,
      tier: payload.tier || 'FREE',
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
 * Supports both JWT Bearer tokens and X-User-ID header
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  const userIdHeader = extractUserIdHeader(req);

  // First try X-User-ID header (from authenticated frontend)
  if (userIdHeader) {
    req.user = {
      id: userIdHeader,
      email: null,
      walletAddress: null,
      tier: 'FREE',
    };
    next();
    return;
  }

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
 * Supports both JWT Bearer tokens and X-User-ID header
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  const userIdHeader = extractUserIdHeader(req);

  // First try X-User-ID header (from authenticated frontend)
  if (userIdHeader) {
    req.user = {
      id: userIdHeader,
      email: null,
      walletAddress: null,
      tier: 'FREE',
    };
    next();
    return;
  }

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
