import { Ed25519PublicKey } from '@aptos-labs/ts-sdk';
import { nanoid } from 'nanoid';
import {
  type SimulationRequest,
  type SimulationResponse,
  type StateChange,
  type SimulationEvent,
  type SimulationError,
  type GasBreakdown,
  ERROR_MAPPINGS,
  SIMULATION_TTL_DAYS,
  REDIS_CACHE_TTL_SECONDS,
} from '@movewatch/shared';
import { prisma } from '../lib/prisma.js';
import { cacheSet, cacheGet } from '../lib/redis.js';
import {
  getMovementClient,
  parseFunctionPath,
  generateDummyAddress,
  generateDummyPublicKey,
} from '../lib/movement.js';

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

  try {
    // Build the transaction
    const transaction = await client.transaction.build.simple({
      sender: request.sender || generateDummyAddress(),
      data: {
        function: `${moduleAddress}::${moduleName}::${functionName}`,
        typeArguments: request.payload.type_arguments,
        functionArguments: request.payload.arguments,
      },
      options: {
        maxGasAmount: request.options?.max_gas_amount ?? 100000,
        gasUnitPrice: request.options?.gas_unit_price ?? 100,
      },
    });

    // Create a dummy public key for simulation
    const dummyPublicKey = new Ed25519PublicKey(generateDummyPublicKey());

    // Simulate the transaction
    const [simulationResult] = await client.transaction.simulate.simple({
      signerPublicKey: dummyPublicKey,
      transaction,
    });

    // Extract results
    const stateChanges = extractStateChanges(simulationResult);
    const events = extractEvents(simulationResult);
    const gasBreakdown = extractGasBreakdown(simulationResult);
    const gasUsed = parseInt(simulationResult.gas_used) || 0;

    // Store in database
    const simulation = await prisma.simulation.create({
      data: {
        shareId,
        userId,
        network: request.network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
        sender: request.sender,
        functionName: request.payload.function,
        typeArguments: request.payload.type_arguments,
        arguments: request.payload.arguments,
        maxGasAmount: request.options?.max_gas_amount ?? 100000,
        gasUnitPrice: request.options?.gas_unit_price ?? 100,
        success: simulationResult.success,
        gasUsed,
        gasBreakdown,
        stateChanges,
        events,
        rawResponse: simulationResult as unknown as Record<string, unknown>,
        expiresAt,
      },
    });

    // Cache for sharing
    await cacheSimulation(shareId, simulation);

    return {
      id: simulation.id,
      shareId,
      success: true,
      gasUsed,
      gasBreakdown,
      stateChanges,
      events,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sim/${shareId}`,
    };
  } catch (error: unknown) {
    // Handle simulation failure
    const errorInfo = parseSimulationError(error);

    // Store failed simulation in database
    const simulation = await prisma.simulation.create({
      data: {
        shareId,
        userId,
        network: request.network.toUpperCase() as 'MAINNET' | 'TESTNET' | 'DEVNET',
        sender: request.sender,
        functionName: request.payload.function,
        typeArguments: request.payload.type_arguments,
        arguments: request.payload.arguments,
        maxGasAmount: request.options?.max_gas_amount ?? 100000,
        gasUnitPrice: request.options?.gas_unit_price ?? 100,
        success: false,
        error: errorInfo,
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
 * Extract state changes from simulation result
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
 * Extract gas breakdown from simulation result
 */
function extractGasBreakdown(result: Record<string, unknown>): GasBreakdown {
  const total = parseInt(result.gas_used as string) || 0;

  // Approximate breakdown (actual breakdown would come from detailed trace)
  // Movement/Aptos gas is primarily computation-based
  return {
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
  if (vmStatus.includes('RESOURCE_DOES_NOT_EXIST')) return 'RESOURCE_DOES_NOT_EXIST';
  if (vmStatus.includes('INSUFFICIENT_BALANCE')) return 'INSUFFICIENT_BALANCE';
  if (vmStatus.includes('INVALID_ARGUMENT')) return 'INVALID_ARGUMENT';
  if (vmStatus.includes('SEQUENCE_NUMBER')) return 'SEQUENCE_NUMBER_TOO_OLD';
  if (vmStatus.includes('FUNCTION_NOT_FOUND')) return 'FUNCTION_NOT_FOUND';
  if (vmStatus.includes('MODULE_NOT_FOUND')) return 'MODULE_NOT_FOUND';
  if (vmStatus.includes('TYPE_MISMATCH')) return 'TYPE_MISMATCH';
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
 * Format database record as API response
 */
function formatSimulationResponse(
  simulation: Record<string, unknown>
): SimulationResponse {
  return {
    id: simulation.id as string,
    shareId: simulation.shareId as string,
    success: simulation.success as boolean,
    gasUsed: simulation.gasUsed as number | undefined,
    gasBreakdown: simulation.gasBreakdown as GasBreakdown | undefined,
    stateChanges: simulation.stateChanges as StateChange[] | undefined,
    events: simulation.events as SimulationEvent[] | undefined,
    error: simulation.error as SimulationError | undefined,
    shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sim/${simulation.shareId}`,
  };
}
