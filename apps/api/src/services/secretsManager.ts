import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt, type EncryptedData } from '../lib/crypto.js';

/**
 * Get decrypted secrets for an action
 * Returns a key-value map of secret names to their decrypted values
 */
export async function getDecryptedSecrets(actionId: string): Promise<Record<string, string>> {
  const secrets = await prisma.actionSecret.findMany({
    where: { actionId },
  });

  const decrypted: Record<string, string> = {};
  for (const secret of secrets) {
    try {
      decrypted[secret.name] = decrypt({
        encrypted: secret.encryptedValue,
        iv: secret.iv,
        authTag: '', // We store authTag with the encrypted value
      });
    } catch {
      // Skip secrets that fail to decrypt (corrupted or key changed)
      console.error(`Failed to decrypt secret ${secret.name} for action ${actionId}`);
    }
  }
  return decrypted;
}

/**
 * Set (create or update) a secret for an action
 */
export async function setSecret(
  actionId: string,
  name: string,
  value: string
): Promise<void> {
  // Validate secret name format (UPPER_SNAKE_CASE)
  if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) {
    throw new Error('Secret name must be UPPER_SNAKE_CASE (e.g., API_KEY, WEBHOOK_URL)');
  }

  // Encrypt the value
  const { encrypted, iv, authTag } = encrypt(value);

  // Store encrypted value with authTag appended (separated by :)
  const encryptedWithTag = `${encrypted}:${authTag}`;

  await prisma.actionSecret.upsert({
    where: {
      actionId_name: { actionId, name },
    },
    create: {
      actionId,
      name,
      encryptedValue: encryptedWithTag,
      iv,
    },
    update: {
      encryptedValue: encryptedWithTag,
      iv,
    },
  });
}

/**
 * Delete a secret from an action
 */
export async function deleteSecret(actionId: string, name: string): Promise<boolean> {
  const result = await prisma.actionSecret.deleteMany({
    where: { actionId, name },
  });
  return result.count > 0;
}

/**
 * List all secret names for an action (not values)
 */
export async function listSecretNames(actionId: string): Promise<string[]> {
  const secrets = await prisma.actionSecret.findMany({
    where: { actionId },
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  return secrets.map((s) => s.name);
}

/**
 * Check if a secret exists for an action
 */
export async function hasSecret(actionId: string, name: string): Promise<boolean> {
  const count = await prisma.actionSecret.count({
    where: { actionId, name },
  });
  return count > 0;
}

/**
 * Create multiple secrets at once (for action creation)
 */
export async function createSecrets(
  actionId: string,
  secrets: Array<{ name: string; value: string }>
): Promise<void> {
  if (secrets.length === 0) return;

  // Validate all secret names first
  for (const { name } of secrets) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) {
      throw new Error(`Invalid secret name: ${name}. Must be UPPER_SNAKE_CASE.`);
    }
  }

  // Encrypt and prepare all secrets
  const data = secrets.map(({ name, value }) => {
    const { encrypted, iv, authTag } = encrypt(value);
    return {
      actionId,
      name,
      encryptedValue: `${encrypted}:${authTag}`,
      iv,
    };
  });

  await prisma.actionSecret.createMany({
    data,
    skipDuplicates: true,
  });
}

/**
 * Delete all secrets for an action
 */
export async function deleteAllSecrets(actionId: string): Promise<number> {
  const result = await prisma.actionSecret.deleteMany({
    where: { actionId },
  });
  return result.count;
}

// Re-export decrypt function with proper handling of stored format
function decryptSecret(encryptedWithTag: string, iv: string): string {
  const [encrypted, authTag] = encryptedWithTag.split(':');
  return decrypt({ encrypted, iv, authTag });
}

/**
 * Get decrypted secrets for an action (improved version)
 */
export async function getActionSecrets(actionId: string): Promise<Record<string, string>> {
  const secrets = await prisma.actionSecret.findMany({
    where: { actionId },
  });

  const decrypted: Record<string, string> = {};
  for (const secret of secrets) {
    try {
      decrypted[secret.name] = decryptSecret(secret.encryptedValue, secret.iv);
    } catch (error) {
      console.error(`Failed to decrypt secret ${secret.name} for action ${actionId}:`, error);
    }
  }
  return decrypted;
}
