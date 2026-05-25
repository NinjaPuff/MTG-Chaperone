import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import passport from 'passport';
import type { AppDeps } from './di/types.js';
import { createApiRouter } from './routes/index.js';

function resolveClientDistPath() {
  if (process.env.CLIENT_DIST_PATH) {
    return process.env.CLIENT_DIST_PATH;
  }

  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
}

export function createApp(deps: AppDeps) {
  const app = express();

  app.use(
    cors({
      origin: deps.config.clientUrl,
      credentials: true,
    }),
  );
  app.use(express.json());

  deps.services.configurePassport();
  app.use(passport.initialize());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: deps.clock.now().toISOString() });
  });

  app.use('/api', createApiRouter(deps));

  if (deps.config.nodeEnv === 'production') {
    const clientDistPath = resolveClientDistPath();
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }

      res.sendFile(path.join(clientDistPath, 'index.html'), (error) => {
        if (error) {
          next(error);
        }
      });
    });
  }

  app.use(deps.services.errorHandler);

  return app;
}
