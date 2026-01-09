import crypto from 'crypto';
import {
  type ApiKeyResponse,
  type CreateApiKeyRequest,
  type CreateApiKeyResponse,
  type ApiKeysListResponse,
} from '@movewatch/shared';
import { prisma } from '../lib/prisma.js';

// API key configuration
const API_KEY_PREFIX = 'mw_live_';
const API_KEY_RANDOM_BYTES = 32;  // 32 bytes = 64 hex chars of randomness

/**
 * Generate a new API key
 * Returns the full key (shown once) along with prefix and hash for storage
 */
export function generateApiKey(): {
  fullKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  // Generate cryptographically secure random bytes
  const randomPart = crypto.randomBytes(API_KEY_RANDOM_BYTES).toString('base64url');

  // Full key: prefix + random part
  const fullKey = `${API_KEY_PREFIX}${randomPart}`;

  // Key prefix for display: show first 8 chars of random part + ellipsis
  const keyPrefix = `${API_KEY_PREFIX}${randomPart.substring(0, 8)}...`;

  // Hash for secure storage and lookup
  const keyHash = hashApiKey(fullKey);

  return { fullKey, keyPrefix, keyHash };
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length > API_KEY_PREFIX.length + 20;
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(
  userId: string,
  request: CreateApiKeyRequest
): Promise<CreateApiKeyResponse> {
  const { fullKey, keyPrefix, keyHash } = generateApiKey();

  // Calculate expiration date if specified
  let expiresAt: Date | null = null;
  if (request.expiresInDays && request.expiresInDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + request.expiresInDays);
  }

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      name: request.name || null,
      keyPrefix,
      keyHash,
      expiresAt,
    },
  });

  return {
    id: apiKey.id,
    key: fullKey,  // Full key shown only once!
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    expiresAt: apiKey.expiresAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
  };
}

/**
 * Get all API keys for a user (masked)
 */
export async function getApiKeys(userId: string): Promise<ApiKeysListResponse> {
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return {
    apiKeys: apiKeys.map(formatApiKeyResponse),
    total: apiKeys.length,
  };
}

/**
 * Get a single API key by ID (for owner)
 */
export async function getApiKeyById(
  id: string,
  userId: string
): Promise<ApiKeyResponse | null> {
  const apiKey = await prisma.apiKey.findFirst({
    where: { id, userId },
  });

  if (!apiKey) return null;
  return formatApiKeyResponse(apiKey);
}

/**
 * Revoke an API key (soft delete)
 */
export async function revokeApiKey(
  id: string,
  userId: string
): Promise<boolean> {
  const apiKey = await prisma.apiKey.findFirst({
    where: { id, userId },
  });

  if (!apiKey) return false;

  // Soft delete by setting revokedAt
  await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return true;
}

/**
 * Validate an API key and return the associated user
 * Returns null if key is invalid, expired, or revoked
 */
export async function validateApiKey(key: string): Promise<{
  userId: string;
  email: string | null;
  walletAddress: string | null;
  tier: 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
} | null> {
  // Check format
  if (!isValidApiKeyFormat(key)) {
    return null;
  }

  // Hash the key to look it up
  const keyHash = hashApiKey(key);

  // Find the key in database
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });

  if (!apiKey) return null;

  // Check if revoked
  if (apiKey.revokedAt) return null;

  // Check if expired
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update usage stats (fire and forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  }).catch(err => {
    console.error('Failed to update API key usage:', err);
  });

  return {
    userId: apiKey.user.id,
    email: apiKey.user.email,
    walletAddress: apiKey.user.walletAddress,
    tier: apiKey.user.tier,
  };
}

/**
 * Format API key for response (masked)
 */
function formatApiKeyResponse(apiKey: {
  id: string;
  name: string | null;
  keyPrefix: string;
  lastUsedAt: Date | null;
  usageCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): ApiKeyResponse {
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    usageCount: apiKey.usageCount,
    expiresAt: apiKey.expiresAt?.toISOString() ?? null,
    revokedAt: apiKey.revokedAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
  };
}
