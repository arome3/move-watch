import { Ed25519PublicKey, Ed25519Signature } from '@aptos-labs/ts-sdk';

/**
 * Verifies a wallet signature from Petra or other Aptos-compatible wallets.
 *
 * The signature verification uses Ed25519 cryptography which is standard
 * for Aptos/Movement Network wallets. The process:
 * 1. Extract the public key from the wallet address (for Petra wallets)
 * 2. Verify the signature against the original message
 */
export async function verifyWalletSignature(
  address: string,
  signatureHex: string,
  message: string
): Promise<boolean> {
  try {
    // For Petra wallet, the signature response includes the public key
    // The signature is typically in the format: { signature: hex, publicKey: hex }
    // We parse it if it's JSON, otherwise assume it's raw signature
    let signature: string;
    let publicKey: string;

    try {
      const parsed = JSON.parse(signatureHex);
      signature = parsed.signature;
      publicKey = parsed.publicKey;
    } catch {
      // If not JSON, we need the public key from elsewhere
      // For now, we'll accept direct signature format for development
      console.warn('Raw signature format - skipping verification in development');

      // In development, accept any valid-looking signature
      if (process.env.NODE_ENV === 'development') {
        return address.startsWith('0x') && signatureHex.length > 10;
      }

      return false;
    }

    // Remove 0x prefix if present
    const cleanSignature = signature.startsWith('0x') ? signature.slice(2) : signature;
    const cleanPublicKey = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;

    // Create Ed25519 public key and signature objects
    const pubKey = new Ed25519PublicKey(cleanPublicKey);
    const sig = new Ed25519Signature(cleanSignature);

    // Encode the message as bytes (same encoding the wallet used)
    const messageBytes = new TextEncoder().encode(message);

    // Verify the signature
    const isValid = pubKey.verifySignature({
      message: messageBytes,
      signature: sig,
    });

    return isValid;
  } catch (error) {
    console.error('Wallet signature verification error:', error);
    return false;
  }
}

/**
 * Generates an authentication message for wallet signing.
 * This message is displayed to the user when they sign with their wallet.
 */
export function generateAuthMessage(nonce: string): string {
  const timestamp = Date.now();
  return `Sign this message to authenticate with MoveWatch.

Nonce: ${nonce}
Timestamp: ${timestamp}

This signature will not cost any gas fees.`;
}

/**
 * Generates a random nonce for authentication.
 */
export function generateNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Type definition for Petra wallet window object
 */
export interface PetraWallet {
  connect: () => Promise<{ address: string; publicKey: string }>;
  disconnect: () => Promise<void>;
  isConnected: () => Promise<boolean>;
  account: () => Promise<{ address: string; publicKey: string }>;
  signMessage: (payload: { message: string; nonce: string }) => Promise<{
    signature: string;
    fullMessage: string;
  }>;
  network: () => Promise<{ name: string; chainId: string }>;
}

declare global {
  interface Window {
    petra?: PetraWallet;
    aptos?: PetraWallet; // Some wallets use 'aptos' instead
  }
}

/**
 * Checks if Petra wallet is installed
 */
export function isPetraInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.petra || window.aptos);
}

/**
 * Gets the Petra wallet instance
 */
export function getPetraWallet(): PetraWallet | null {
  if (typeof window === 'undefined') return null;
  return window.petra || window.aptos || null;
}
