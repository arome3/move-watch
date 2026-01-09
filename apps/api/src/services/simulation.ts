import { Account, Ed25519PrivateKey, Ed25519PublicKey, Aptos } from '@aptos-labs/ts-sdk';
import { nanoid } from 'nanoid';
import type { Prisma } from '@movewatch/database';
import {
  type SimulationRequest,
  type SimulationResponse,
  type StateChange,
  type SimulationEvent,
  type SimulationError,
  type GasBreakdown,
  type ExecutionTrace,
  type SimulationWarning,
  ERROR_MAPPINGS,
  SIMULATION_TTL_DAYS,
  REDIS_CACHE_TTL_SECONDS,
} from '@movewatch/shared';
import { enhanceWithDiffs } from '../lib/diffBuilder.js';
import { prisma } from '../lib/prisma.js';
import { cacheSet, cacheGet } from '../lib/redis.js';
import {
  getMovementClient,
  parseFunctionPath,
  generateDummyAddress,
  generateDummyPublicKey,
} from '../lib/movement.js';
import {
  decodeError,
  generateErrorSuggestion,
  buildBasicStackTrace,
  extractFailurePoint,
} from '../lib/errorDecoder.js';
import {
  buildExecutionTrace,
  buildEnhancedGasBreakdown,
  buildCompleteGasBreakdown,
  buildCompleteGasBreakdownAsync,
  generateWarnings,
  generateRecommendations,
  enhanceStateChanges,
} from '../lib/traceBuilder.js';
import {
  buildForkMetadata,
  isVersionAvailable,
  validateStateOverrides,
  applyStateOverrides,
} from '../lib/forkSimulation.js';
import {
  runCLISimulation,
  convertCLITraceToExecutionSteps,
  type CLISimulationRequest,
} from '../lib/cliExecutor.js';
import { explainTransaction } from '../lib/transactionExplainer.js';

/**
 * Simulate a transaction using Aptos CLI for detailed gas profiling
 * This provides REAL execution traces from the Move VM
 */
export async function simulateWithCLI(
  request: {
    network: 'mainnet' | 'testnet' | 'devnet';
    sender?: string;
    payload: {
      function: string;
      type_arguments?: string[];
      arguments?: unknown[];
    };
    options?: {
      max_gas_amount?: number;
      gas_unit_price?: number;
    };
  },
  userId?: string
): Promise<SimulationResponse> {
  const shareId = nanoid(10);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SIMULATION_TTL_DAYS);

  // Get simulation account private key from env
  const simulationPrivateKey = process.env.SIMULATION_ACCOUNT_PRIVATE_KEY;

  // Build CLI request
  const cliRequest: CLISimulationRequest = {
    network: request.network,
    sender: request.sender || process.env.SIMULATION_ACCOUNT_ADDRESS || '0x1',
    privateKey: simulationPrivateKey, // Pass private key for CLI signing
    functionId: request.payload.function,
    typeArguments: request.payload.type_arguments,
    arguments: request.payload.arguments?.map((arg) => {
      // Convert argument to CLI format (type:value)
      if (typeof arg === 'string') {
        // Check if it's an address (hex string)
        if (arg.startsWith('0x')) {
          return `address:${arg}`;
        }
        // Check if it's a numeric string
        if (/^\d+$/.test(arg)) {
          return `u64:${arg}`;
        }
        return `string:${arg}`;
      }
      if (typeof arg === 'number') {
        return `u64:${arg}`;
      }
      if (typeof arg === 'boolean') {
        return `bool:${arg}`;
      }
      // For complex types, serialize as JSON
      return JSON.stringify(arg);
    }),
    maxGasAmount: request.options?.max_gas_amount || 10000,
    gasUnitPrice: request.options?.gas_unit_price || 100,
  };

  try {
    console.log('[CLI Simulation] Running with --profile-gas...');
    const cliResult = await runCLISimulation(cliRequest);

    // Convert CLI trace to our ExecutionTrace format
    let executionTrace: ExecutionTrace | undefined;
    if (cliResult.executionTrace) {
      const steps = convertCLITraceToExecutionSteps(cliResult.executionTrace);
      executionTrace = {
        entryFunction: request.payload.function,
        totalGas: cliResult.executionTrace.totalGas,
        steps: steps as ExecutionTrace['steps'],
        callGraph: undefined, // Could build from trace if needed
        // Mark as real CLI trace data (not approximated)
        traceSource: {
          type: 'cli_profile',
          isApproximated: false,
          message: 'Real execution trace from Aptos CLI --profile-gas',
        },
      };
    }

    // Build gas breakdown from CLI results
    const gasBreakdown: GasBreakdown = cliResult.gasBreakdown
      ? {
          total: cliResult.gasBreakdown.total,
          computation: cliResult.gasBreakdown.execution + cliResult.gasBreakdown.intrinsic,
          storage: cliResult.gasBreakdown.storage,
          byCategory: {
            execution: cliResult.gasBreakdown.execution,
            io: cliResult.gasBreakdown.io,
            storage: cliResult.gasBreakdown.storage,
            intrinsic: cliResult.gasBreakdown.intrinsic,
            dependencies: 0, // CLI doesn't break down dependencies separately
          },
        }
      : {
          total: cliResult.gasUsed,
          computation: Math.floor(cliResult.gasUsed * 0.65),
          storage: Math.floor(cliResult.gasUsed * 0.35),
        };

    // Generate warnings based on CLI results
    const warnings: SimulationWarning[] = [];
    if (cliResult.executionTrace?.storageFee && cliResult.executionTrace.storageFee > 0.1) {
      warnings.push({
        code: 'HIGH_STORAGE_FEE',
        severity: 'warning',
        message: `Storage fee is ${cliResult.executionTrace.storageFee.toFixed(4)} APT`,
      });
    }

    // Store in database
    const simulation = await prisma.simulation.create({
      data: {
        shareId,
        userId,
        network: request.network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
        sender: request.sender,
        functionName: request.payload.function,
        typeArguments: request.payload.type_arguments || [],
        arguments: request.payload.arguments as Prisma.InputJsonValue,
        maxGasAmount: request.options?.max_gas_amount ?? 100000,
        gasUnitPrice: request.options?.gas_unit_price ?? 100,
        success: cliResult.success,
        gasUsed: cliResult.gasUsed,
        gasBreakdown: gasBreakdown as unknown as Prisma.InputJsonValue,
        rawResponse: {
          cli_output: cliResult.rawOutput,
          vm_status: cliResult.vmStatus,
        } as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    await cacheSimulation(shareId, simulation);

    if (cliResult.success) {
      return {
        id: simulation.id,
        shareId,
        success: true,
        gasUsed: cliResult.gasUsed,
        gasBreakdown,
        executionTrace,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: [
          'CLI-based simulation provides real VM execution traces.',
          'Gas costs shown are actual per-instruction costs from the Move VM.',
        ],
        // Include flamegraph HTML if available (frontend can render it in iframe)
        flamegraphHtml: cliResult.flamegraphData,
        shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sim/${shareId}`,
      } as SimulationResponse & { flamegraphHtml?: string };
    } else {
      return {
        id: simulation.id,
        shareId,
        success: false,
        error: {
          code: 'CLI_SIMULATION_FAILED',
          message: cliResult.error || 'CLI simulation failed',
          vmStatus: cliResult.vmStatus,
        },
        shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sim/${shareId}`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[CLI Simulation] Error:', errorMessage);

    // Store failed simulation
    const simulation = await prisma.simulation.create({
      data: {
        shareId,
        userId,
        network: request.network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
        sender: request.sender,
        functionName: request.payload.function,
        typeArguments: request.payload.type_arguments || [],
        arguments: request.payload.arguments as Prisma.InputJsonValue,
        maxGasAmount: request.options?.max_gas_amount ?? 100000,
        gasUnitPrice: request.options?.gas_unit_price ?? 100,
        success: false,
        error: {
          code: 'CLI_ERROR',
          message: errorMessage,
        } as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    await cacheSimulation(shareId, simulation);

    return {
      id: simulation.id,
      shareId,
      success: false,
      error: {
        code: 'CLI_ERROR',
        message: `CLI simulation failed: ${errorMessage}`,
        vmStatus: errorMessage,
        suggestion: 'Try running without detailed_trace option to use the REST API simulation.',
      },
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sim/${shareId}`,
    };
  }
}

/**
 * Simulate a transaction against Movement Network
 */
export async function simulateTransaction(
  request: SimulationRequest,
  userId?: string
): Promise<SimulationResponse> {
  const client = getMovementClient(request.network);

  // Parse function path
  const [moduleAddress, moduleName, functionName] = parseFunctionPath(
    request.payload.function
  );

  // Generate share ID
  const shareId = nanoid(10);

  // Calculate expiration (30 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SIMULATION_TTL_DAYS);

  // Handle fork simulation options
  const ledgerVersion = request.options?.ledger_version;
  const stateOverrides = request.options?.state_overrides;

  // Validate ledger version if specified
  if (ledgerVersion) {
    const versionCheck = await isVersionAvailable(request.network, ledgerVersion);
    if (!versionCheck.available) {
      throw new Error(
        `Ledger version ${ledgerVersion} is not available. ` +
        `Available range: ${versionCheck.oldestVersion} to ${versionCheck.currentVersion}`
      );
    }
    console.log(`[Simulation] Using historical state at ledger version: ${ledgerVersion}`);
  }

  // Validate and document state overrides if specified
  let overrideResult: { applied: boolean; message: string; details: Array<{ address: string; resource: string; status: string }> } | undefined;
  if (stateOverrides && stateOverrides.length > 0) {
    const validation = validateStateOverrides(stateOverrides);
    if (!validation.valid) {
      throw new Error(`Invalid state overrides: ${validation.errors.join('; ')}`);
    }
    overrideResult = applyStateOverrides(stateOverrides);
    console.log(`[Simulation] State overrides: ${overrideResult.message}`);
  }

  try {
    // For simulation on Movement Network, we need a valid auth key relationship
    // AND the account must exist on-chain.
    //
    // NOTE: Movement Network REQUIRES:
    // 1. Auth key validation - public key must derive to sender address
    // 2. Account existence - sender must exist on-chain (even for simulation)
    //
    // There are two modes:
    // A) User provides sender + senderPublicKey: Use their address and public key
    //    (the account must exist and the public key must match the auth key)
    // B) Default: Use our funded simulation account
    let senderAddress: string;
    let signerPublicKey: Ed25519PublicKey;

    // Helper to normalize addresses to 64 characters (SDK requirement)
    const normalizeAddress = (addr: string): string => {
      return addr.startsWith('0x')
        ? '0x' + addr.slice(2).padStart(64, '0')
        : '0x' + addr.padStart(64, '0');
    };

    if (request.sender && request.senderPublicKey) {
      // User provided both sender and public key - use their account
      senderAddress = normalizeAddress(request.sender);
      signerPublicKey = new Ed25519PublicKey(request.senderPublicKey);
      console.log('[Simulation] Using user-provided sender:', senderAddress);
      console.log('[Simulation] Using user-provided public key:', request.senderPublicKey.slice(0, 20) + '...');
    } else if (request.sender) {
      // User provided sender but no public key - try to look it up from chain
      console.log('[Simulation] Attempting to lookup public key for sender:', request.sender);
      const lookedUpKey = await lookupPublicKeyFromChain(client, request.sender);

      if (lookedUpKey) {
        // Found public key from transaction history
        senderAddress = normalizeAddress(request.sender);
        signerPublicKey = lookedUpKey;
        console.log('[Simulation] Successfully using sender with looked-up public key');
      } else if (process.env.SIMULATION_ACCOUNT_PRIVATE_KEY) {
        // Couldn't find public key, fall back to simulation account
        const privateKey = new Ed25519PrivateKey(process.env.SIMULATION_ACCOUNT_PRIVATE_KEY);
        const simulationAccount = Account.fromPrivateKey({ privateKey });
        senderAddress = simulationAccount.accountAddress.toString();
        signerPublicKey = simulationAccount.publicKey;
        console.log('[Simulation] Could not lookup public key for', request.sender, '- using simulation account instead');
      } else {
        // No simulation account configured, use user's address anyway (may fail)
        senderAddress = request.sender;
        const simulationAccount = Account.generate();
        signerPublicKey = simulationAccount.publicKey;
        console.log('[Simulation] WARNING: Could not lookup public key and no simulation account configured. Using generated key (likely to fail)');
      }
    } else if (process.env.SIMULATION_ACCOUNT_PRIVATE_KEY) {
      // No sender provided - use our funded simulation account
      const privateKey = new Ed25519PrivateKey(process.env.SIMULATION_ACCOUNT_PRIVATE_KEY);
      const simulationAccount = Account.fromPrivateKey({ privateKey });
      senderAddress = simulationAccount.accountAddress.toString();
      signerPublicKey = simulationAccount.publicKey;
      console.log('[Simulation] Using funded simulation account:', senderAddress);
    } else {
      // Fallback: generate a new account (will likely fail due to account not existing)
      const simulationAccount = Account.generate();
      senderAddress = simulationAccount.accountAddress.toString();
      signerPublicKey = simulationAccount.publicKey;
      console.log('[Simulation] WARNING: No funded simulation account configured. Using generated account (may fail):', senderAddress);
    }

    // Build the transaction
    const transaction = await client.transaction.build.simple({
      sender: senderAddress,
      data: {
        function: `${moduleAddress}::${moduleName}::${functionName}` as `${string}::${string}::${string}`,
        typeArguments: request.payload.type_arguments,
        functionArguments: request.payload.arguments as any[],
      },
      options: {
        maxGasAmount: request.options?.max_gas_amount ?? 100000,
        gasUnitPrice: request.options?.gas_unit_price ?? 100,
      },
    });

    // Simulate with the public key so auth key validation passes
    // Movement Network requires this unlike standard Aptos
    const [simulationResult] = await client.transaction.simulate.simple({
      transaction,
      signerPublicKey,
      options: {
        estimateGasUnitPrice: true,
        estimateMaxGasAmount: true,
      },
    });

    // Extract basic results
    const rawStateChanges = extractStateChanges(simulationResult);
    const events = extractEvents(simulationResult);
    const gasUsed = parseInt(simulationResult.gas_used) || 0;
    const maxGasAmount = request.options?.max_gas_amount ?? 100000;

    // Fetch before state for all changed resources
    const beforeState = await fetchBeforeState(client, rawStateChanges);

    // Merge before state into changes
    const stateChangesWithBefore = mergeBeforeState(rawStateChanges, beforeState);

    // Compute human-readable diffs
    const stateChanges = enhanceWithDiffs(stateChangesWithBefore);

    // Build enhanced results with full gas optimization data
    // Uses real network benchmarks for accurate efficiency scoring
    const gasUnitPrice = request.options?.gas_unit_price ?? 100;
    const gasBreakdown = await buildCompleteGasBreakdownAsync(
      request.network,
      events,
      stateChanges,
      gasUsed,
      request.payload.function,
      gasUnitPrice
    );
    const executionTrace = buildExecutionTrace(
      request.payload.function,
      events,
      stateChanges,
      gasUsed,
      simulationResult.success
    );
    const warnings = generateWarnings(events, stateChanges, gasUsed, maxGasAmount);
    const recommendations = generateRecommendations(
      simulationResult.success,
      gasUsed,
      maxGasAmount,
      events,
      stateChanges
    );

    // Use stateChanges which now includes before state and diffs
    const enhancedStateChanges = stateChanges;

    // Store in database
    const simulation = await prisma.simulation.create({
      data: {
        shareId,
        userId,
        network: request.network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
        sender: request.sender,
        functionName: request.payload.function,
        typeArguments: request.payload.type_arguments,
        arguments: request.payload.arguments as Prisma.InputJsonValue,
        maxGasAmount,
        gasUnitPrice: request.options?.gas_unit_price ?? 100,
        success: simulationResult.success,
        gasUsed,
        gasBreakdown: gasBreakdown as unknown as Prisma.InputJsonValue,
        stateChanges: enhancedStateChanges as unknown as Prisma.InputJsonValue,
        events: events as unknown as Prisma.InputJsonValue,
        rawResponse: simulationResult as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    // Cache for sharing
    await cacheSimulation(shareId, simulation);

    // Build fork metadata if using fork options
    const forkMetadata = (ledgerVersion || stateOverrides)
      ? await buildForkMetadata(request.network, ledgerVersion, stateOverrides)
      : undefined;

    // Add warning if state overrides were requested but not applied
    if (overrideResult && !overrideResult.applied) {
      warnings.push({
        code: 'STATE_OVERRIDES_NOT_APPLIED',
        severity: 'info',
        message: overrideResult.message,
        details: JSON.stringify(overrideResult.details),
      });
    }

    // Handle failed simulation (VM abort, etc.) - populate error info
    let errorInfo: SimulationError | undefined;
    if (!simulationResult.success) {
      const vmStatus = simulationResult.vm_status as string || 'Unknown VM error';

      // Decode the error for detailed debugging info
      const decoded = decodeError(vmStatus, request.payload.function);
      const suggestion = generateErrorSuggestion(decoded);
      const stackTrace = buildBasicStackTrace(request.payload.function, false, gasUsed);
      const failurePoint = extractFailurePoint(vmStatus, request.payload.function, gasUsed);

      errorInfo = {
        code: decoded.errorName || extractErrorCode(vmStatus),
        message: decoded.errorDescription || `Transaction aborted: ${vmStatus}`,
        vmStatus,
        suggestion,
        decoded,
        stackTrace,
        failurePoint,
      };
    }

    // Generate human-readable explanation
    const explanation = explainTransaction(request, {
      id: simulation.id,
      shareId,
      success: simulationResult.success,
      gasUsed,
      gasBreakdown,
      stateChanges: enhancedStateChanges,
      events,
      shareUrl: '',
    });

    return {
      id: simulation.id,
      shareId,
      success: simulationResult.success,
      gasUsed,
      gasBreakdown,
      stateChanges: enhancedStateChanges,
      events,
      executionTrace,
      error: errorInfo,
      warnings: warnings.length > 0 ? warnings : undefined,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      forkMetadata,
      explanation,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sim/${shareId}`,
    };
  } catch (error: unknown) {
    // Handle simulation failure with enhanced error decoding
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Decode the error for detailed debugging info
    const decoded = decodeError(errorMessage, request.payload.function);
    const suggestion = generateErrorSuggestion(decoded);

    // Build basic stack trace for failed execution
    const stackTrace = buildBasicStackTrace(request.payload.function, false, 0);
    const failurePoint = extractFailurePoint(errorMessage, request.payload.function, 0);

    // Build enhanced error info
    const errorInfo: SimulationError = {
      code: decoded.errorName || extractErrorCode(errorMessage),
      message: decoded.errorDescription || `Transaction simulation failed: ${errorMessage}`,
      vmStatus: errorMessage,
      suggestion,
      decoded,
      stackTrace,
      failurePoint,
    };

    // Store failed simulation in database
    const simulation = await prisma.simulation.create({
      data: {
        shareId,
        userId,
        network: request.network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
        sender: request.sender,
        functionName: request.payload.function,
        typeArguments: request.payload.type_arguments,
        arguments: request.payload.arguments as Prisma.InputJsonValue,
        maxGasAmount: request.options?.max_gas_amount ?? 100000,
        gasUnitPrice: request.options?.gas_unit_price ?? 100,
        success: false,
        error: errorInfo as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    // Cache for sharing
    await cacheSimulation(shareId, simulation);

    return {
      id: simulation.id,
      shareId,
      success: false,
      error: errorInfo,
      recommendations: [
        'Review the error details above to understand why the transaction failed.',
        suggestion,
      ],
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sim/${shareId}`,
    };
  }
}

/**
 * Get a simulation by its share ID
 */
export async function getSimulationByShareId(
  shareId: string
): Promise<SimulationResponse | null> {
  // Try cache first
  const cached = await cacheGet<Record<string, unknown>>(`sim:${shareId}`);
  if (cached) {
    return formatSimulationResponse(cached);
  }

  // Fall back to database
  const simulation = await prisma.simulation.findUnique({
    where: { shareId },
  });

  if (!simulation) return null;

  // Check if expired
  if (simulation.expiresAt < new Date()) {
    return null;
  }

  // Re-cache for future requests
  await cacheSimulation(shareId, simulation);

  return formatSimulationResponse(simulation as unknown as Record<string, unknown>);
}

/**
 * Extract state changes from simulation result (raw, without before state)
 */
function extractStateChanges(result: Record<string, unknown>): StateChange[] {
  const changes: StateChange[] = [];
  const resultChanges = result.changes as Array<Record<string, unknown>> | undefined;

  if (resultChanges) {
    for (const change of resultChanges) {
      if (change.type === 'write_resource') {
        const data = change.data as Record<string, unknown> | undefined;
        changes.push({
          type: 'modify', // Could be 'create' if resource didn't exist
          resource: (data?.type as string) || 'unknown',
          address: change.address as string,
          after: data?.data,
        });
      } else if (change.type === 'delete_resource') {
        changes.push({
          type: 'delete',
          resource: change.resource as string,
          address: change.address as string,
        });
      }
    }
  }

  return changes;
}

/**
 * Fetch current (before) state for resources that will be changed
 */
async function fetchBeforeState(
  client: Aptos,
  changes: StateChange[]
): Promise<Map<string, unknown>> {
  const beforeState = new Map<string, unknown>();

  // Fetch state for each unique address+resource combination
  const fetchPromises: Promise<void>[] = [];

  for (const change of changes) {
    const key = `${change.address}:${change.resource}`;
    if (beforeState.has(key)) continue;

    const fetchPromise = (async () => {
      try {
        // Extract struct type from full resource path
        // e.g., "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>" -> struct tag
        const resourceType = change.resource;

        const resource = await client.getAccountResource({
          accountAddress: change.address,
          resourceType: resourceType as `${string}::${string}::${string}`,
        });

        if (resource) {
          beforeState.set(key, resource);
        }
      } catch {
        // Resource doesn't exist (new creation) - this is fine
        beforeState.set(key, null);
      }
    })();

    fetchPromises.push(fetchPromise);
  }

  await Promise.all(fetchPromises);
  return beforeState;
}

/**
 * Merge before state into state changes and compute diffs
 */
function mergeBeforeState(
  changes: StateChange[],
  beforeState: Map<string, unknown>
): StateChange[] {
  return changes.map(change => {
    const key = `${change.address}:${change.resource}`;
    const before = beforeState.get(key);

    // Determine if this is a create or modify
    let type: StateChange['type'] = change.type;
    if (change.type === 'modify' && before === null) {
      type = 'create';  // Resource didn't exist before
    }

    return {
      ...change,
      type,
      before: before !== null ? before : undefined,
    };
  });
}

/**
 * Extract events from simulation result
 */
function extractEvents(result: Record<string, unknown>): SimulationEvent[] {
  const resultEvents = result.events as Array<Record<string, unknown>> | undefined;
  if (!resultEvents) return [];

  return resultEvents.map((event, index) => ({
    type: event.type as string,
    data: event.data,
    sequenceNumber: parseInt(event.sequence_number as string) || index,
  }));
}

/**
 * Extract gas breakdown from simulation result (legacy, used for cached results)
 */
function extractGasBreakdown(result: Record<string, unknown>): GasBreakdown {
  const total = parseInt(result.gas_used as string) || 0;

  // Approximate breakdown (actual breakdown would come from detailed trace)
  // Movement/Aptos gas is primarily computation-based
  return {
    total,
    computation: Math.floor(total * 0.65),
    storage: Math.floor(total * 0.35),
  };
}

/**
 * Parse simulation error into human-readable format
 */
function parseSimulationError(error: unknown): SimulationError {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Extract error code from message
  const errorCode = extractErrorCode(errorMessage);
  const mapping = ERROR_MAPPINGS[errorCode] || {
    message: `Transaction simulation failed: ${errorMessage}`,
    suggestion:
      'Check the transaction parameters and try again. If the issue persists, the contract may have specific requirements.',
  };

  return {
    code: errorCode,
    message: mapping.message,
    vmStatus: errorMessage,
    suggestion: mapping.suggestion,
  };
}

/**
 * Extract error code from VM status string
 */
function extractErrorCode(vmStatus: string): string {
  const status = vmStatus.toUpperCase();

  // Account/Resource Errors
  if (status.includes('ACCOUNT_NOT_FOUND') || vmStatus.includes('account_not_found')) {
    return 'ACCOUNT_NOT_FOUND';
  }
  if (status.includes('RESOURCE_DOES_NOT_EXIST') || status.includes('RESOURCE_NOT_FOUND')) {
    return 'RESOURCE_DOES_NOT_EXIST';
  }
  if (status.includes('RESOURCE_ALREADY_EXISTS')) {
    return 'RESOURCE_ALREADY_EXISTS';
  }

  // Balance/Amount Errors
  if (status.includes('INSUFFICIENT_BALANCE') || status.includes('EINSUFFICIENT_BALANCE')) {
    return 'INSUFFICIENT_BALANCE';
  }
  if (status.includes('INVALID_AMOUNT') || status.includes('EINVALID_AMOUNT')) {
    return 'INVALID_AMOUNT';
  }
  if (status.includes('EXCEEDS_MAX') || status.includes('MAX_LIMIT')) {
    return 'EXCEEDS_MAX_LIMIT';
  }

  // Authorization Errors
  if (status.includes('UNAUTHORIZED') || status.includes('EUNAUTHORIZED') || status.includes('NOT_AUTHORIZED')) {
    return 'UNAUTHORIZED';
  }
  if (status.includes('NOT_OWNER') || status.includes('ENOT_OWNER')) {
    return 'NOT_OWNER';
  }
  if (status.includes('PERMISSION_DENIED')) {
    return 'PERMISSION_DENIED';
  }

  // State Errors
  if (status.includes('LOCKED') || status.includes('ELOCKED')) {
    return 'RESOURCE_LOCKED';
  }
  if (status.includes('INVALID_STATE') || status.includes('EINVALID_STATE')) {
    return 'INVALID_STATE';
  }

  // Argument Errors
  if (status.includes('INVALID_ARGUMENT') || status.includes('EINVALID_ARGUMENT')) {
    return 'INVALID_ARGUMENT';
  }
  if (status.includes('INVALID_ADDRESS')) {
    return 'INVALID_ADDRESS';
  }

  // Module/Function Errors
  if (status.includes('FUNCTION_NOT_FOUND') || status.includes('LINKER_ERROR')) {
    return 'FUNCTION_NOT_FOUND';
  }
  if (status.includes('MODULE_NOT_FOUND')) {
    return 'MODULE_NOT_FOUND';
  }
  if (status.includes('TYPE_MISMATCH') || status.includes('TYPE_ERROR')) {
    return 'TYPE_MISMATCH';
  }

  // Transaction Errors
  if (status.includes('SEQUENCE_NUMBER')) {
    return 'SEQUENCE_NUMBER_TOO_OLD';
  }
  if (status.includes('INVALID_AUTH_KEY') || status.includes('AUTH_KEY')) {
    return 'INVALID_AUTH_KEY';
  }

  // Generic Move Abort - try to extract useful info
  if (status.includes('MOVE_ABORT') || status.includes('ABORTED')) {
    return 'MOVE_ABORT';
  }

  return 'SIMULATION_FAILED';
}

/**
 * Cache simulation result
 */
async function cacheSimulation(
  shareId: string,
  simulation: Record<string, unknown>
): Promise<void> {
  await cacheSet(`sim:${shareId}`, simulation, REDIS_CACHE_TTL_SECONDS);
}

/**
 * Try to look up public key from account's transaction history
 * This works if the account has ever signed a transaction on-chain
 */
async function lookupPublicKeyFromChain(
  client: Aptos,
  address: string
): Promise<Ed25519PublicKey | null> {
  try {
    // Normalize address to 64 characters (SDK requirement)
    const normalizedAddress = address.startsWith('0x')
      ? '0x' + address.slice(2).padStart(64, '0')
      : '0x' + address.padStart(64, '0');

    // Get the account's transactions to find a signed one
    const transactions = await client.getAccountTransactions({
      accountAddress: normalizedAddress,
      options: { limit: 1 },
    });

    if (transactions.length === 0) {
      console.log('[Simulation] No transactions found for address, cannot lookup public key');
      return null;
    }

    // Extract the public key from the signature
    const tx = transactions[0] as Record<string, unknown>;
    const signature = tx.signature as Record<string, unknown> | undefined;

    if (signature?.public_key) {
      const pubKeyHex = signature.public_key as string;
      console.log('[Simulation] Found public key from transaction history:', pubKeyHex.slice(0, 20) + '...');
      return new Ed25519PublicKey(pubKeyHex);
    }

    // For multi-agent or fee payer transactions, structure is different
    if (signature?.sender) {
      const senderSig = signature.sender as Record<string, unknown>;
      if (senderSig.public_key) {
        const pubKeyHex = senderSig.public_key as string;
        console.log('[Simulation] Found public key from sender signature:', pubKeyHex.slice(0, 20) + '...');
        return new Ed25519PublicKey(pubKeyHex);
      }
    }

    console.log('[Simulation] Could not extract public key from transaction signature');
    return null;
  } catch (error) {
    console.log('[Simulation] Failed to lookup public key from chain:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Format database record as API response for shared simulations
 * Includes all metadata fields needed for the shared view
 */
function formatSimulationResponse(
  simulation: Record<string, unknown>
): SimulationResponse {
  // Convert network from DB format (MAINNET/TESTNET/DEVNET) to lowercase
  const networkRaw = simulation.network as string;
  const network = networkRaw?.toLowerCase() as 'mainnet' | 'testnet' | 'devnet';

  // Format dates as ISO strings
  const createdAt = simulation.createdAt instanceof Date
    ? simulation.createdAt.toISOString()
    : simulation.createdAt as string;
  const expiresAt = simulation.expiresAt instanceof Date
    ? simulation.expiresAt.toISOString()
    : simulation.expiresAt as string;

  // Rebuild execution trace from stored events and state changes
  const events = simulation.events as SimulationEvent[] | undefined;
  const stateChanges = simulation.stateChanges as StateChange[] | undefined;
  const gasUsed = simulation.gasUsed as number | undefined;
  const functionName = simulation.functionName as string;
  const success = simulation.success as boolean;

  let executionTrace: ExecutionTrace | undefined;
  if (events && stateChanges && gasUsed !== undefined && functionName) {
    executionTrace = buildExecutionTrace(
      functionName,
      events,
      stateChanges,
      gasUsed,
      success
    );
  }

  return {
    id: simulation.id as string,
    shareId: simulation.shareId as string,
    success,
    gasUsed,
    gasBreakdown: simulation.gasBreakdown as GasBreakdown | undefined,
    stateChanges,
    events,
    executionTrace,
    error: simulation.error as SimulationError | undefined,
    shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sim/${simulation.shareId}`,
    // Additional fields for shared simulation view
    network,
    functionName,
    typeArguments: simulation.typeArguments as string[],
    arguments: simulation.arguments as unknown[],
    sender: simulation.sender as string | undefined,
    createdAt,
    expiresAt,
  };
}
