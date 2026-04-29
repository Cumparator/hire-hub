// backend/src/index.js

import express from 'express';
import { initDb } from './db/connection.js';
import { registerRoutes } from './api/routes.js';
import { startCronJobs } from './cron.js';

const PORT = process.env.PORT || 4000;

// Минимальный inline cookie-parser (не тащим зависимость)
function cookieParser(req, _res, next) {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach(pair => {
      const [key, ...rest] = pair.trim().split('=');
      req.cookies[key.trim()] = decodeURIComponent(rest.join('='));
    });
  }
  next();
}

async function main() {
  await initDb();
  console.log('✓ Database connected');

  const app = express();
  app.use(express.json());
  app.use(cookieParser);

  // CORS
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin',  process.env.CORS_ORIGIN || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-User-Id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  registerRoutes(app);

  startCronJobs();
  console.log('✓ CRON jobs scheduled');

  app.listen(PORT, () => {
    console.log(`✓ Server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
