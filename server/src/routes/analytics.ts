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
router.get('/summary', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const period = (req.query.period as string) || getCurrentPeriod();
  const accountId = req.query.accountId as string;

  let query = `
    SELECT 
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_expenses,
      COUNT(*) as count
    FROM transactions
    WHERE user_id = ? AND strftime('%Y-%m', date) = ?
  `;
  const params: any[] = [userId, period];

  if (accountId) {
    query += ' AND account_id = ?';
    params.push(accountId);
  }

  const row = db.prepare(query).get(...params) as { total_income: number; total_expenses: number; count: number };

  const totalIncome = Math.round(row.total_income * 100) / 100;
  const totalExpenses = Math.round(row.total_expenses * 100) / 100;
  const netSavings = Math.round((totalIncome - totalExpenses) * 100) / 100;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 1000) / 10 : 0;

  res.json({
    period,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    transactionCount: row.count,
  });
});

// GET /api/analytics/category-breakdown - Spending by category for Donut/Pie Chart
router.get('/category-breakdown', requireAuth, (req: AuthRequest, res: Response): void => {
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
    WHERE t.user_id = ? AND t.amount < 0 AND strftime('%Y-%m', t.date) = ?
  `;
  const params: any[] = [userId, period];

  if (accountId) {
    query += ' AND t.account_id = ?';
    params.push(accountId);
  }

  query += ' GROUP BY c.id ORDER BY total_amount DESC';

  const rows = db.prepare(query).all(...params) as any[];

  const grandTotal = rows.reduce((acc, r) => acc + r.total_amount, 0);

  const breakdown = rows.map(r => ({
    categoryId: r.category_id,
    categoryName: r.category_name,
    color: r.color,
    icon: r.icon,
    totalAmount: Math.round(r.total_amount * 100) / 100,
    transactionCount: r.count,
    percentage: grandTotal > 0 ? Math.round((r.total_amount / grandTotal) * 1000) / 10 : 0,
  }));

  res.json({
    period,
    totalSpent: Math.round(grandTotal * 100) / 100,
    breakdown,
  });
});

// GET /api/analytics/trends - Multi-month trends (Income vs Expenses over 6-12 months)
router.get('/trends', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const months = parseInt((req.query.months as string) || '6', 10);
  const accountId = req.query.accountId as string;

  let query = `
    SELECT 
      strftime('%Y-%m', date) as period,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses
    FROM transactions
    WHERE user_id = ?
  `;
  const params: any[] = [userId];

  if (accountId) {
    query += ' AND account_id = ?';
    params.push(accountId);
  }

  query += `
    GROUP BY strftime('%Y-%m', date)
    ORDER BY period DESC
    LIMIT ?
  `;
  params.push(months);

  const rows = (db.prepare(query).all(...params) as any[]).reverse();

  const trends = rows.map(r => ({
    period: r.period,
    income: Math.round(r.income * 100) / 100,
    expenses: Math.round(r.expenses * 100) / 100,
    net: Math.round((r.income - r.expenses) * 100) / 100,
  }));

  res.json({ trends });
});

// GET /api/analytics/subscriptions - Recurring subscription detector
router.get('/subscriptions', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const accountId = req.query.accountId as string;

  let query = `
    SELECT t.*, c.name as category_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.amount < 0
  `;
  const params: any[] = [userId];

  if (accountId) {
    query += ' AND t.account_id = ?';
    params.push(accountId);
  }

  query += ' ORDER BY t.date ASC';

  const rows = db.prepare(query).all(...params) as any[];

  const transactions: NormalizedTransaction[] = rows.map(r => ({
    id: r.id,
    accountId: r.account_id,
    date: r.date,
    description: r.description,
    originalDescription: r.original_description,
    amount: r.amount,
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
});

export default router;
