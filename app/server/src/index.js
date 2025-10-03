import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { getPool } from './db.js';
import { initializeDatabase } from './initDb.js';
import healthRouter from './routes/health.js';
import profilesRouter from './routes/profiles.js';
import planRouter from './routes/plan.js';
import sessionsRouter from './routes/sessions.js';
import statsRouter from './routes/stats.js';
import exercisesRouter from './routes/exercises.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN, credentials: false }));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/exercises', exercisesRouter);
app.use('/api/plan', planRouter);
app.use('/api', sessionsRouter);
app.use('/api/stats', statsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function bootstrap() {
  try {
    await initializeDatabase();
    await getPool().query('SELECT 1');
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

bootstrap();
