import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { configurePassport } from './config/passport.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

configurePassport();

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { apiRouter } from './routes/index.js';
app.use('/api', apiRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
