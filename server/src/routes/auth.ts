import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fintrack_super_secret_jwt_key_2026';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For seamless demo access, default to demo user if no token provided
    const demoUser = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get('demo@fintrack.app') as any;
    if (demoUser) {
      req.user = demoUser;
      return next();
    }
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; name: string };
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
      name,
      email.toLowerCase().trim(),
      passwordHash
    );

    const userId = Number(result.lastInsertRowid);

    // Create default accounts
    const insertAcc = db.prepare('INSERT INTO accounts (id, user_id, name, type, currency, institution) VALUES (?, ?, ?, ?, ?, ?)');
    insertAcc.run(`acc_${userId}_checking`, userId, 'Checking Account', 'checking', 'USD', 'Primary Bank');
    insertAcc.run(`acc_${userId}_credit`, userId, 'Credit Card', 'credit', 'USD', 'Primary Card');

    const token = jwt.sign({ id: userId, email, name }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      user: { id: userId, email, name },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const user = db.prepare('SELECT id, email, password_hash, name FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any;
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
