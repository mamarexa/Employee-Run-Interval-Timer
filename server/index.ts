import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db';
import { seedIfEmpty } from './seed';
import authRoutes from './routes/auth';
import programRoutes from './routes/programs';
import userRoutes from './routes/users';
import adminRoutes from './routes/admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/me', userRoutes);
app.use('/api/admin', adminRoutes);

// Serve Vite build static files
const distDir = path.resolve(__dirname, '../../dist');
app.use(express.static(distDir));

// SPA fallback — serve index.html for all non-API routes
app.get(/^(?!\/api).*$/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

async function main() {
  // Wait for DB connection
  let retries = 10;
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      console.log('[db] Connected to PostgreSQL.');
      break;
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      console.log(`[db] Waiting for database... (${retries} retries left)`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Run schema migrations
  const schema = await import('fs').then(fs =>
    fs.readFileSync(path.resolve(__dirname, '../../schema.sql'), 'utf8')
  );
  await pool.query(schema);
  console.log('[db] Schema applied.');

  // Seed initial data
  await seedIfEmpty();

  app.listen(PORT, () => {
    console.log(`[server] MonCivique Run listening on port ${PORT}`);
  });
}

main().catch(err => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
