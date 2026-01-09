import 'dotenv/config';
import express, { type Application } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import simulateRouter from './routes/simulate.js';
import alertsRouter from './routes/alerts.js';
import channelsRouter from './routes/channels.js';
import monitoringRouter from './routes/monitoring.js';
import actionsRouter from './routes/actions.js';
import paymentsRouter from './routes/payments.js';
import usersRouter from './routes/users.js';
import apiKeysRouter from './routes/apiKeys.js';
import guardianRouter from './routes/guardian.js';
import modulesRouter from './routes/modules.js';
import { initializeWebSocket, getWebSocketStats } from './services/websocketService.js';
import { startScheduler, stopScheduler, getSchedulerStats } from './lib/scheduler.js';
import { startAllIndexers, stopAllIndexers, getAllIndexerStatus } from './services/indexer.js';
import {
  performHealthCheck,
  livenessCheck,
  readinessCheck,
  getSystemMetrics,
} from './services/healthService.js';
import {
  startBalanceChecker,
  stopBalanceChecker,
  getBalanceCheckerStatus,
} from './services/balanceChecker.js';

const app: Application = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());

// CORS - allow frontend origin
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // In development, allow any localhost port
      if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }

      // In production, use FRONTEND_URL
      const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
      if (origin === allowedOrigin) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Request logging
app.use(morgan('dev'));

// Parse JSON bodies
app.use(express.json());

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

/**
 * Simple liveness probe (for k8s liveness check)
 * Returns immediately if process is alive
 */
app.get('/livez', (req, res) => {
  res.json(livenessCheck());
});

/**
 * Readiness probe (for k8s readiness check)
 * Returns ready status based on database availability
 */
app.get('/readyz', async (req, res) => {
  const { ready, reason } = await readinessCheck();
  if (ready) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not_ready', reason });
  }
});

/**
 * Full health check with dependency status
 */
app.get('/health', async (req, res) => {
  const health = await performHealthCheck(req.query.queues !== 'false');

  // Return 503 if unhealthy
  const statusCode = health.status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(health);
});

/**
 * System metrics endpoint (for monitoring)
 */
app.get('/metrics', async (req, res) => {
  const metrics = await getSystemMetrics();
  res.json(metrics);
});

// API routes
app.use('/v1/simulate', simulateRouter);
app.use('/v1/alerts', alertsRouter);
app.use('/v1/channels', channelsRouter);
app.use('/v1/monitoring', monitoringRouter);
app.use('/v1/actions', actionsRouter);
app.use('/v1/payments', paymentsRouter);
app.use('/v1/users', usersRouter);
app.use('/v1/api-keys', apiKeysRouter);
app.use('/v1/guardian', guardianRouter);
app.use('/v1/modules', modulesRouter);

// Global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message,
      },
    });
  }
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Create HTTP server for both Express and WebSocket
const server = createServer(app);

// Initialize WebSocket server
initializeWebSocket(server);

// Start server
server.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   MoveWatch API Server                                         ║
║   Running on http://localhost:${PORT}                           ║
║                                                                ║
║   Simulation Endpoints:                                        ║
║   - POST /v1/simulate             Simulate transaction         ║
║   - GET  /v1/sim/:id              Get shared simulation        ║
║                                                                ║
║   Alert Endpoints:                                             ║
║   - GET    /v1/alerts             List alerts                  ║
║   - POST   /v1/alerts             Create alert                 ║
║   - GET    /v1/alerts/:id         Get alert                    ║
║   - PATCH  /v1/alerts/:id         Update alert                 ║
║   - DELETE /v1/alerts/:id         Delete alert                 ║
║   - POST   /v1/alerts/:id/test    Test notifications           ║
║   - GET    /v1/alerts/:id/triggers Get trigger history         ║
║                                                                ║
║   Channel Endpoints:                                           ║
║   - GET    /v1/channels           List channels                ║
║   - POST   /v1/channels           Create channel               ║
║   - GET    /v1/channels/:id       Get channel                  ║
║   - PATCH  /v1/channels/:id       Update channel               ║
║   - DELETE /v1/channels/:id       Delete channel               ║
║   - POST   /v1/channels/:id/test  Test channel                 ║
║                                                                ║
║   Monitoring Endpoints:                                        ║
║   - GET    /v1/monitoring/stats       Dashboard statistics     ║
║   - GET    /v1/monitoring/failure-rate Failure rate metrics    ║
║   - GET    /v1/monitoring/transactions Transaction list        ║
║   - GET    /v1/monitoring/transactions/:hash Transaction detail║
║   - GET    /v1/monitoring/events      Event stream             ║
║   - GET    /v1/monitoring/gas         Gas analytics            ║
║   - GET    /v1/monitoring/contracts   Watched contracts        ║
║   - POST   /v1/monitoring/contracts   Add watched contract     ║
║   - DELETE /v1/monitoring/contracts/:id Remove contract        ║
║                                                                ║
║   Web3 Actions Endpoints:                                      ║
║   - GET    /v1/actions/templates    List action templates      ║
║   - GET    /v1/actions/templates/:id Get template with code    ║
║   - GET    /v1/actions             List actions                ║
║   - POST   /v1/actions             Create action               ║
║   - GET    /v1/actions/:id         Get action                  ║
║   - PATCH  /v1/actions/:id         Update action               ║
║   - DELETE /v1/actions/:id         Delete action               ║
║   - POST   /v1/actions/:id/test    Test execute action (x402)  ║
║   - GET    /v1/actions/:id/executions Execution history        ║
║   - GET    /v1/actions/:id/secrets List secret names           ║
║   - POST   /v1/actions/:id/secrets Add/update secret           ║
║   - DELETE /v1/actions/:id/secrets/:name Delete secret         ║
║                                                                ║
║   x402 Payment Endpoints:                                      ║
║   - GET    /v1/payments            Payment history             ║
║   - GET    /v1/payments/stats      Payment statistics          ║
║   - GET    /v1/payments/usage      Current usage quota         ║
║   - GET    /v1/payments/pricing    Pricing configuration       ║
║                                                                ║
║   User Settings Endpoints:                                     ║
║   - GET    /v1/users/me            Get profile                 ║
║   - PATCH  /v1/users/me            Update profile              ║
║   - POST   /v1/users/me/wallet/disconnect Disconnect wallet    ║
║   - GET    /v1/users/me/preferences  Get notification prefs    ║
║   - PATCH  /v1/users/me/preferences  Update notification prefs ║
║                                                                ║
║   API Key Endpoints:                                           ║
║   - GET    /v1/api-keys            List API keys               ║
║   - POST   /v1/api-keys            Create API key              ║
║   - GET    /v1/api-keys/:id        Get API key                 ║
║   - DELETE /v1/api-keys/:id        Revoke API key              ║
║                                                                ║
║   Guardian Risk Analyzer (x402):                               ║
║   - POST   /v1/guardian/check      Analyze transaction (paid)  ║
║   - GET    /v1/guardian/check/:id  Get shared analysis         ║
║   - GET    /v1/guardian/patterns   List detection patterns     ║
║   - GET    /v1/guardian/demo       Demo transactions           ║
║                                                                ║
║   WebSocket: ws://localhost:${PORT}/ws/alerts                   ║
║   Health: GET /health                                          ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);

  // Start background services
  try {
    // Start schedule-triggered actions (cron jobs) for both networks
    console.log('[Startup] Starting action schedulers...');
    await startScheduler('mainnet');
    await startScheduler('testnet');
    const schedulerStats = getSchedulerStats();
    console.log(`[Startup] Schedulers started with ${schedulerStats.activeJobs} active jobs`);

    // Start event indexers for alerts and event-triggered actions
    console.log('[Startup] Starting event indexers...');
    await startAllIndexers();
    const indexerStatus = getAllIndexerStatus();
    console.log(`[Startup] Indexers started: ${indexerStatus.map(s => s.network).join(', ')}`);

    // Start balance checker for balance_threshold alerts (runs separately from event processing)
    console.log('[Startup] Starting balance checker...');
    startBalanceChecker();
    const balanceStatus = getBalanceCheckerStatus();
    console.log(`[Startup] Balance checker started (interval: ${balanceStatus.intervalMs}ms)`);

    console.log('[Startup] All background services started successfully');
  } catch (error) {
    console.error('[Startup] Error starting background services:', error);
    // Don't exit - API can still work, just without background processing
  }
});

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  console.log(`\n[Shutdown] Received ${signal}, gracefully shutting down...`);

  // Stop schedulers first (prevent new jobs from being queued)
  console.log('[Shutdown] Stopping schedulers...');
  stopScheduler();

  // Stop indexers
  console.log('[Shutdown] Stopping indexers...');
  stopAllIndexers();

  // Stop balance checker
  console.log('[Shutdown] Stopping balance checker...');
  stopBalanceChecker();

  // Close HTTP server
  server.close(() => {
    console.log('[Shutdown] HTTP server closed');
    process.exit(0);
  });

  // Force exit after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('[Shutdown] Forced exit after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
