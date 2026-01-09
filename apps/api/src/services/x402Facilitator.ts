/**
 * x402 Facilitator Service
 *
 * Handles payment verification for the x402 protocol on Movement Network.
 * Verifies that submitted transactions are valid transfers to MoveWatch treasury.
 *
 * Flow:
 * 1. Client submits transaction via Petra wallet (transaction is on-chain)
 * 2. Client sends transaction hash in X-Payment header
 * 3. Server verifies transaction on-chain matches expected parameters
 * 4. Server uses nonce/tx hash tracking to prevent replay attacks
 *
 * Security considerations:
 * - Verifies recipient address matches MoveWatch treasury
 * - Validates payment amount meets minimum price
 * - Checks timestamp to prevent stale payments
 * - Uses transaction hash tracking to prevent replay attacks
 */

import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { redis } from '../lib/redis.js';
import type {
  PaymentVerificationResult,
  PaymentSettlementResult,
} from '@movewatch/shared';
import { getPaymentAddress } from '../config/pricing.js';

// Movement Testnet configuration
const MOVEMENT_TESTNET_RPC =
  process.env.MOVEMENT_TESTNET_RPC ||
  'https://aptos.testnet.bardock.movementlabs.xyz/v1';

// Create Aptos client for Movement Network
const aptosConfig = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: MOVEMENT_TESTNET_RPC,
});

const client = new Aptos(aptosConfig);

// Transaction hash TTL for replay protection (1 hour)
const TX_HASH_TTL_SECONDS = 3600;

// Payment validity window (5 minutes)
const PAYMENT_VALIDITY_MS = 5 * 60 * 1000;

// Transaction confirmation timeout (wait for on-chain confirmation)
const CONFIRMATION_TIMEOUT_SECONDS = 30;

/**
 * Payment payload from X-Payment header (new format with tx hash)
 */
interface X402PaymentPayload {
  transactionHash: string;
  senderAddress: string;
  amount: string;
  recipient: string;
  nonce: string;
  timestamp: number;
}

/**
 * Verify a payment payload from the X-Payment header
 *
 * Checks:
 * 1. Payload decodes correctly
 * 2. Transaction hash hasn't been used before (replay protection)
 * 3. Timestamp is within validity window
 * 4. Transaction exists on-chain and is successful
 * 5. Transaction is a transfer to MoveWatch treasury
 * 6. Transfer amount meets or exceeds expected price
 */
export async function verifyPayment(
  paymentHeader: string,
  expectedAmount: string,
  requestId: string
): Promise<PaymentVerificationResult> {
  try {
    // 1. Decode the payment payload
    let payload: X402PaymentPayload;
    try {
      const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
      payload = JSON.parse(decoded);
    } catch {
      return { valid: false, error: 'Invalid payment payload encoding' };
    }

    // 2. Verify required fields
    if (!payload.transactionHash || !payload.senderAddress || !payload.amount) {
      return { valid: false, error: 'Missing required payment fields' };
    }

    console.log(`[x402] Verifying transaction: ${payload.transactionHash}`);

    // 3. Verify timestamp is recent (within validity window)
    const now = Date.now();
    const timeDiff = Math.abs(now - payload.timestamp);
    if (timeDiff > PAYMENT_VALIDITY_MS) {
      return {
        valid: false,
        error: 'Payment request expired. Please generate a new payment.',
      };
    }

    // 4. Check transaction hash hasn't been used (prevent replay attacks)
    const txHashKey = `x402:txhash:${payload.transactionHash}`;
    const txHashExists = await redis.exists(txHashKey);
    if (txHashExists) {
      return {
        valid: false,
        error: 'Transaction already used for payment. Please make a new payment.',
      };
    }

    // 5. Verify transaction on-chain
    const onChainVerification = await verifyTransactionOnChain(
      payload.transactionHash,
      getPaymentAddress(),
      expectedAmount
    );

    if (!onChainVerification.valid) {
      return {
        valid: false,
        error: onChainVerification.error || 'Transaction verification failed on-chain',
      };
    }

    // 6. Mark transaction hash as used (with TTL for eventual cleanup)
    await redis.setex(txHashKey, TX_HASH_TTL_SECONDS, '1');

    console.log(`[x402] Payment verified successfully: ${payload.transactionHash}`);

    // All checks passed
    return {
      valid: true,
      payerAddress: payload.senderAddress,
    };
  } catch (error) {
    console.error('Payment verification error:', error);
    return {
      valid: false,
      error: 'Payment verification failed due to internal error',
    };
  }
}

/**
 * Confirm a payment transaction on Movement Network
 *
 * Since the client already submitted the transaction, we just need to:
 * 1. Wait for on-chain confirmation (if not already confirmed)
 * 2. Return the transaction hash for recording
 */
export async function settlePayment(
  paymentHeader: string,
  requestId: string
): Promise<PaymentSettlementResult> {
  try {
    // Decode the payment payload
    const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
    const payload: X402PaymentPayload = JSON.parse(decoded);

    const txHash = payload.transactionHash;
    console.log(`[x402] Confirming transaction: ${txHash}`);

    // Wait for on-chain confirmation (the transaction should already be submitted)
    try {
      const confirmed = await client.waitForTransaction({
        transactionHash: txHash,
        options: {
          timeoutSecs: CONFIRMATION_TIMEOUT_SECONDS,
          checkSuccess: true,
        },
      });

      if (!confirmed.success) {
        console.error(`[x402] Transaction failed on-chain: ${txHash}`);
        return {
          success: false,
          error: 'Transaction failed on-chain. Please try again.',
          transactionHash: txHash,
        };
      }
    } catch (waitError: any) {
      // Transaction might already be confirmed, try to get it directly
      console.log(`[x402] waitForTransaction failed, checking directly: ${waitError.message}`);
      const tx = await getTransactionDetails(txHash);
      if (!tx || !(tx as any).success) {
        return {
          success: false,
          error: 'Transaction not found or failed on-chain.',
          transactionHash: txHash,
        };
      }
    }

    console.log(`[x402] Payment confirmed: ${txHash}`);

    return {
      success: true,
      transactionHash: txHash,
    };
  } catch (error: any) {
    console.error('[x402] Payment confirmation error:', error);

    // Handle specific error types
    if (error.message?.includes('timeout')) {
      return {
        success: false,
        error: 'Transaction confirmation timed out. Please check your wallet.',
      };
    }

    return {
      success: false,
      error: 'Payment confirmation failed. Please try again.',
    };
  }
}

/**
 * Check if a nonce has been used
 */
export async function isNonceUsed(nonce: string): Promise<boolean> {
  const nonceKey = `x402:nonce:${nonce}`;
  const exists = await redis.exists(nonceKey);
  return exists === 1;
}

/**
 * Get transaction details from Movement Network
 */
export async function getTransactionDetails(txHash: string) {
  try {
    const tx = await client.getTransactionByHash({ transactionHash: txHash });
    return tx;
  } catch (error) {
    console.error(`Failed to get transaction ${txHash}:`, error);
    return null;
  }
}

/**
 * Result of on-chain transaction verification
 */
interface OnChainVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify a transaction on-chain matches expected parameters
 *
 * Checks:
 * 1. Transaction exists and was successful
 * 2. Transaction is a transfer (0x1::aptos_account::transfer or 0x1::coin::transfer)
 * 3. Recipient matches MoveWatch treasury address
 * 4. Amount meets or exceeds expected price
 */
export async function verifyTransactionOnChain(
  txHash: string,
  expectedRecipient: string,
  expectedAmount: string
): Promise<OnChainVerificationResult> {
  try {
    // Fetch transaction details from chain
    const tx = await getTransactionDetails(txHash);
    if (!tx) {
      return { valid: false, error: 'Transaction not found on-chain' };
    }

    const txData = tx as any;

    // Check transaction was successful
    if (!txData.success) {
      return { valid: false, error: `Transaction failed on-chain: ${txData.vm_status}` };
    }

    // Check this is a user transaction with a payload
    if (txData.type !== 'user_transaction' || !txData.payload) {
      return { valid: false, error: 'Invalid transaction type' };
    }

    const payload = txData.payload;

    // Verify it's a transfer function call
    const validFunctions = [
      '0x1::aptos_account::transfer',
      '0x1::aptos_account::transfer_coins',
      '0x1::coin::transfer',
    ];

    if (!validFunctions.includes(payload.function)) {
      return {
        valid: false,
        error: `Invalid transaction function: ${payload.function}. Expected a transfer.`,
      };
    }

    // Extract recipient and amount from transaction arguments
    // For aptos_account::transfer, arguments are [recipient, amount]
    const args = payload.arguments;
    if (!args || args.length < 2) {
      return { valid: false, error: 'Invalid transfer arguments' };
    }

    const txRecipient = String(args[0]).toLowerCase();
    const txAmount = BigInt(args[1]);

    // Verify recipient matches expected (MoveWatch treasury)
    const normalizedExpected = expectedRecipient.toLowerCase();
    if (txRecipient !== normalizedExpected) {
      return {
        valid: false,
        error: `Payment sent to wrong address. Expected: ${expectedRecipient}`,
      };
    }

    // Verify amount meets minimum
    const requiredAmount = BigInt(expectedAmount);
    if (txAmount < requiredAmount) {
      return {
        valid: false,
        error: `Insufficient payment. Required: ${expectedAmount} octas, received: ${txAmount.toString()} octas`,
      };
    }

    console.log(`[x402] On-chain verification passed for ${txHash}`);
    console.log(`[x402]   Recipient: ${txRecipient}`);
    console.log(`[x402]   Amount: ${txAmount.toString()} octas`);

    return { valid: true };
  } catch (error: any) {
    console.error(`Transaction verification failed for ${txHash}:`, error);
    return {
      valid: false,
      error: `On-chain verification error: ${error.message}`,
    };
  }
}
