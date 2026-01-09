import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { simulateTransaction, getSimulationByShareId, simulateWithCLI } from '../services/simulation.js';
import { checkCliInstalled } from '../lib/cliExecutor.js';
import { checkStateOverrideSupport, runForkSimulationWithOverrides } from '../lib/forkSimulation.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requirePayment } from '../middleware/x402.js';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  getAllBenchmarks,
  getNetworkStats,
  getBenchmark,
  forceRefreshBenchmarks,
  type GasBenchmark,
} from '../services/gasBenchmarkService.js';
import type { Network } from '@movewatch/shared';

const router: RouterType = Router();

// Request validation schema
const simulateSchema = z.object({
  network: z.enum(['mainnet', 'testnet', 'devnet']),
  sender: z
    .string()
    .regex(/^0x[a-fA-F0-9]{1,64}$/, 'Invalid address format')
    .optional(),
  senderPublicKey: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid public key format (must be 32 bytes hex)')
    .optional(),
  payload: z.object({
    function: z
      .string()
      .regex(
        /^0x[a-fA-F0-9]+::\w+::\w+$/,
        'Invalid function path. Expected format: 0x1::module::function'
      ),
    type_arguments: z.array(z.string()).default([]),
    arguments: z.array(z.unknown()).default([]),
  }),
  options: z
    .object({
      max_gas_amount: z.number().int().positive().optional(),
      gas_unit_price: z.number().int().positive().optional(),
      // Fork simulation options
      ledger_version: z
        .string()
        .regex(/^\d+$/, 'Ledger version must be a numeric string')
        .optional(),
      state_overrides: z
        .array(
          z.object({
            address: z
              .string()
              .regex(/^0x[a-fA-F0-9]{1,64}$/, 'Invalid address format'),
            resource_type: z
              .string()
              .regex(/^0x[a-fA-F0-9]+::\w+::\w+/, 'Invalid resource type format'),
            data: z.record(z.unknown()),
          })
        )
        .optional(),
      // CLI-based detailed trace (requires Aptos CLI installed)
      detailed_trace: z.boolean().optional(),
    })
    .optional(),
});

/**
 * GET /simulate/cli-status
 * Check if Aptos CLI is installed for detailed tracing
 */
router.get('/cli-status', async (req, res) => {
  try {
    const status = await checkCliInstalled();
    res.json({
      available: status.installed,
      version: status.version,
      features: status.installed
        ? ['detailed_execution_trace', 'per_instruction_gas', 'flamegraph_visualization']
        : [],
      message: status.installed
        ? `Aptos CLI v${status.version} available for detailed gas profiling`
        : 'Aptos CLI not installed. Install with: curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3',
    });
  } catch (error) {
    res.json({
      available: false,
      features: [],
      message: 'Failed to check CLI status',
    });
  }
});

/**
 * GET /simulate/state-override-support
 * Check if state overrides are supported (requires Aptos CLI 4.5.0+ on server)
 */
router.get('/state-override-support', async (req, res) => {
  try {
    const support = await checkStateOverrideSupport();
    res.json({
      supported: support.supported,
      method: support.method,
      version: support.version,
      features: support.supported
        ? ['account_funding', 'balance_override', 'ledger_version_fork']
        : [],
      limitations: support.supported
        ? [
            'Only coin/fungible asset balance overrides are supported',
            'Generic resource state overrides coming soon',
          ]
        : [],
      message: support.supported
        ? 'State overrides are available'
        : 'State overrides coming soon',
    });
  } catch (error) {
    res.json({
      supported: false,
      method: 'none',
      features: [],
      limitations: [],
      message: 'State overrides coming soon',
    });
  }
});

/**
 * GET /simulate/gas-benchmarks
 * Get real gas usage benchmarks from the network
 *
 * Query params:
 * - network: 'mainnet' | 'testnet' (default: 'testnet')
 * - function: Optional function path to get specific benchmark
 * - refresh: 'true' to force refresh cache
 */
router.get('/gas-benchmarks', async (req, res) => {
  try {
    const network = (req.query.network as Network) || 'testnet';
    const functionPath = req.query.function as string | undefined;
    const forceRefresh = req.query.refresh === 'true';

    // Validate network
    if (!['mainnet', 'testnet', 'devnet'].includes(network)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid network. Must be mainnet, testnet, or devnet',
        },
      });
    }

    // Force refresh if requested
    if (forceRefresh) {
      await forceRefreshBenchmarks(network);
    }

    // Get specific function benchmark or all
    if (functionPath) {
      const benchmark = await getBenchmark(network, functionPath);
      return res.json({
        network,
        function: functionPath,
        benchmark,
        isRealData: benchmark.sampleSize >= 10,
        message: benchmark.sampleSize >= 10
          ? `Based on ${benchmark.sampleSize} real transactions`
          : 'Using estimated values (insufficient real data)',
      });
    }

    // Get all benchmarks
    const benchmarks = await getAllBenchmarks(network);
    const stats = await getNetworkStats(network);

    res.json({
      network,
      benchmarks: benchmarks.map((b) => ({
        ...b,
        isRealData: b.sampleSize >= 10,
      })),
      networkStats: stats,
      totalTrackedFunctions: benchmarks.length,
      functionsWithRealData: benchmarks.filter((b) => b.sampleSize >= 10).length,
    });
  } catch (error) {
    console.error('[GasBenchmarks] Error:', error);
    res.status(500).json({
      error: {
        code: 'BENCHMARK_ERROR',
        message: 'Failed to fetch gas benchmarks',
      },
    });
  }
});

/**
 * GET /simulate/network-stats
 * Get network-wide gas statistics
 *
 * Query params:
 * - network: 'mainnet' | 'testnet' (default: 'testnet')
 */
router.get('/network-stats', async (req, res) => {
  try {
    const network = (req.query.network as Network) || 'testnet';

    if (!['mainnet', 'testnet', 'devnet'].includes(network)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid network. Must be mainnet, testnet, or devnet',
        },
      });
    }

    const stats = await getNetworkStats(network);

    res.json({
      network,
      stats,
      message: stats.totalTransactions > 0
        ? `Based on ${stats.totalTransactions} recent transactions`
        : 'Using default estimates (network data unavailable)',
    });
  } catch (error) {
    console.error('[NetworkStats] Error:', error);
    res.status(500).json({
      error: {
        code: 'STATS_ERROR',
        message: 'Failed to fetch network stats',
      },
    });
  }
});

/**
 * POST /simulate
 * Simulate a transaction against Movement Network (for authenticated users)
 *
 * Access: Subscription-based (requires authentication)
 * - Free tier: Rate-limited
 * - Pro/Enterprise: Unlimited
 *
 * Options:
 * - detailed_trace: boolean - Use CLI for real execution traces (requires Aptos CLI)
 */
router.post(
  '/',
  requireAuth,
  rateLimit('simulate'),
  async (req: AuthenticatedRequest, res, next) => {
  try {
    // Validate request body
    const parseResult = simulateSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }

    const request = parseResult.data;

    // Check if state overrides are provided - use CLI session-based simulation
    if (request.options?.state_overrides && request.options.state_overrides.length > 0) {
      // Check if CLI simulation sessions are available
      const support = await checkStateOverrideSupport();

      if (!support.supported) {
        return res.status(503).json({
          error: {
            code: 'STATE_OVERRIDES_NOT_AVAILABLE',
            message: 'State overrides require Aptos CLI 4.5.0+ with simulation sessions',
            suggestion: 'Install Aptos CLI: curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3',
            details: support.error,
          },
        });
      }

      // Run simulation with state overrides using CLI session
      const result = await runForkSimulationWithOverrides(
        request.network,
        request.options.state_overrides,
        {
          functionId: request.payload.function,
          sender: request.sender || '0x1',
          typeArguments: request.payload.type_arguments,
          arguments: request.payload.arguments.map(a => String(a)),
          maxGasAmount: request.options?.max_gas_amount,
          gasUnitPrice: request.options?.gas_unit_price,
        },
        request.options.ledger_version
      );

      return res.json({
        success: result.success,
        gasUsed: result.gasUsed,
        vmStatus: result.vmStatus,
        error: result.error,
        stateOverrides: {
          applied: result.stateOverridesApplied.length > 0,
          details: result.overrideDetails,
        },
        forkMetadata: result.forkMetadata,
      });
    }

    // Check if detailed trace is requested
    if (request.options?.detailed_trace) {
      // Check if CLI is available
      const cliStatus = await checkCliInstalled();
      if (!cliStatus.installed) {
        return res.status(503).json({
          error: {
            code: 'CLI_NOT_AVAILABLE',
            message: 'Detailed trace requires Aptos CLI which is not installed on this server',
            suggestion: 'Use the standard simulation without detailed_trace option, or contact the administrator to install Aptos CLI',
          },
        });
      }

      // Run CLI-based simulation
      const result = await simulateWithCLI(request);
      return res.json(result);
    }

    // Run standard REST API simulation
    const result = await simulateTransaction(request);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /simulate/agent
 * Simulate a transaction for AI trading agents (x402 payment required)
 *
 * Access: x402 micropayment (no authentication needed)
 * - Price: 0.001 MOVE per simulation
 * - No rate limits - pay per use
 * - Designed for autonomous AI agents executing DeFi trades
 *
 * Use case: Trading bots simulate transactions before executing to verify
 * expected outcomes and avoid failed transactions or unexpected slippage.
 */
router.post(
  '/agent',
  requirePayment('POST /v1/simulate/agent'),
  async (req, res, next) => {
  try {
    // Validate request body
    const parseResult = simulateSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }

    const request = parseResult.data;

    // Run standard REST API simulation (no CLI features for agent endpoint)
    const result = await simulateTransaction(request);

    // Add metadata for agent consumption
    res.json({
      ...result,
      _meta: {
        endpoint: 'agent',
        payment: 'x402',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /sim/:shareId
 * Retrieve a shared simulation result
 */
router.get('/sim/:shareId', async (req, res, next) => {
  try {
    const { shareId } = req.params;

    if (!shareId || shareId.length < 5) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid share ID',
        },
      });
    }

    const simulation = await getSimulationByShareId(shareId);

    if (!simulation) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Simulation not found or has expired',
        },
      });
    }

    res.json(simulation);
  } catch (error) {
    next(error);
  }
});

export default router;
