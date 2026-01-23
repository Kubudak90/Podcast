import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import roomsRoutes from './routes/rooms.js';
import recordingsRoutes from './routes/recordings.js';
import livekitRoutes from './routes/livekit.js';
import chatRoutes from './routes/chat.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { logError } from './lib/logger.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json());

  // Apply rate limiting to all API routes (skip in test)
  if (process.env.NODE_ENV !== 'test') {
    app.use('/api', apiLimiter);
  }

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomsRoutes);
  app.use('/api/recordings', recordingsRoutes);
  app.use('/api', recordingsRoutes); // For /api/rooms/:slug/recordings path
  app.use('/api', chatRoutes); // For /api/rooms/:slug/chat path
  app.use('/api/livekit', livekitRoutes);

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logError(err, { path: req.path, method: req.method });
    res.status(500).json({ message: 'Internal server error' });
  });

  return app;
}
