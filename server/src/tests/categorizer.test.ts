import { describe, it, expect } from 'vitest';
import { categorizeTransaction, DEFAULT_CATEGORIES } from '../engine/categorizer.js';
import { detectSubscriptions } from '../engine/subscriptions.js';
import { Category, CategoryRule, NormalizedTransaction } from '../types/index.js';

describe('Categorizer Engine', () => {
  const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: i + 1 }));

  it('correctly auto-categorizes common merchants using default rules', () => {
    expect(categorizeTransaction('UBER *TRIP 1234', [], categories).categoryName).toBe('Transport & Fuel');
    expect(categorizeTransaction('WHOLEFDS SOMA', [], categories).categoryName).toBe('Groceries');
    expect(categorizeTransaction('NETFLIX.COM', [], categories).categoryName).toBe('Subscriptions & Entertainment');
    expect(categorizeTransaction('STARBUCKS STORE 4921', [], categories).categoryName).toBe('Dining & Drinks');
    expect(categorizeTransaction('PAYROLL DIRECT DEP ACME CORP', [], categories).categoryName).toBe('Income & Salary');
    expect(categorizeTransaction('PG&E ELECTRIC UTILITY', [], categories).categoryName).toBe('Housing & Utilities');
  });

  it('prioritizes user custom rules over default rules', () => {
    // Override Starbucks to 'Work Expense' or custom category
    const customRules: CategoryRule[] = [
      {
        id: 1,
        categoryId: 6, // Shopping
        categoryName: 'Shopping',
        matchType: 'contains',
        pattern: 'STARBUCKS',
        priority: 100, // higher priority
      },
    ];

    const result = categorizeTransaction('STARBUCKS COFFEE', customRules, categories);
    expect(result.categoryName).toBe('Shopping');
    expect(result.categoryId).toBe(6);
  });

  it('falls back to Other / Uncategorized for unknown descriptions', () => {
    const result = categorizeTransaction('XYZ UNKNOWN CORP 99999', [], categories);
    expect(result.categoryName).toBe('Other / Uncategorized');
  });
});

describe('Subscription Detection Engine', () => {
  it('detects monthly recurring charges with similar amounts and cadence', () => {
    const sampleTxs: NormalizedTransaction[] = [
      {
        accountId: 'acc1',
        date: '2026-06-15',
        description: 'Netflix.com',
        originalDescription: 'Netflix.com',
        amount: -19.99,
        type: 'debit',
        hash: 'h1',
      },
      {
        accountId: 'acc1',
        date: '2026-07-15',
        description: 'Netflix.com',
        originalDescription: 'Netflix.com',
        amount: -19.99,
        type: 'debit',
        hash: 'h2',
      },
      {
        accountId: 'acc1',
        date: '2026-08-15',
        description: 'Netflix.com',
        originalDescription: 'Netflix.com',
        amount: -19.99,
        type: 'debit',
        hash: 'h3',
      },
      // Non-recurring transaction
      {
        accountId: 'acc1',
        date: '2026-08-20',
        description: 'Target Store',
        originalDescription: 'Target Store',
        amount: -145.20,
        type: 'debit',
        hash: 'h4',
      },
    ];

    const subs = detectSubscriptions(sampleTxs);
    expect(subs.length).toBe(1);
    expect(subs[0].merchant.toLowerCase()).toContain('netflix');
    expect(subs[0].averageAmount).toBe(19.99);
    expect(subs[0].occurrences).toBe(3);
    expect(subs[0].frequency).toBe('monthly');
  });
});
