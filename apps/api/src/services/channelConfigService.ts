/**
 * Channel Config Service
 *
 * Handles encryption/decryption of sensitive channel configuration data.
 * Channel configs may contain:
 * - Webhook URLs (potentially with auth tokens in them)
 * - Bot tokens (Telegram)
 * - Auth headers and values
 *
 * SECURITY: All sensitive config data is encrypted at rest using AES-256-GCM.
 */

import { encrypt, decrypt, type EncryptedData } from '../lib/crypto.js';

// Fields that should be encrypted for each channel type
const SENSITIVE_FIELDS: Record<string, string[]> = {
  discord: ['webhookUrl'],
  slack: ['webhookUrl'],
  telegram: ['botToken'],
  webhook: ['url', 'authValue'],
  email: [], // Email addresses are not encrypted (needed for sending)
};

// Fields to mask in responses
const MASKED_FIELDS: Record<string, string[]> = {
  discord: ['webhookUrl'],
  slack: ['webhookUrl'],
  telegram: ['botToken'],
  webhook: ['url', 'authValue'],
  email: [],
};

export interface EncryptedChannelConfig {
  // Original non-sensitive fields remain as-is
  [key: string]: unknown;
  // Encrypted data stored separately
  __encrypted?: Record<string, EncryptedData>;
}

/**
 * Encrypt sensitive fields in a channel config
 */
export function encryptChannelConfig(
  channelType: string,
  config: Record<string, unknown>
): EncryptedChannelConfig {
  const type = channelType.toLowerCase();
  const sensitiveFields = SENSITIVE_FIELDS[type] || [];

  if (sensitiveFields.length === 0) {
    // No sensitive fields for this channel type
    return config;
  }

  const result: EncryptedChannelConfig = {};
  const encrypted: Record<string, EncryptedData> = {};

  for (const [key, value] of Object.entries(config)) {
    if (sensitiveFields.includes(key) && typeof value === 'string' && value.length > 0) {
      // Encrypt this field
      encrypted[key] = encrypt(value);
    } else {
      // Keep as-is
      result[key] = value;
    }
  }

  if (Object.keys(encrypted).length > 0) {
    result.__encrypted = encrypted;
  }

  return result;
}

/**
 * Decrypt sensitive fields in a channel config
 */
export function decryptChannelConfig(
  channelType: string,
  config: EncryptedChannelConfig
): Record<string, unknown> {
  const type = channelType.toLowerCase();
  const sensitiveFields = SENSITIVE_FIELDS[type] || [];

  if (!config.__encrypted || sensitiveFields.length === 0) {
    // No encrypted data
    const { __encrypted, ...rest } = config;
    return rest;
  }

  const result: Record<string, unknown> = {};

  // Copy non-encrypted fields
  for (const [key, value] of Object.entries(config)) {
    if (key !== '__encrypted') {
      result[key] = value;
    }
  }

  // Decrypt encrypted fields
  for (const [key, encryptedData] of Object.entries(config.__encrypted)) {
    try {
      result[key] = decrypt(encryptedData);
    } catch (error) {
      console.error(`Failed to decrypt channel config field '${key}':`, error);
      // Set to empty string on decryption failure
      result[key] = '';
    }
  }

  return result;
}

/**
 * Mask sensitive fields for API responses
 * Returns config with sensitive values masked (e.g., "****abcd")
 */
export function maskChannelConfig(
  channelType: string,
  config: Record<string, unknown>
): Record<string, unknown> {
  const type = channelType.toLowerCase();
  const maskedFields = MASKED_FIELDS[type] || [];

  if (maskedFields.length === 0) {
    return config;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (key === '__encrypted') {
      // Don't include encrypted data in response
      continue;
    }

    if (maskedFields.includes(key) && typeof value === 'string' && value.length > 0) {
      // Mask this field - show last 4 characters
      result[key] = maskString(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Mask a string, showing only the last 4 characters
 */
function maskString(value: string): string {
  if (value.length <= 4) {
    return '****';
  }
  return '****' + value.slice(-4);
}

/**
 * Check if config has encrypted fields (for migration detection)
 */
export function hasEncryptedFields(config: unknown): boolean {
  return (
    typeof config === 'object' &&
    config !== null &&
    '__encrypted' in config &&
    typeof (config as EncryptedChannelConfig).__encrypted === 'object'
  );
}

/**
 * Migrate unencrypted config to encrypted format
 * Use this for existing data that needs encryption
 */
export function migrateToEncryptedConfig(
  channelType: string,
  config: Record<string, unknown>
): EncryptedChannelConfig {
  // If already encrypted, return as-is
  if (hasEncryptedFields(config)) {
    return config as EncryptedChannelConfig;
  }

  // Encrypt sensitive fields
  return encryptChannelConfig(channelType, config);
}

/**
 * Get a display-safe version of the config for responses
 * Decrypts first (if encrypted), then masks sensitive values
 */
export function getDisplayConfig(
  channelType: string,
  storedConfig: unknown
): Record<string, unknown> {
  if (!storedConfig || typeof storedConfig !== 'object') {
    return {};
  }

  const config = storedConfig as EncryptedChannelConfig;

  // If encrypted, decrypt first
  let decrypted: Record<string, unknown>;
  if (hasEncryptedFields(config)) {
    decrypted = decryptChannelConfig(channelType, config);
  } else {
    // Legacy unencrypted config
    decrypted = config;
  }

  // Mask sensitive fields for display
  return maskChannelConfig(channelType, decrypted);
}

/**
 * Get the actual config values for sending notifications
 * Returns fully decrypted config
 */
export function getNotificationConfig(
  channelType: string,
  storedConfig: unknown
): Record<string, unknown> {
  if (!storedConfig || typeof storedConfig !== 'object') {
    return {};
  }

  const config = storedConfig as EncryptedChannelConfig;

  // If encrypted, decrypt
  if (hasEncryptedFields(config)) {
    return decryptChannelConfig(channelType, config);
  }

  // Legacy unencrypted config - return as-is but log warning
  console.warn(
    `[ChannelConfig] Found unencrypted config for ${channelType} channel. ` +
    `Consider running migration to encrypt existing configs.`
  );
  return config;
}
