import {
  type UserProfile,
  type UpdateProfileRequest,
  type NotificationPreference,
  type UpdateNotificationPreferenceRequest,
} from '@movewatch/shared';
import { prisma } from '../lib/prisma.js';

/**
 * Get user profile by ID
 */
export async function getProfile(userId: string): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    walletAddress: user.walletAddress,
    name: user.name,
    image: user.image,
    tier: user.tier,
    emailVerified: user.emailVerified?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  data: UpdateProfileRequest
): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name !== undefined ? data.name : user.name,
      image: data.image !== undefined ? data.image : user.image,
    },
  });

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    walletAddress: updatedUser.walletAddress,
    name: updatedUser.name,
    image: updatedUser.image,
    tier: updatedUser.tier,
    emailVerified: updatedUser.emailVerified?.toISOString() ?? null,
    createdAt: updatedUser.createdAt.toISOString(),
  };
}

/**
 * Disconnect wallet from user account
 */
export async function disconnectWallet(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return false;

  // Only disconnect if user has another auth method (email)
  if (!user.email && user.walletAddress) {
    throw new Error('Cannot disconnect wallet - no email associated with account');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { walletAddress: null },
  });

  return true;
}

/**
 * Get notification preferences for a user
 * Creates default preferences if they don't exist
 */
export async function getPreferences(userId: string): Promise<NotificationPreference> {
  let prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  // Create default preferences if not exists
  if (!prefs) {
    prefs = await prisma.notificationPreference.create({
      data: {
        userId,
        emailEnabled: true,
        emailAddress: null,
      },
    });
  }

  return {
    id: prefs.id,
    emailEnabled: prefs.emailEnabled,
    emailAddress: prefs.emailAddress,
    createdAt: prefs.createdAt.toISOString(),
    updatedAt: prefs.updatedAt.toISOString(),
  };
}

/**
 * Update notification preferences
 */
export async function updatePreferences(
  userId: string,
  data: UpdateNotificationPreferenceRequest
): Promise<NotificationPreference> {
  // Ensure preferences exist
  await getPreferences(userId);

  const prefs = await prisma.notificationPreference.update({
    where: { userId },
    data: {
      emailEnabled: data.emailEnabled,
      emailAddress: data.emailAddress,
    },
  });

  return {
    id: prefs.id,
    emailEnabled: prefs.emailEnabled,
    emailAddress: prefs.emailAddress,
    createdAt: prefs.createdAt.toISOString(),
    updatedAt: prefs.updatedAt.toISOString(),
  };
}
