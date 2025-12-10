import { Router } from 'express';
import { z } from 'zod';
import { simulateTransaction, getSimulationByShareId } from '../services/simulation.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

// Request validation schema
const simulateSchema = z.object({
  network: z.enum(['mainnet', 'testnet', 'devnet']),
  sender: z
    .string()
    .regex(/^0x[a-fA-F0-9]{1,64}$/, 'Invalid address format')
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
    })
    .optional(),
});

/**
 * POST /simulate
 * Simulate a transaction against Movement Network
 */
router.post('/', rateLimit('simulate'), async (req, res, next) => {
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

    // Run simulation (no user ID for anonymous requests)
    const result = await simulateTransaction(request);

    res.json(result);
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
