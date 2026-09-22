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

// GET /api/budgets - Get budgets vs actual spending for period
router.get('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const period = (req.query.period as string) || getCurrentPeriod();

  const budgets = db.prepare(`
    SELECT b.id, b.category_id, b.amount, b.period,
           c.name as category_name, c.color as category_color, c.icon as category_icon,
           COALESCE(spent.total_spent, 0) as spent
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN (
      SELECT category_id, SUM(ABS(amount)) as total_spent
      FROM transactions
      WHERE user_id = ? AND amount < 0 AND strftime('%Y-%m', date) = ?
      GROUP BY category_id
    ) spent ON b.category_id = spent.category_id
    WHERE b.user_id = ? AND b.period = ?
    ORDER BY b.amount DESC
  `).all(userId, period, userId, period) as any[];

  const formatted = budgets.map(b => {
    const spent = Math.round(b.spent * 100) / 100;
    const amount = Math.round(b.amount * 100) / 100;
    const remaining = Math.round((amount - spent) * 100) / 100;
    const percentage = amount > 0 ? Math.round((spent / amount) * 1000) / 10 : 0;
    const status = percentage > 100 ? 'exceeded' : percentage >= 85 ? 'warning' : 'good';

    return {
      id: b.id,
      categoryId: b.category_id,
      categoryName: b.category_name,
      categoryColor: b.category_color,
      categoryIcon: b.category_icon,
      budgetAmount: amount,
      spent,
      remaining,
      percentage,
      status,
      period: b.period,
    };
  });

  const totalBudget = formatted.reduce((sum, b) => sum + b.budgetAmount, 0);
  const totalSpent = formatted.reduce((sum, b) => sum + b.spent, 0);

  res.json({
    period,
    totalBudget: Math.round(totalBudget * 100) / 100,
    totalSpent: Math.round(totalSpent * 100) / 100,
    overallPercentage: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0,
    budgets: formatted,
  });
});

// POST /api/budgets - Set or update budget
router.post('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { categoryId, amount, period = getCurrentPeriod() } = req.body;

  if (!categoryId || amount === undefined) {
    res.status(400).json({ error: 'Category ID and amount are required' });
    return;
  }

  db.prepare(`
    INSERT INTO budgets (user_id, category_id, amount, period)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, category_id, period) DO UPDATE SET
      amount = excluded.amount
  `).run(userId, categoryId, parseFloat(amount), period);

  res.status(200).json({ success: true, message: 'Budget saved' });
});

// DELETE /api/budgets/:id
router.delete('/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { id } = req.params;

  db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(id, userId);
  res.json({ success: true, message: 'Budget removed' });
});

export default router;
