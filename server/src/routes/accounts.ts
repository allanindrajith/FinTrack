import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { AuthRequest, requireAuth } from './auth.js';

const router = Router();

// GET /api/accounts - List user's accounts
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  try {
    const accounts = await db.query(
      `SELECT a.*, 
              COUNT(t.id) as transaction_count
       FROM accounts a
       LEFT JOIN transactions t ON a.id = t.account_id AND t.user_id = a.user_id AND t.deleted_at IS NULL
       WHERE a.user_id = $1
       GROUP BY a.id, a.user_id, a.name, a.type, a.currency, a.institution, a.created_at
       ORDER BY a.created_at ASC`,
      [userId]
    );

    res.json({ accounts });
  } catch (err) {
    console.error('Fetch accounts error:', err);
    res.status(500).json({ error: 'Failed to retrieve accounts' });
  }
});

// POST /api/accounts - Create new account
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { name, type, currency = 'USD', institution = '' } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: 'Name and type are required' });
    return;
  }

  const id = `acc_${userId}_${Date.now()}`;
  try {
    await db.execute(
      `INSERT INTO accounts (id, user_id, name, type, currency, institution)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, userId, name.trim(), type, currency, institution.trim()]
    );

    const newAccount = await db.queryOne('SELECT * FROM accounts WHERE id = $1', [id]);
    res.status(201).json({ account: newAccount });
  } catch (err) {
    console.error('Create account error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// DELETE /api/accounts/:id - Delete account
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    await db.execute('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
