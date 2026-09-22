import { NormalizedTransaction, SubscriptionDetection } from '../types/index.js';

/**
 * Detects recurring subscriptions from historical transactions.
 * Looks for recurring monthly charges with similar descriptions and amounts.
 */
export function detectSubscriptions(transactions: NormalizedTransaction[]): SubscriptionDetection[] {
  // Only consider debits / expenses
  const expenses = transactions.filter(t => t.amount < 0);

  // Group by clean merchant key
  const groups = new Map<string, NormalizedTransaction[]>();

  for (const tx of expenses) {
    // Generate grouping key from normalized description
    const key = getMerchantGroupKey(tx.description);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(tx);
  }

  const subscriptions: SubscriptionDetection[] = [];

  for (const [key, group] of groups.entries()) {
    // Need at least 2 occurrences to establish a recurring pattern
    if (group.length < 2) continue;

    // Sort chronologically ascending
    group.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Check day intervals between consecutive charges
    const intervals: number[] = [];
    let amountsConsistent = true;
    const firstAmount = Math.abs(group[0].amount);

    for (let i = 1; i < group.length; i++) {
      const prevDate = new Date(group[i - 1].date);
      const currDate = new Date(group[i].date);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(diffDays);

      const currAmount = Math.abs(group[i].amount);
      const diffAmount = Math.abs(currAmount - firstAmount);
      // Allow max $2.00 or 10% variation (e.g. tax variations)
      if (diffAmount > 2.0 && diffAmount / firstAmount > 0.1) {
        amountsConsistent = false;
      }
    }

    if (!amountsConsistent) continue;

    // Check if intervals correspond to monthly cadence (~27 to 34 days)
    const monthlyMatches = intervals.filter(d => d >= 26 && d <= 35);

    // If at least half of the intervals match monthly cadence (or if 2 charges are ~1 month apart)
    if (monthlyMatches.length >= Math.ceil(intervals.length * 0.5)) {
      const totalAmount = group.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const avgAmount = Math.round((totalAmount / group.length) * 100) / 100;
      const lastTx = group[group.length - 1];

      // Estimate next renewal date (lastDate + average interval or ~30 days)
      const lastDateObj = new Date(lastTx.date);
      const nextDateObj = new Date(lastDateObj);
      nextDateObj.setDate(nextDateObj.getDate() + 30);
      const nextEstimatedDate = nextDateObj.toISOString().split('T')[0];

      subscriptions.push({
        merchant: formatMerchantName(group[0].description),
        category: lastTx.categoryName || 'Subscriptions & Entertainment',
        averageAmount: avgAmount,
        frequency: 'monthly',
        lastDate: lastTx.date,
        nextEstimatedDate,
        occurrences: group.length,
        transactions: group,
      });
    }
  }

  // Sort by average amount descending (largest recurring costs first)
  return subscriptions.sort((a, b) => b.averageAmount - a.averageAmount);
}

function getMerchantGroupKey(description: string): string {
  return description
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 12);
}

function formatMerchantName(description: string): string {
  let name = description.replace(/^(SQ \*|TST\*|PAYPAL \*)/i, '').trim();
  // Capitalize nicely
  return name.charAt(0).toUpperCase() + name.slice(1);
}
