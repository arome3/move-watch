/**
 * Guardian Risk Analyzer API Routes
 *
 * POST /v1/guardian/check         - Analyze transaction for risks (subscription-based)
 * POST /v1/guardian/check/agent   - Analyze transaction for AI agents (x402 payment)
 * GET  /v1/guardian/check/:id     - Get analysis result by share ID
 * GET  /v1/guardian/patterns      - List available detection patterns
 * GET  /v1/guardian/demo          - Get demo transactions for testing
 * GET  /v1/guardian/scam-database - Get scam database statistics
 * GET  /v1/guardian/move-prover   - Get Move Prover integration info
 * GET  /v1/guardian/market-data   - Get market data service statistics
 */

import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { rateLimit } from '../middleware/rateLimit.js';
import { requirePayment } from '../middleware/x402.js';
// Note: Guardian uses subscription-based access for human users
// AI agents can use /check/agent endpoint with x402 micropayments
import {
  analyzeTransaction,
  getGuardianCheckByShareId,
  getDemoTransactions,
  getPatternSummary,
  getScamDatabaseStats,
  checkMoveProverAvailability,
  getMoveProverInfo,
  getMarketDataStats,
  PATTERN_STATS,
} from '../services/guardian/index.js';

const router: RouterType = Router();

// Request validation schema for Guardian check
const guardianCheckSchema = z.object({
  network: z.enum(['mainnet', 'testnet', 'devnet']),
  functionName: z
    .string()
    .regex(
      /^0x[a-fA-F0-9]+::\w+::\w+$/,
      'Invalid function path. Expected format: 0x1::module::function'
    ),
  typeArguments: z.array(z.string()).default([]),
  arguments: z.array(z.unknown()).default([]),
  sender: z
    .string()
    .regex(/^0x[a-fA-F0-9]{1,64}$/, 'Invalid address format')
    .optional(),
  simulationId: z.string().optional(),
});

/**
 * POST /guardian/check
 * Analyze a transaction for security risks
 *
 * Access: Subscription-based (rate limited for free tier)
 *
 * Request body:
 * {
 *   network: "mainnet" | "testnet" | "devnet",
 *   functionName: "0x1::module::function",
 *   typeArguments: string[],
 *   arguments: unknown[],
 *   sender?: string,
 *   simulationId?: string
 * }
 *
 * Response:
 * {
 *   id: string,
 *   shareId: string,
 *   overallRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
 *   riskScore: number,
 *   issues: GuardianIssueResponse[],
 *   analysisTime: { patternMatchMs, llmAnalysisMs?, totalMs },
 *   usedLlm: boolean,
 *   shareUrl: string,
 *   createdAt: string
 * }
 */
router.post(
  '/check',
  rateLimit('guardian'),
  async (req, res, next) => {
    try {
      // Validate request body
      const parseResult = guardianCheckSchema.safeParse(req.body);

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

      // Run Guardian analysis
      const result = await analyzeTransaction(request);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /guardian/check/agent
 * Analyze a transaction for AI trading agents (x402 payment required)
 *
 * Access: x402 micropayment (no authentication needed)
 * - Price: 0.005 MOVE per analysis (5x simulation cost for comprehensive security scan)
 * - No rate limits - pay per use
 * - Designed for autonomous AI agents that need pre-trade security checks
 *
 * Use case: Trading bots analyze transactions before executing to verify
 * they're not interacting with malicious contracts, rug pulls, or exploits.
 */
router.post(
  '/check/agent',
  requirePayment('POST /v1/guardian/check/agent'),
  async (req, res, next) => {
    try {
      // Validate request body
      const parseResult = guardianCheckSchema.safeParse(req.body);

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

      // Run Guardian analysis
      const result = await analyzeTransaction(request);

      // Add metadata for agent consumption
      res.json({
        ...result,
        _meta: {
          endpoint: 'agent',
          payment: 'x402',
          timestamp: new Date().toISOString(),
          recommendation: result.riskScore >= 70
            ? 'DO_NOT_EXECUTE'
            : result.riskScore >= 40
              ? 'PROCEED_WITH_CAUTION'
              : 'SAFE_TO_EXECUTE',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /guardian/check/:shareId
 * Retrieve a shared Guardian analysis result
 *
 * No authentication or payment required
 */
router.get('/check/:shareId', async (req, res, next) => {
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

    const result = await getGuardianCheckByShareId(shareId);

    if (!result) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Guardian check not found or has expired',
        },
      });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /guardian/patterns
 * List all available risk detection patterns
 *
 * No authentication or payment required
 *
 * Response:
 * {
 *   patterns: RiskPattern[],
 *   stats: { total, byCategory, bySeverity },
 *   total: number
 * }
 */
router.get('/patterns', async (_req, res, next) => {
  try {
    const patterns = getPatternSummary();

    res.json({
      patterns,
      stats: PATTERN_STATS,
      total: patterns.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /guardian/demo
 * Get demo transactions for testing Guardian
 *
 * No authentication or payment required
 *
 * Response:
 * {
 *   transactions: DemoTransaction[],
 *   total: number
 * }
 */
router.get('/demo', async (_req, res, next) => {
  try {
    const transactions = getDemoTransactions();

    res.json({
      transactions,
      total: transactions.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /guardian/scam-database
 * Get statistics about the scam contract database
 *
 * No authentication or payment required
 *
 * Response:
 * {
 *   totalAddresses: number,
 *   totalSignatures: number,
 *   totalExploitPatterns: number,
 *   totalImpersonationPatterns: number,
 *   lastUpdated: string
 * }
 */
router.get('/scam-database', async (_req, res, next) => {
  try {
    const stats = getScamDatabaseStats();

    res.json({
      stats,
      description: 'Scam database contains known malicious addresses, function signatures, exploit patterns, and module impersonation patterns.',
      sources: [
        'Community-reported scams',
        'Security audits (MoveBit, OtterSec, Verichains)',
        'On-chain forensics from past exploits',
        'DeFi hack labs research',
      ],
      disclaimer: 'This database is continuously updated. False negatives are possible. Always exercise caution.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /guardian/move-prover
 * Get information about Move Prover formal verification integration
 *
 * No authentication or payment required
 *
 * Response:
 * {
 *   proverInfo: { name, description, capabilities, requirements, resources },
 *   systemStatus: { available, version?, error?, recommendation },
 *   howItHelps: string[]
 * }
 */
router.get('/move-prover', async (_req, res, next) => {
  try {
    // Get prover info and system availability
    const [proverInfo, proverStatus] = await Promise.all([
      getMoveProverInfo(),
      checkMoveProverAvailability(),
    ]);

    res.json({
      proverInfo,
      systemStatus: proverStatus,
      howItHelps: [
        'Formal verification mathematically PROVES properties about smart contracts',
        'Can prove ABSENCE of certain bug classes (not just detect presence)',
        'Catches arithmetic overflow, resource leaks, access control violations',
        'Gold standard for high-value DeFi contracts',
        'Guardian recommends formal verification for contracts without spec annotations',
      ],
      limitations: [
        'Requires source code with specification annotations',
        'Cannot verify arbitrary bytecode (needs Move source)',
        'Prover installation required for full verification',
        'Guardian provides recommendations only - does not run prover directly',
      ],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /guardian/market-data
 * Get market data service statistics and configuration
 *
 * No authentication or payment required
 *
 * Response:
 * {
 *   stats: { knownTokens, cachedTokens, cacheHitRate },
 *   dataSource: string,
 *   howItHelps: string[]
 * }
 */
router.get('/market-data', async (_req, res, next) => {
  try {
    const stats = getMarketDataStats();

    res.json({
      stats,
      dataSource: 'CoinGecko API (free tier)',
      cacheConfig: {
        ttlMinutes: 5,
        description: 'Market data cached for 5 minutes to reduce API load',
      },
      howItHelps: [
        'Provides context about tokens involved in transactions',
        'Identifies unknown/unverified tokens (high scam risk)',
        'Flags low liquidity tokens (manipulation risk)',
        'Detects high volatility (pump-and-dump indicators)',
        'Helps estimate actual dollar value at risk',
      ],
      riskThresholds: {
        lowLiquidity: '$10,000 - tokens below this are flagged',
        highVolatility: '20% - price changes above this trigger warnings',
        lowMarketCap: '$100,000 - small cap tokens receive extra scrutiny',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
