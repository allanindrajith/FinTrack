import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase, db } from './db/database.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import accountsRouter from './routes/accounts.js';
import categoriesRouter from './routes/categories.js';
import transactionsRouter from './routes/transactions.js';
import analyticsRouter from './routes/analytics.js';
import budgetsRouter from './routes/budgets.js';
import aiRouter from './routes/ai.js';
import jobsRouter from './routes/jobs.js';
import { startRetentionCron } from './jobs/retentionCleaner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// 1. Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com https://appleid.cdn-apple.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://generativelanguage.googleapis.com https://api.openai.com https://api.anthropic.com https://oauth2.googleapis.com; frame-src https://accounts.google.com https://appleid.apple.com; frame-ancestors 'none';"
  );
  next();
});

// 2. CORS Configuration with credentials
const extraAllowed = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server / curl (no origin), localhost, 127.0.0.1, Firebase Hosting, and configured origins
    if (
      !origin ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin.endsWith('.web.app') ||
      origin.endsWith('.firebaseapp.com') ||
      extraAllowed.includes(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error(`Cross-Origin Request Blocked by FinTrack CORS Policy: ${origin}`));
    }
  },
  credentials: true,
}));

app.use(cookieParser(process.env.COOKIE_SECRET || 'fintrack_cookie_secret_2026'));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// 3. Lightweight In-Memory Rate Limiter for Auth Routes
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitRecord>();

function authRateLimiter(windowMs = 15 * 60 * 1000, maxRequests = 30) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'global';
    const now = Date.now();
    const record = rateLimitStore.get(ip);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      res.status(429).json({ error: 'Too many authentication attempts. Please try again later.' });
      return;
    }

    record.count++;
    next();
  };
}

// Initialize DB schema asynchronously
initDatabase().then(() => {
  // Start background retention & hard-delete cron
  startRetentionCron(12);
}).catch((err) => {
  console.error('Fatal database initialization failure:', err);
});

// API Routes
app.use('/api/auth', authRateLimiter(), authRouter);
app.use('/api/users', usersRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/jobs', jobsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), app: 'FinTrack', postgres: db.isPostgres });
});

// Dedicated 404 Handler for /api/*
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint ${req.method} ${req.path} not found` });
});

// Serve frontend in production if client/dist exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'Internal server error occurred' });
});

const HOST = process.env.HOST || '0.0.0.0';

app.listen(Number(PORT), HOST, () => {
  console.log(`🚀 FinTrack Server running on http://${HOST}:${PORT}`);
});

export default app;
