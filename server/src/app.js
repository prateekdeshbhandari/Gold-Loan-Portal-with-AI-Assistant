import express from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import loanSchemesRouter from './routes/loanSchemesRouter.js';
import quotesRouter from './routes/quotesRouter.js';
import leadsRouter from './routes/leadsRouter.js';
import chatRouter from './routes/chatRouter.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
  }));
  app.use(express.json());
  app.use(requestLogger);

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/v1/loan-schemes', loanSchemesRouter);
  app.use('/api/v1/quotes', quotesRouter);
  app.use('/api/v1/leads', leadsRouter);
  app.use('/api/v1/chat', chatRouter);

  // 404 handler
  app.use('*', (req, res, next) => {
    next(new AppError(`Endpoint ${req.originalUrl} not found`, 404, 'NOT_FOUND'));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
