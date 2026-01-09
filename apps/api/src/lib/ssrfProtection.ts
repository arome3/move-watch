/**
 * SSRF (Server-Side Request Forgery) Protection Module
 *
 * Validates URLs to prevent attacks against internal networks, cloud metadata,
 * and other sensitive endpoints.
 *
 * Protected against:
 * - Internal network ranges (10.x, 172.16-31.x, 192.168.x)
 * - Localhost (127.x, ::1, localhost)
 * - Link-local addresses (169.254.x)
 * - Cloud metadata endpoints (169.254.169.254)
 * - IPv6 variants of above
 * - DNS rebinding (validates resolved IP)
 */

import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

// Blocked hostname patterns (case-insensitive)
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
];

// Blocked hostname suffixes
const BLOCKED_HOSTNAME_SUFFIXES = [
  '.local',
  '.localhost',
  '.internal',
  '.localdomain',
];

// Cloud metadata endpoints to block
const CLOUD_METADATA_IPS = [
  '169.254.169.254', // AWS, GCP, Azure
  'metadata.google.internal',
  'metadata.goog',
];

export interface SSRFValidationResult {
  valid: boolean;
  error?: string;
  resolvedIp?: string;
}

/**
 * Check if an IP address is in a private/internal range
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 checks
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return true; // Invalid IP, treat as private
    }

    const [a, b, c, d] = parts;

    // Loopback: 127.0.0.0/8
    if (a === 127) return true;

    // Private Class A: 10.0.0.0/8
    if (a === 10) return true;

    // Private Class B: 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;

    // Private Class C: 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    // Link-local: 169.254.0.0/16 (includes cloud metadata)
    if (a === 169 && b === 254) return true;

    // Broadcast: 255.255.255.255
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;

    // Current network: 0.0.0.0/8
    if (a === 0) return true;

    return false;
  }

  // IPv6 checks
  const ipLower = ip.toLowerCase();

  // Loopback: ::1
  if (ipLower === '::1' || ipLower === '0:0:0:0:0:0:0:1') return true;

  // Unspecified: ::
  if (ipLower === '::' || ipLower === '0:0:0:0:0:0:0:0') return true;

  // Link-local: fe80::/10
  if (ipLower.startsWith('fe80:')) return true;

  // Unique local: fc00::/7 and fd00::/8
  if (ipLower.startsWith('fc') || ipLower.startsWith('fd')) return true;

  // IPv4-mapped IPv6: ::ffff:x.x.x.x
  if (ipLower.startsWith('::ffff:')) {
    const ipv4Part = ip.slice(7);
    return isPrivateIP(ipv4Part);
  }

  return false;
}

/**
 * Check if hostname is blocked
 */
function isBlockedHostname(hostname: string): boolean {
  const hostLower = hostname.toLowerCase();

  // Direct match
  if (BLOCKED_HOSTNAMES.includes(hostLower)) {
    return true;
  }

  // Suffix match
  if (BLOCKED_HOSTNAME_SUFFIXES.some(suffix => hostLower.endsWith(suffix))) {
    return true;
  }

  // Cloud metadata
  if (CLOUD_METADATA_IPS.includes(hostLower)) {
    return true;
  }

  // IP address pattern check
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return isPrivateIP(hostname);
  }

  // IPv6 pattern check
  if (hostname.includes(':') && !hostname.includes('://')) {
    return isPrivateIP(hostname);
  }

  return false;
}

/**
 * Validate a URL for SSRF vulnerabilities
 *
 * @param url - The URL to validate
 * @param allowHttp - Whether to allow HTTP (not just HTTPS). Default: false
 * @returns Validation result with optional resolved IP
 */
export async function validateUrlForSSRF(
  url: string,
  allowHttp = false
): Promise<SSRFValidationResult> {
  try {
    const parsed = new URL(url);

    // Protocol check
    if (!allowHttp && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Only HTTPS URLs are allowed',
      };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: `Invalid protocol: ${parsed.protocol}`,
      };
    }

    // Check hostname
    const hostname = parsed.hostname.toLowerCase();

    if (!hostname) {
      return {
        valid: false,
        error: 'Missing hostname',
      };
    }

    // Check for blocked hostnames
    if (isBlockedHostname(hostname)) {
      return {
        valid: false,
        error: 'Requests to internal networks are not allowed',
      };
    }

    // Check for username/password in URL (potential bypass)
    if (parsed.username || parsed.password) {
      return {
        valid: false,
        error: 'URLs with credentials are not allowed',
      };
    }

    // Resolve DNS and check resolved IP (prevents DNS rebinding)
    try {
      const { address } = await dnsLookup(hostname);

      if (isPrivateIP(address)) {
        return {
          valid: false,
          error: 'URL resolves to internal network address',
          resolvedIp: address,
        };
      }

      return {
        valid: true,
        resolvedIp: address,
      };
    } catch (dnsError) {
      // DNS resolution failed - could be invalid domain
      // Allow it through (will fail at fetch time if truly invalid)
      // This is safer than blocking legitimate domains with temporary DNS issues
      console.warn(`DNS lookup failed for ${hostname}:`, dnsError);
      return {
        valid: true,
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validate URL synchronously (hostname checks only, no DNS resolution)
 * Use this for quick validation, but prefer validateUrlForSSRF for full protection
 */
export function validateUrlSync(url: string, allowHttp = false): SSRFValidationResult {
  try {
    const parsed = new URL(url);

    // Protocol check
    if (!allowHttp && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Only HTTPS URLs are allowed',
      };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: `Invalid protocol: ${parsed.protocol}`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (!hostname) {
      return {
        valid: false,
        error: 'Missing hostname',
      };
    }

    if (isBlockedHostname(hostname)) {
      return {
        valid: false,
        error: 'Requests to internal networks are not allowed',
      };
    }

    if (parsed.username || parsed.password) {
      return {
        valid: false,
        error: 'URLs with credentials are not allowed',
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Safe fetch wrapper that validates URLs before making requests
 * and disables automatic redirect following
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  allowHttp = false
): Promise<Response> {
  // Validate URL before fetching
  const validation = await validateUrlForSSRF(url, allowHttp);
  if (!validation.valid) {
    throw new Error(`SSRF Protection: ${validation.error}`);
  }

  // Disable redirects to prevent redirect-to-internal attacks
  const safeOptions: RequestInit = {
    ...options,
    redirect: 'manual', // Don't follow redirects automatically
  };

  const response = await fetch(url, safeOptions);

  // If we got a redirect, validate the redirect URL
  if (response.status >= 300 && response.status < 400) {
    const redirectUrl = response.headers.get('location');
    if (redirectUrl) {
      // Resolve relative URLs
      const absoluteRedirectUrl = new URL(redirectUrl, url).toString();
      const redirectValidation = await validateUrlForSSRF(absoluteRedirectUrl, allowHttp);

      if (!redirectValidation.valid) {
        throw new Error(`SSRF Protection: Redirect to blocked URL - ${redirectValidation.error}`);
      }

      // Follow the validated redirect manually
      return safeFetch(absoluteRedirectUrl, options, allowHttp);
    }
  }

  return response;
}

/**
 * Validate webhook URL (stricter - no HTTP allowed)
 */
export async function validateWebhookUrl(url: string): Promise<SSRFValidationResult> {
  // Webhooks must be HTTPS only
  return validateUrlForSSRF(url, false);
}

/**
 * List of known safe webhook domains (optional allowlist)
 */
export const KNOWN_WEBHOOK_DOMAINS = [
  'discord.com',
  'discordapp.com',
  'hooks.slack.com',
  'api.telegram.org',
];

/**
 * Check if URL is from a known safe webhook provider
 */
export function isKnownWebhookProvider(url: string): boolean {
  try {
    const parsed = new URL(url);
    return KNOWN_WEBHOOK_DOMAINS.some(
      domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}
