/**
 * Payment Service
 *
 * Handles recording and querying payment records in the database.
 * Provides payment history and analytics for users.
 */

import { prisma } from '@movewatch/database';
import type { RecordPaymentRequest, Payment } from '@movewatch/shared';

/**
 * Record a confirmed payment in the database
 */
export async function recordPayment(data: RecordPaymentRequest): Promise<Payment> {
  const payment = await prisma.payment.create({
    data: {
      userId: data.userId || null,
      payerAddress: data.payerAddress,
      amount: data.amount,
      amountFormatted: data.amountFormatted,
      transactionHash: data.transactionHash,
      network: 'TESTNET', // Default to testnet
      status: 'CONFIRMED',
      endpoint: data.endpoint,
      requestId: data.requestId,
      priceOctas: data.priceOctas,
      priceUsd: data.priceUsd || null,
      verifiedAt: new Date(),
      confirmedAt: new Date(),
    },
  });

  return formatPayment(payment);
}

/**
 * Get payments by user ID
 */
export async function getPaymentsByUserId(
  userId: string,
  options: { page?: number; limit?: number } = {}
): Promise<{ payments: Payment[]; total: number }> {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 20, 100);
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where: { userId } }),
  ]);

  return {
    payments: payments.map(formatPayment),
    total,
  };
}

/**
 * Get payments by wallet address
 */
export async function getPaymentsByWalletAddress(
  walletAddress: string,
  options: { page?: number; limit?: number } = {}
): Promise<{ payments: Payment[]; total: number }> {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 20, 100);
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { payerAddress: walletAddress },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where: { payerAddress: walletAddress } }),
  ]);

  return {
    payments: payments.map(formatPayment),
    total,
  };
}

/**
 * Get payment by transaction hash
 */
export async function getPaymentByTxHash(txHash: string): Promise<Payment | null> {
  const payment = await prisma.payment.findUnique({
    where: { transactionHash: txHash },
  });

  return payment ? formatPayment(payment) : null;
}

/**
 * Get payment by request ID
 */
export async function getPaymentByRequestId(requestId: string): Promise<Payment | null> {
  const payment = await prisma.payment.findUnique({
    where: { requestId },
  });

  return payment ? formatPayment(payment) : null;
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(
  requestId: string,
  status: 'pending' | 'confirmed' | 'failed' | 'expired',
  errorMessage?: string
): Promise<Payment | null> {
  try {
    const payment = await prisma.payment.update({
      where: { requestId },
      data: {
        status: status.toUpperCase() as any,
        errorMessage,
        ...(status === 'confirmed' && { confirmedAt: new Date() }),
      },
    });

    return formatPayment(payment);
  } catch {
    return null;
  }
}

/**
 * Get payment statistics for a user
 */
export async function getPaymentStats(userId: string): Promise<{
  totalPayments: number;
  totalAmountOctas: string;
  totalAmountUsd: number;
  byEndpoint: Record<string, { count: number; amountOctas: string }>;
}> {
  const payments = await prisma.payment.findMany({
    where: { userId, status: 'CONFIRMED' },
    select: {
      amount: true,
      priceUsd: true,
      endpoint: true,
    },
  });

  let totalAmountOctas = BigInt(0);
  let totalAmountUsd = 0;
  const byEndpoint: Record<string, { count: number; amountOctas: bigint }> = {};

  for (const payment of payments) {
    totalAmountOctas += BigInt(payment.amount);
    totalAmountUsd += payment.priceUsd || 0;

    if (!byEndpoint[payment.endpoint]) {
      byEndpoint[payment.endpoint] = { count: 0, amountOctas: BigInt(0) };
    }
    byEndpoint[payment.endpoint].count++;
    byEndpoint[payment.endpoint].amountOctas += BigInt(payment.amount);
  }

  // Convert bigints to strings for the response
  const byEndpointFormatted: Record<string, { count: number; amountOctas: string }> = {};
  for (const [endpoint, stats] of Object.entries(byEndpoint)) {
    byEndpointFormatted[endpoint] = {
      count: stats.count,
      amountOctas: stats.amountOctas.toString(),
    };
  }

  return {
    totalPayments: payments.length,
    totalAmountOctas: totalAmountOctas.toString(),
    totalAmountUsd,
    byEndpoint: byEndpointFormatted,
  };
}

/**
 * Get recent payments (for admin/analytics)
 */
export async function getRecentPayments(
  limit: number = 50
): Promise<Payment[]> {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return payments.map(formatPayment);
}

/**
 * Format database payment record to API response
 */
function formatPayment(payment: any): Payment {
  return {
    id: payment.id,
    userId: payment.userId || undefined,
    payerAddress: payment.payerAddress,
    amount: payment.amount,
    amountFormatted: payment.amountFormatted,
    transactionHash: payment.transactionHash || undefined,
    network: payment.network.toLowerCase() as any,
    status: payment.status.toLowerCase() as any,
    endpoint: payment.endpoint,
    requestId: payment.requestId,
    priceOctas: payment.priceOctas,
    priceUsd: payment.priceUsd || undefined,
    verifiedAt: payment.verifiedAt?.toISOString(),
    confirmedAt: payment.confirmedAt?.toISOString(),
    errorMessage: payment.errorMessage || undefined,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}
