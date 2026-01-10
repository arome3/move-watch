/**
 * Simulation Session Service
 * Manages Aptos CLI Transaction Simulation Sessions for state overrides
 *
 * This enables "What-If" scenarios by creating isolated simulation environments
 * where we can modify account balances and resource states before running transactions.
 *
 * Uses the `aptos move sim` CLI commands:
 * - `sim init` - Initialize a session (fork from network or clean genesis)
 * - `sim fund` - Fund accounts with custom balances
 * - `sim run` - Execute transactions in the session
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';
import type { Network, StateOverride } from '@movewatch/shared';
import { NETWORK_CONFIGS } from '@movewatch/shared';

export interface SimulationSessionConfig {
  network: Network;
  forkFromNetwork?: boolean; // If true, fork current state; if false, start with clean genesis
  ledgerVersion?: string; // Specific ledger version to fork from (optional)
}

export interface SessionFundRequest {
  address: string;
  amount: string; // Amount in octas (1 APT = 100_000_000 octas)
}

export interface SimulationSession {
  id: string;
  path: string;
  network: Network;
  forked: boolean;
  ledgerVersion?: string;
  createdAt: Date;
  fundedAccounts: Map<string, string>; // address -> amount in octas
}

export interface SessionSimulationRequest {
  functionId: string;
  sender: string;
  typeArguments?: string[];
  arguments?: string[];
  maxGasAmount?: number;
  gasUnitPrice?: number;
  privateKey?: string; // Private key for signing transactions in session
}

export interface SessionSimulationResult {
  success: boolean;
  gasUsed: number;
  vmStatus: string;
  output?: string;
  error?: string;
  stateOverridesApplied: Array<{
    address: string;
    type: 'fund' | 'resource';
    status: 'applied' | 'failed';
    details?: string;
  }>;
}

// Active sessions cache
const activeSessions = new Map<string, SimulationSession>();

/**
 * Execute a command and return the result
 */
async function executeCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number } = {}
): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      shell: true,
      timeout: options.timeout || 60000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
        exitCode: code,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        stdout,
        stderr: stderr + '\n' + err.message,
        exitCode: null,
      });
    });
  });
}

/**
 * Check if the Aptos CLI supports simulation sessions
 */
export async function checkSimulationSessionSupport(): Promise<{
  supported: boolean;
  version?: string;
  error?: string;
}> {
  const result = await executeCommand('aptos', ['move', 'sim', '--help']);

  if (!result.success) {
    // Check if it's just not supported vs CLI not installed
    const versionResult = await executeCommand('aptos', ['--version']);
    if (!versionResult.success) {
      return {
        supported: false,
        error: 'Aptos CLI is not installed',
      };
    }

    const versionMatch = versionResult.stdout.match(/aptos (\d+\.\d+\.\d+)/);
    return {
      supported: false,
      version: versionMatch?.[1],
      error: 'Aptos CLI version does not support simulation sessions. Please upgrade to 4.5.0 or later.',
    };
  }

  // Check for required subcommands
  const hasInit = result.stdout.includes('init') || result.stderr.includes('init');
  const hasFund = result.stdout.includes('fund') || result.stderr.includes('fund');

  if (!hasInit || !hasFund) {
    return {
      supported: false,
      error: 'Aptos CLI simulation sessions feature is incomplete. Please upgrade to the latest version.',
    };
  }

  // Get version
  const versionResult = await executeCommand('aptos', ['--version']);
  const versionMatch = versionResult.stdout.match(/aptos (\d+\.\d+\.\d+)/);

  return {
    supported: true,
    version: versionMatch?.[1] || 'unknown',
  };
}

/**
 * Create a new simulation session
 */
export async function createSession(config: SimulationSessionConfig): Promise<SimulationSession> {
  // Generate unique session ID
  const sessionId = `sim-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const sessionPath = path.join(os.tmpdir(), 'movewatch-sessions', sessionId);

  // Create session directory
  await fs.mkdir(sessionPath, { recursive: true });

  const networkConfig = NETWORK_CONFIGS[config.network];

  // Build init command arguments
  const args = ['move', 'sim', 'init', '--path', sessionPath];

  if (config.forkFromNetwork) {
    // Fork from the network's current state
    // CLI 7.13.0 uses --network directly (mainnet, testnet, devnet)
    args.push('--network', config.network === 'mainnet' ? 'mainnet' : 'testnet');

    if (config.ledgerVersion) {
      args.push('--network-version', config.ledgerVersion);
    }
  }
  // If not forking, it creates a clean genesis state

  console.log('[SimSession] Creating session:', sessionId);
  console.log('[SimSession] Command: aptos', args.join(' '));

  const result = await executeCommand('aptos', args, { timeout: 120000 });

  if (!result.success) {
    // Clean up on failure
    try {
      await fs.rm(sessionPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    throw new Error(`Failed to create simulation session: ${result.stderr || result.stdout}`);
  }

  const session: SimulationSession = {
    id: sessionId,
    path: sessionPath,
    network: config.network,
    forked: config.forkFromNetwork ?? false,
    ledgerVersion: config.ledgerVersion,
    createdAt: new Date(),
    fundedAccounts: new Map(),
  };

  // Cache the session
  activeSessions.set(sessionId, session);

  console.log('[SimSession] Session created successfully:', sessionId);
  return session;
}

/**
 * Fund an account in the simulation session
 */
export async function fundAccount(
  session: SimulationSession,
  request: SessionFundRequest
): Promise<{ success: boolean; error?: string }> {
  const args = [
    'move', 'sim', 'fund',
    '--session', session.path,
    '--account', request.address,
    '--amount', request.amount,
  ];

  console.log('[SimSession] Funding account:', request.address, 'with', request.amount, 'octas');

  const result = await executeCommand('aptos', args, { timeout: 30000 });

  if (!result.success) {
    console.error('[SimSession] Fund failed:', result.stderr);
    return {
      success: false,
      error: result.stderr || 'Failed to fund account',
    };
  }

  // Track funded account
  session.fundedAccounts.set(request.address, request.amount);

  return { success: true };
}

/**
 * Apply state overrides to a session
 * This converts high-level StateOverride objects into session fund operations
 */
export async function applyStateOverrides(
  session: SimulationSession,
  overrides: StateOverride[]
): Promise<{
  applied: boolean;
  results: Array<{
    address: string;
    type: 'fund' | 'resource';
    status: 'applied' | 'failed' | 'unsupported';
    details?: string;
  }>;
}> {
  const results: Array<{
    address: string;
    type: 'fund' | 'resource';
    status: 'applied' | 'failed' | 'unsupported';
    details?: string;
  }> = [];

  let anyApplied = false;

  for (const override of overrides) {
    // Check if this is a coin balance override (which we can handle)
    if (isCoinBalanceOverride(override)) {
      const amount = extractCoinAmount(override);
      if (amount) {
        const fundResult = await fundAccount(session, {
          address: override.address,
          amount,
        });

        if (fundResult.success) {
          results.push({
            address: override.address,
            type: 'fund',
            status: 'applied',
            details: `Funded with ${amount} octas`,
          });
          anyApplied = true;
        } else {
          results.push({
            address: override.address,
            type: 'fund',
            status: 'failed',
            details: fundResult.error,
          });
        }
      } else {
        results.push({
          address: override.address,
          type: 'fund',
          status: 'failed',
          details: 'Could not extract amount from override data',
        });
      }
    } else {
      // Generic resource overrides are not yet supported by CLI
      results.push({
        address: override.address,
        type: 'resource',
        status: 'unsupported',
        details: `Resource type ${override.resource_type} cannot be directly overridden. Only coin balances are supported.`,
      });
    }
  }

  return {
    applied: anyApplied,
    results,
  };
}

/**
 * Format an argument for CLI (type:value format)
 * CLI expects: address:0x1, u64:1000, bool:true, etc.
 */
function formatCLIArgument(value: string): string {
  // Already formatted
  if (value.includes(':') && !value.startsWith('0x')) {
    return value;
  }

  // Infer type from value
  if (value.startsWith('0x')) {
    return `address:${value}`;
  }
  if (value === 'true' || value === 'false') {
    return `bool:${value}`;
  }
  if (/^\d+$/.test(value)) {
    return `u64:${value}`;
  }
  // Vector/array format
  if (value.startsWith('[') && value.endsWith(']')) {
    return value; // Pass through, CLI handles it
  }
  // String
  return `string:${value}`;
}

/**
 * Check if an override is a coin balance override
 */
function isCoinBalanceOverride(override: StateOverride): boolean {
  const resourceType = override.resource_type.toLowerCase();
  return (
    resourceType.includes('coinstore') ||
    resourceType.includes('coin::coinstore') ||
    resourceType.includes('aptos_coin') ||
    resourceType.includes('fungiblestore') ||
    resourceType.includes('balance')
  );
}

/**
 * Extract coin amount from override data
 */
function extractCoinAmount(override: StateOverride): string | null {
  const data = override.data;

  // Try common paths for coin balance
  if (typeof data === 'object' && data !== null) {
    // Path: { coin: { value: "amount" } }
    if ('coin' in data && typeof data.coin === 'object' && data.coin !== null) {
      const coin = data.coin as Record<string, unknown>;
      if ('value' in coin) {
        return String(coin.value);
      }
    }

    // Path: { balance: "amount" }
    if ('balance' in data) {
      return String(data.balance);
    }

    // Path: { value: "amount" }
    if ('value' in data) {
      return String(data.value);
    }

    // Path: { amount: "amount" }
    if ('amount' in data) {
      return String(data.amount);
    }
  }

  return null;
}

/**
 * Run a simulation in the session
 */
export async function runSessionSimulation(
  session: SimulationSession,
  request: SessionSimulationRequest
): Promise<SessionSimulationResult> {
  const args = [
    'move', 'run',
    '--session', session.path,
    '--function-id', request.functionId,
    '--sender-account', request.sender,
    '--assume-yes',
  ];

  // Add private key for signing (required for entry function simulation)
  if (request.privateKey) {
    args.push('--private-key', request.privateKey);
  }

  // Add type arguments
  if (request.typeArguments && request.typeArguments.length > 0) {
    for (const typeArg of request.typeArguments) {
      args.push('--type-args', typeArg);
    }
  }

  // Add function arguments (formatted for CLI: type:value)
  if (request.arguments && request.arguments.length > 0) {
    for (const arg of request.arguments) {
      args.push('--args', formatCLIArgument(arg));
    }
  }

  // Add gas settings
  if (request.maxGasAmount) {
    args.push('--max-gas', request.maxGasAmount.toString());
  }
  if (request.gasUnitPrice) {
    args.push('--gas-unit-price', request.gasUnitPrice.toString());
  }

  console.log('[SimSession] Running simulation in session:', session.id);
  console.log('[SimSession] Command: aptos', args.join(' '));

  const result = await executeCommand('aptos', args, { timeout: 120000 });

  // Parse the result
  const stateOverridesApplied = Array.from(session.fundedAccounts.entries()).map(
    ([address, amount]) => ({
      address,
      type: 'fund' as const,
      status: 'applied' as const,
      details: `Funded with ${amount} octas`,
    })
  );

  if (!result.success) {
    return {
      success: false,
      gasUsed: 0,
      vmStatus: 'SIMULATION_FAILED',
      error: result.stderr || 'Simulation failed',
      output: result.stdout,
      stateOverridesApplied,
    };
  }

  // Parse output for gas and status
  const gasMatch = result.stdout.match(/gas_used["\s:]+(\d+)/i);
  const vmStatusMatch = result.stdout.match(/vm_status["\s:]+["']?([^"'\n,}]+)/i);
  const successMatch = result.stdout.match(/success["\s:]+(\w+)/i);

  return {
    success: successMatch?.[1]?.toLowerCase() === 'true',
    gasUsed: gasMatch ? parseInt(gasMatch[1], 10) : 0,
    vmStatus: vmStatusMatch?.[1] || 'unknown',
    output: result.stdout,
    stateOverridesApplied,
  };
}

/**
 * Destroy a simulation session and clean up resources
 */
export async function destroySession(sessionId: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.warn('[SimSession] Session not found:', sessionId);
    return;
  }

  try {
    // Remove session directory
    await fs.rm(session.path, { recursive: true, force: true });
    console.log('[SimSession] Session destroyed:', sessionId);
  } catch (error) {
    console.error('[SimSession] Failed to destroy session:', sessionId, error);
  } finally {
    // Remove from cache
    activeSessions.delete(sessionId);
  }
}

/**
 * Clean up old sessions (e.g., sessions older than 1 hour)
 */
export async function cleanupOldSessions(maxAgeMs: number = 3600000): Promise<number> {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.createdAt.getTime() > maxAgeMs) {
      await destroySession(sessionId);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): SimulationSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * List all active sessions
 */
export function listSessions(): SimulationSession[] {
  return Array.from(activeSessions.values());
}

/**
 * High-level function to run a simulation with state overrides
 * This handles the full workflow: create session -> apply overrides -> run simulation -> cleanup
 */
export async function runSimulationWithOverrides(
  config: SimulationSessionConfig,
  overrides: StateOverride[],
  request: SessionSimulationRequest
): Promise<SessionSimulationResult & { sessionId?: string }> {
  let session: SimulationSession | undefined;

  try {
    // Create session
    session = await createSession(config);

    // Apply state overrides
    if (overrides.length > 0) {
      const overrideResults = await applyStateOverrides(session, overrides);
      console.log('[SimSession] Override results:', overrideResults);
    }

    // Get simulation account credentials from environment
    const simulationPrivateKey = process.env.SIMULATION_ACCOUNT_PRIVATE_KEY;
    const simulationAddress = process.env.SIMULATION_ACCOUNT_ADDRESS;

    // Run simulation with private key for signing
    const result = await runSessionSimulation(session, {
      ...request,
      // Use simulation account if no private key provided (CLI requires signing)
      sender: request.privateKey ? request.sender : (simulationAddress || request.sender),
      privateKey: request.privateKey || simulationPrivateKey,
    });

    return {
      ...result,
      sessionId: session.id,
    };
  } catch (error) {
    return {
      success: false,
      gasUsed: 0,
      vmStatus: 'SESSION_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      stateOverridesApplied: [],
      sessionId: session?.id,
    };
  } finally {
    // Always cleanup
    if (session) {
      await destroySession(session.id);
    }
  }
}
