import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { AuthRequest, requireAuth } from './auth.js';

const router = Router();

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

// GET /api/budgets - List target category budgets for period
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const period = (req.query.period as string) || getCurrentPeriod();

  try {
    const rows = await db.query(
      `SELECT b.id, b.category_id, b.amount, b.period,
              c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       WHERE b.user_id = $1 AND b.period = $2
       ORDER BY b.amount DESC`,
      [userId, period]
    );

    const formatted = rows.map((b) => ({
      id: b.id,
      categoryId: b.category_id,
      categoryName: b.category_name,
      categoryColor: b.category_color,
      categoryIcon: b.category_icon,
      budgetAmount: Number(b.amount),
      spent: 0,
      remaining: Number(b.amount),
      percentage: 0,
      status: 'good',
      period: b.period,
    }));

    const totalBudget = formatted.reduce((sum, b) => sum + b.budgetAmount, 0);

    res.json({
      period,
      totalBudget,
      totalSpent: 0,
      overallPercentage: 0,
      budgets: formatted,
    });
  } catch (err) {
    console.error('Fetch budgets error:', err);
    res.status(500).json({ error: 'Failed to retrieve budgets' });
  }
});

// POST /api/budgets - Set or update budget
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { categoryId, amount, period = getCurrentPeriod() } = req.body;

  if (!categoryId || amount === undefined) {
    res.status(400).json({ error: 'Category ID and amount are required' });
    return;
  }

  try {
    const numAmount = parseFloat(amount);

    if (db.isPostgres) {
      await db.execute(
        `INSERT INTO budgets (user_id, category_id, amount, period)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, category_id, period) DO UPDATE SET
           amount = EXCLUDED.amount`,
        [userId, categoryId, numAmount, period]
      );
    } else {
      await db.execute(
        `INSERT INTO budgets (user_id, category_id, amount, period)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, category_id, period) DO UPDATE SET
           amount = excluded.amount`,
        [userId, categoryId, numAmount, period]
      );
    }

    res.status(200).json({ success: true, message: 'Budget saved' });
  } catch (err) {
    console.error('Save budget error:', err);
    res.status(500).json({ error: 'Failed to save budget' });
  }
});

// DELETE /api/budgets/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    await db.execute('DELETE FROM budgets WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ success: true, message: 'Budget removed' });
  } catch (err) {
    console.error('Delete budget error:', err);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

export default router;
