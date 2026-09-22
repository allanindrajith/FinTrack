import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { AuthRequest, requireAuth } from './auth.js';

const router = Router();

// GET /api/accounts - List user's accounts
router.get('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const accounts = db.prepare(`
    SELECT a.*, 
           COUNT(t.id) as transaction_count,
           COALESCE(SUM(t.amount), 0) as balance_calculated
    FROM accounts a
    LEFT JOIN transactions t ON a.id = t.account_id AND t.user_id = a.user_id
    WHERE a.user_id = ?
    GROUP BY a.id
    ORDER BY a.created_at ASC
  `).all(userId);

  res.json({ accounts });
});

// POST /api/accounts - Create new account
router.post('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { name, type, currency = 'USD', institution = '' } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: 'Name and type are required' });
    return;
  }

  const id = `acc_${userId}_${Date.now()}`;
  db.prepare(`
    INSERT INTO accounts (id, user_id, name, type, currency, institution)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, name.trim(), type, currency, institution.trim());

  const newAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  res.status(201).json({ account: newAccount });
});

// DELETE /api/accounts/:id - Delete account
router.delete('/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { id } = req.params;

  db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(id, userId);
  res.json({ success: true, message: 'Account deleted' });
});

export default router;
