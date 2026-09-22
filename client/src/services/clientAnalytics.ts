import {
  Budget,
  CashFlowSummary,
  CategoryBreakdownItem,
  SubscriptionItem,
  Transaction,
  TrendItem,
} from '../types.js';

export const clientAnalytics = {
  /**
   * Calculate Cash Flow Summary for a given statement period (e.g. '2026-09')
   */
  calculateSummary(transactions: Transaction[], period?: string): CashFlowSummary {
    const filtered = period
      ? transactions.filter((t) => t.date.startsWith(period))
      : transactions;

    let totalIncome = 0;
    let totalExpenses = 0;

    for (const tx of filtered) {
      if (tx.amount > 0 || tx.type === 'credit') {
        totalIncome += Math.abs(tx.amount);
      } else {
        totalExpenses += Math.abs(tx.amount);
      }
    }

    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    return {
      period: period || 'All Time',
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netSavings: Math.round(netSavings * 100) / 100,
      savingsRate: Math.round(savingsRate * 10) / 10,
      transactionCount: filtered.length,
    };
  },

  /**
   * Calculate breakdown by category for expenses in a period
   */
  calculateCategoryBreakdown(
    transactions: Transaction[],
    period?: string
  ): { period: string; totalSpent: number; breakdown: CategoryBreakdownItem[] } {
    const expenses = transactions.filter(
      (t) => (t.amount < 0 || t.type === 'debit') && (!period || t.date.startsWith(period))
    );

    const totalSpent = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const categoryMap = new Map<number, { name: string; color: string; icon: string; total: number; count: number }>();

    for (const tx of expenses) {
      const catId = tx.category_id || 999;
      const catName = tx.category_name || 'Uncategorized';
      const catColor = tx.category_color || '#9fe870';
      const catIcon = tx.category_icon || 'tag';

      const existing = categoryMap.get(catId) || {
        name: catName,
        color: catColor,
        icon: catIcon,
        total: 0,
        count: 0,
      };

      existing.total += Math.abs(tx.amount);
      existing.count += 1;
      categoryMap.set(catId, existing);
    }

    const breakdown: CategoryBreakdownItem[] = Array.from(categoryMap.entries())
      .map(([id, data]) => ({
        categoryId: id,
        categoryName: data.name,
        color: data.color,
        icon: data.icon,
        totalAmount: Math.round(data.total * 100) / 100,
        transactionCount: data.count,
        percentage: totalSpent > 0 ? Math.round((data.total / totalSpent) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      period: period || 'All Time',
      totalSpent: Math.round(totalSpent * 100) / 100,
      breakdown,
    };
  },

  /**
   * Calculate monthly income, expenses, and net trends over the last N months
   */
  calculateTrends(transactions: Transaction[], monthsCount = 6): TrendItem[] {
    const monthlyData = new Map<string, { income: number; expenses: number }>();

    // Generate month buckets
    const now = new Date();
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7); // 'YYYY-MM'
      monthlyData.set(key, { income: 0, expenses: 0 });
    }

    for (const tx of transactions) {
      const monthKey = tx.date.slice(0, 7);
      if (monthlyData.has(monthKey)) {
        const item = monthlyData.get(monthKey)!;
        if (tx.amount > 0 || tx.type === 'credit') {
          item.income += Math.abs(tx.amount);
        } else {
          item.expenses += Math.abs(tx.amount);
        }
      }
    }

    return Array.from(monthlyData.entries()).map(([period, data]) => ({
      period,
      income: Math.round(data.income * 100) / 100,
      expenses: Math.round(data.expenses * 100) / 100,
      net: Math.round((data.income - data.expenses) * 100) / 100,
    }));
  },

  /**
   * Detect recurring subscriptions from transaction patterns
   */
  detectSubscriptions(transactions: Transaction[]): {
    subscriptions: SubscriptionItem[];
    monthlyTotal: number;
    annualProjected: number;
    count: number;
  } {
    // Group expense transactions by clean merchant identifier
    const merchantMap = new Map<string, Transaction[]>();

    for (const tx of transactions) {
      if (tx.amount < 0 || tx.type === 'debit') {
        const cleanMerchant = tx.description
          .toUpperCase()
          .replace(/[0-9*#\-]/g, '')
          .trim()
          .slice(0, 20);

        if (cleanMerchant.length >= 3) {
          const list = merchantMap.get(cleanMerchant) || [];
          list.push(tx);
          merchantMap.set(cleanMerchant, list);
        }
      }
    }

    const subscriptions: SubscriptionItem[] = [];
    let monthlyTotal = 0;

    for (const [merchant, txs] of merchantMap.entries()) {
      // Known subscription keyword hints or >= 2 recurring charges
      const isKnownService = /(NETFLIX|SPOTIFY|APPLE|PRIME|AMZN|GITHUB|YOUTUBE|HBO|DISNEY|GYM|SUBWAY|NYTIMES|CHATGPT)/i.test(
        merchant
      );

      if (txs.length >= 2 || isKnownService) {
        // Sort descending by date
        txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const avgAmount =
          txs.reduce((sum, t) => sum + Math.abs(t.amount), 0) / txs.length;

        // Estimate next renewal: ~30 days after last date
        const lastTxDate = new Date(txs[0].date);
        const nextEstimated = new Date(lastTxDate);
        nextEstimated.setDate(nextEstimated.getDate() + 30);

        const sub: SubscriptionItem = {
          merchant: txs[0].description,
          category: txs[0].category_name || 'Subscriptions',
          averageAmount: Math.round(avgAmount * 100) / 100,
          frequency: 'monthly',
          lastDate: txs[0].date,
          nextEstimatedDate: nextEstimated.toISOString().slice(0, 10),
          occurrences: txs.length,
          transactions: txs.slice(0, 5),
        };

        subscriptions.push(sub);
        monthlyTotal += avgAmount;
      }
    }

    subscriptions.sort((a, b) => b.averageAmount - a.averageAmount);

    return {
      subscriptions,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      annualProjected: Math.round(monthlyTotal * 12 * 100) / 100,
      count: subscriptions.length,
    };
  },

  /**
   * Calculate budget progress against spending
   */
  calculateBudgetProgress(
    budgets: Budget[],
    transactions: Transaction[],
    period?: string
  ): {
    budgets: Budget[];
    totalBudget: number;
    totalSpent: number;
    overallPercentage: number;
  } {
    const expenses = transactions.filter(
      (t) => (t.amount < 0 || t.type === 'debit') && (!period || t.date.startsWith(period))
    );

    let totalBudget = 0;
    let totalSpent = 0;

    const updatedBudgets = budgets.map((b) => {
      const categorySpent = expenses
        .filter((t) => t.category_id === b.categoryId)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const remaining = Math.max(0, b.budgetAmount - categorySpent);
      const percentage = b.budgetAmount > 0 ? (categorySpent / b.budgetAmount) * 100 : 0;
      let status: 'good' | 'warning' | 'exceeded' = 'good';
      if (percentage >= 100) status = 'exceeded';
      else if (percentage >= 80) status = 'warning';

      totalBudget += b.budgetAmount;
      totalSpent += categorySpent;

      return {
        ...b,
        spent: Math.round(categorySpent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        percentage: Math.round(percentage),
        status,
      };
    });

    const overallPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    return {
      budgets: updatedBudgets,
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      overallPercentage,
    };
  },
};
