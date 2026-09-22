import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { AuthRequest, requireAuth } from './auth.js';
import { detectSubscriptions } from '../engine/subscriptions.js';
import { NormalizedTransaction } from '../types/index.js';

const router = Router();

// Helper to format default current period as YYYY-MM
function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

// GET /api/analytics/summary - Income, Expense, Net, Savings Rate
router.get('/summary', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const period = (req.query.period as string) || getCurrentPeriod();
    const accountId = req.query.accountId as string;

    let query = `
      SELECT 
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_expenses,
        COUNT(*) as count
      FROM transactions
      WHERE user_id = $1 AND SUBSTR(date, 1, 7) = $2 AND deleted_at IS NULL
    `;
    const params: any[] = [userId, period];

    if (accountId) {
      query += ' AND account_id = $3';
      params.push(accountId);
    }

    const row = (await db.queryOne<{ total_income: number; total_expenses: number; count: number }>(query, params)) || {
      total_income: 0,
      total_expenses: 0,
      count: 0,
    };

    const totalIncome = Math.round(Number(row.total_income) * 100) / 100;
    const totalExpenses = Math.round(Number(row.total_expenses) * 100) / 100;
    const netSavings = Math.round((totalIncome - totalExpenses) * 100) / 100;
    const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 1000) / 10 : 0;

    res.json({
      period,
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate,
      transactionCount: Number(row.count),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compute summary' });
  }
});

// GET /api/analytics/category-breakdown - Spending by category for Donut/Pie Chart
router.get('/category-breakdown', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const period = (req.query.period as string) || getCurrentPeriod();
    const accountId = req.query.accountId as string;

    let query = `
      SELECT 
        COALESCE(c.id, 0) as category_id,
        COALESCE(c.name, 'Uncategorized') as category_name,
        COALESCE(c.color, '#94a3b8') as color,
        COALESCE(c.icon, 'HelpCircle') as icon,
        SUM(ABS(t.amount)) as total_amount,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1 AND t.amount < 0 AND SUBSTR(t.date, 1, 7) = $2 AND t.deleted_at IS NULL
    `;
    const params: any[] = [userId, period];

    if (accountId) {
      query += ' AND t.account_id = $3';
      params.push(accountId);
    }

    query += ' GROUP BY c.id, c.name, c.color, c.icon ORDER BY total_amount DESC';

    const rows = await db.query<any>(query, params);
    const grandTotal = rows.reduce((acc, r) => acc + Number(r.total_amount || 0), 0);

    const breakdown = rows.map(r => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      color: r.color,
      icon: r.icon,
      totalAmount: Math.round(Number(r.total_amount) * 100) / 100,
      transactionCount: Number(r.count),
      percentage: grandTotal > 0 ? Math.round((Number(r.total_amount) / grandTotal) * 1000) / 10 : 0,
    }));

    res.json({
      period,
      totalSpent: Math.round(grandTotal * 100) / 100,
      breakdown,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compute breakdown' });
  }
});

// GET /api/analytics/trends - Multi-month trends (Income vs Expenses over 6-12 months)
router.get('/trends', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const months = parseInt((req.query.months as string) || '6', 10);
    const accountId = req.query.accountId as string;

    let query = `
      SELECT 
        SUBSTR(date, 1, 7) as period,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses
      FROM transactions
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    const params: any[] = [userId];

    if (accountId) {
      query += ' AND account_id = $2';
      params.push(accountId);
    }

    query += `
      GROUP BY SUBSTR(date, 1, 7)
      ORDER BY period DESC
      LIMIT ${Number(months)}
    `;

    const rows = (await db.query<any>(query, params)).reverse();

    const trends = rows.map(r => ({
      period: r.period,
      income: Math.round(Number(r.income) * 100) / 100,
      expenses: Math.round(Number(r.expenses) * 100) / 100,
      net: Math.round((Number(r.income) - Number(r.expenses)) * 100) / 100,
    }));

    res.json({ trends });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compute trends' });
  }
});

// GET /api/analytics/subscriptions - Recurring subscription detector
router.get('/subscriptions', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const accountId = req.query.accountId as string;

    let query = `
      SELECT t.*, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1 AND t.amount < 0 AND t.deleted_at IS NULL
    `;
    const params: any[] = [userId];

    if (accountId) {
      query += ' AND t.account_id = $2';
      params.push(accountId);
    }

    query += ' ORDER BY t.date ASC';

    const rows = await db.query<any>(query, params);

    const transactions: NormalizedTransaction[] = rows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      date: r.date,
      description: r.description || '',
      originalDescription: r.original_description || '',
      amount: Number(r.amount),
      type: r.type,
      categoryId: r.category_id,
      categoryName: r.category_name,
      hash: r.hash,
    }));

    const subscriptions = detectSubscriptions(transactions);
    const monthlyTotal = subscriptions.reduce((sum, s) => sum + s.averageAmount, 0);

    res.json({
      subscriptions,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      annualProjected: Math.round(monthlyTotal * 12 * 100) / 100,
      count: subscriptions.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to detect subscriptions' });
  }
});

export default router;
