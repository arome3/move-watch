import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import simulateRouter from './routes/simulate.js';
import alertsRouter from './routes/alerts.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());

// CORS - allow frontend origin
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Request logging
app.use(morgan('dev'));

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// API routes
app.use('/v1', simulateRouter);
app.use('/v1/alerts', alertsRouter);

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

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   MoveWatch API Server                                     ║
║   Running on http://localhost:${PORT}                       ║
║                                                            ║
║   Simulation Endpoints:                                    ║
║   - POST /v1/simulate         Simulate transaction         ║
║   - GET  /v1/sim/:id          Get shared simulation        ║
║                                                            ║
║   Alert Endpoints:                                         ║
║   - GET    /v1/alerts         List alerts                  ║
║   - POST   /v1/alerts         Create alert                 ║
║   - GET    /v1/alerts/:id     Get alert                    ║
║   - PATCH  /v1/alerts/:id     Update alert                 ║
║   - DELETE /v1/alerts/:id     Delete alert                 ║
║   - POST   /v1/alerts/:id/test    Test notifications       ║
║   - GET    /v1/alerts/:id/triggers Get trigger history     ║
║                                                            ║
║   Health: GET /health                                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
