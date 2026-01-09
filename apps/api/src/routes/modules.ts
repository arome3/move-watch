/**
 * Module ABI Routes
 * Provides module introspection and function discovery endpoints
 */

import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import {
  getModuleABI,
  listAccountModules,
  getEntryFunctions,
  getViewFunctions,
  getPublicFunctions,
  getFunction,
  generateArgumentFields,
  searchModules,
  POPULAR_MODULES,
  type MoveModuleABI,
} from '../lib/abiLoader.js';
import {
  analyzeMove2Features,
  getFeatureCatalog,
  getFeaturesByVersion,
  analyzeFunction,
} from '../lib/move2Analyzer.js';
import {
  analyzeGasModel,
  getGasModelDetails,
  estimateCommonOperations,
  getMovementFeatures,
} from '../lib/gasModel.js';
import type { Network } from '@movewatch/shared';

const router: RouterType = Router();

// Network validation
const networkSchema = z.enum(['mainnet', 'testnet', 'devnet']).default('testnet');

// ============================================================================
// MOVE 2 ANALYSIS ENDPOINTS (must be before parameterized routes)
// ============================================================================

/**
 * GET /modules/move2/features
 * Get the full catalog of Move 2 features
 */
router.get('/move2/features', (req, res) => {
  const version = req.query.version as string | undefined;

  if (version && ['2.0', '2.1', '2.2', '2.3'].includes(version)) {
    const features = getFeaturesByVersion(version as '2.0' | '2.1' | '2.2' | '2.3');
    return res.json({
      version,
      features,
      count: features.length,
    });
  }

  const catalog = getFeatureCatalog();
  res.json({
    features: catalog,
    count: catalog.length,
    versions: ['2.0', '2.1', '2.2', '2.3'],
  });
});

/**
 * GET /modules/move2/analyze/:address/:name
 * Analyze a module for Move 2 feature usage
 */
router.get('/move2/analyze/:address/:name', async (req, res, next) => {
  try {
    const { address, name } = req.params;
    const network = networkSchema.parse(req.query.network) as Network;

    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{1,64}$/)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Invalid account address format',
        },
      });
    }

    const analysis = await analyzeMove2Features(network, address, name);

    if (!analysis) {
      return res.status(404).json({
        error: {
          code: 'MODULE_NOT_FOUND',
          message: `Module ${address}::${name} not found on ${network}`,
        },
      });
    }

    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /modules/move2/analyze-function
 * Quick analysis of a function path for Move 2 features
 */
router.post('/move2/analyze-function', (req, res) => {
  const { functionPath, typeArguments = [], arguments: args = [] } = req.body;

  if (!functionPath) {
    return res.status(400).json({
      error: {
        code: 'MISSING_FUNCTION_PATH',
        message: 'functionPath is required',
      },
    });
  }

  const analysis = analyzeFunction(functionPath, typeArguments, args);

  res.json({
    functionPath,
    ...analysis,
  });
});

// ============================================================================
// GAS MODEL ENDPOINTS (must be before parameterized routes)
// ============================================================================

/**
 * GET /modules/gas/model
 * Get Movement Network gas model details
 */
router.get('/gas/model', (req, res) => {
  const network = networkSchema.parse(req.query.network) as Network;
  const model = getGasModelDetails(network);

  res.json({
    network,
    model,
  });
});

/**
 * GET /modules/gas/analyze
 * Analyze gas usage with Movement-specific insights
 */
router.get('/gas/analyze', (req, res) => {
  const network = networkSchema.parse(req.query.network) as Network;
  const gasUsed = parseInt(req.query.gasUsed as string) || undefined;
  const functionPath = req.query.function as string | undefined;

  const gasBreakdown = gasUsed
    ? {
        total: gasUsed,
        computation: Math.floor(gasUsed * 0.4),
        storage: Math.floor(gasUsed * 0.25),
        byCategory: {
          execution: Math.floor(gasUsed * 0.4),
          io: Math.floor(gasUsed * 0.3),
          storage: Math.floor(gasUsed * 0.25),
          intrinsic: Math.floor(gasUsed * 0.05),
          dependencies: 0,
        },
      }
    : undefined;

  const analysis = analyzeGasModel(network, gasBreakdown, functionPath);

  res.json(analysis);
});

/**
 * GET /modules/gas/estimates
 * Get gas estimates for common operations
 */
router.get('/gas/estimates', (req, res) => {
  const estimates = estimateCommonOperations();

  res.json({
    estimates,
    note: 'Estimates based on typical gas usage. Actual costs may vary.',
    pricing: {
      currency: 'MOVE',
      gasUnitPrice: '150 octas (0.0000015 MOVE)',
    },
  });
});

/**
 * GET /modules/gas/comparison
 * Compare Movement gas costs with other networks
 */
router.get('/gas/comparison', (req, res) => {
  const network = networkSchema.parse(req.query.network) as Network;
  const analysis = analyzeGasModel(network);

  res.json({
    network,
    comparison: analysis.comparison,
    movementFeatures: getMovementFeatures(),
  });
});

/**
 * GET /modules/movement/features
 * Get Movement-specific features that differentiate it from Aptos
 */
router.get('/movement/features', (req, res) => {
  const features = getMovementFeatures();

  res.json({
    features,
    count: features.length,
    description: 'Features unique to Movement Network or enhanced compared to Aptos',
  });
});

// ============================================================================
// MODULE INTROSPECTION ENDPOINTS
// ============================================================================

/**
 * GET /modules/popular
 * Get list of popular/common modules
 */
router.get('/popular', (req, res) => {
  res.json({
    modules: POPULAR_MODULES,
    description: 'Common modules available on Movement Network',
  });
});

/**
 * GET /modules/search
 * Search for modules by name or address
 */
router.get('/search', async (req, res, next) => {
  try {
    const network = networkSchema.parse(req.query.network) as Network;
    const query = (req.query.q as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    if (query.length < 2) {
      return res.json({
        results: POPULAR_MODULES.slice(0, limit),
        query,
        source: 'popular',
      });
    }

    const results = await searchModules(network, query, limit);

    res.json({
      results,
      query,
      source: 'search',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /modules/:address
 * List all modules for an account
 */
router.get('/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    const network = networkSchema.parse(req.query.network) as Network;

    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{1,64}$/)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Invalid account address format',
        },
      });
    }

    const modules = await listAccountModules(network, address);

    res.json({
      address,
      network,
      modules,
      count: modules.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /modules/:address/:name
 * Get module ABI
 */
router.get('/:address/:name', async (req, res, next) => {
  try {
    const { address, name } = req.params;
    const network = networkSchema.parse(req.query.network) as Network;

    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{1,64}$/)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Invalid account address format',
        },
      });
    }

    // Validate module name
    if (!name.match(/^\w+$/)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_MODULE_NAME',
          message: 'Invalid module name format',
        },
      });
    }

    const moduleInfo = await getModuleABI(network, address, name);

    if (!moduleInfo || !moduleInfo.abi) {
      return res.status(404).json({
        error: {
          code: 'MODULE_NOT_FOUND',
          message: `Module ${address}::${name} not found on ${network}`,
        },
      });
    }

    res.json({
      address,
      name,
      network,
      abi: moduleInfo.abi,
      bytecodeSize: moduleInfo.bytecodeSize,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /modules/:address/:name/functions
 * Get all callable functions from a module
 */
router.get('/:address/:name/functions', async (req, res, next) => {
  try {
    const { address, name } = req.params;
    const network = networkSchema.parse(req.query.network) as Network;
    const filter = (req.query.filter as string) || 'entry'; // 'entry', 'view', 'public', 'all'

    const moduleInfo = await getModuleABI(network, address, name);

    if (!moduleInfo || !moduleInfo.abi) {
      return res.status(404).json({
        error: {
          code: 'MODULE_NOT_FOUND',
          message: `Module ${address}::${name} not found on ${network}`,
        },
      });
    }

    let functions;
    switch (filter) {
      case 'entry':
        functions = getEntryFunctions(moduleInfo.abi);
        break;
      case 'view':
        functions = getViewFunctions(moduleInfo.abi);
        break;
      case 'public':
        functions = getPublicFunctions(moduleInfo.abi);
        break;
      case 'all':
        functions = getPublicFunctions(moduleInfo.abi);
        break;
      default:
        functions = getEntryFunctions(moduleInfo.abi);
    }

    res.json({
      address,
      name,
      network,
      filter,
      functions,
      count: functions.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /modules/:address/:name/functions/:functionName
 * Get details for a specific function including argument fields
 */
router.get('/:address/:name/functions/:functionName', async (req, res, next) => {
  try {
    const { address, name, functionName } = req.params;
    const network = networkSchema.parse(req.query.network) as Network;

    const moduleInfo = await getModuleABI(network, address, name);

    if (!moduleInfo || !moduleInfo.abi) {
      return res.status(404).json({
        error: {
          code: 'MODULE_NOT_FOUND',
          message: `Module ${address}::${name} not found on ${network}`,
        },
      });
    }

    const fn = getFunction(moduleInfo.abi, functionName);

    if (!fn) {
      return res.status(404).json({
        error: {
          code: 'FUNCTION_NOT_FOUND',
          message: `Function ${functionName} not found in ${address}::${name}`,
        },
      });
    }

    // Generate form fields for arguments
    const argumentFields = generateArgumentFields(fn);

    res.json({
      address,
      name,
      network,
      function: fn,
      argumentFields,
      fullPath: fn.fullPath,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /modules/:address/:name/structs
 * Get all structs from a module
 */
router.get('/:address/:name/structs', async (req, res, next) => {
  try {
    const { address, name } = req.params;
    const network = networkSchema.parse(req.query.network) as Network;

    const moduleInfo = await getModuleABI(network, address, name);

    if (!moduleInfo || !moduleInfo.abi) {
      return res.status(404).json({
        error: {
          code: 'MODULE_NOT_FOUND',
          message: `Module ${address}::${name} not found on ${network}`,
        },
      });
    }

    const structs = moduleInfo.abi.structs || [];

    res.json({
      address,
      name,
      network,
      structs,
      count: structs.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
