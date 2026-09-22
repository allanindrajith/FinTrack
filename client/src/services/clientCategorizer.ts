import { Category, CategoryRule } from '../types.js';

export interface RuleMatchResult {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  matchedRuleId?: number;
  confidence: number;
}

export const DEFAULT_KEYWORD_RULES: { pattern: string; categoryName: string }[] = [
  // Housing & Utilities
  { pattern: 'RENT', categoryName: 'Housing' },
  { pattern: 'MORTGAGE', categoryName: 'Housing' },
  { pattern: 'ELECTRIC', categoryName: 'Utilities' },
  { pattern: 'WATER', categoryName: 'Utilities' },
  { pattern: 'CONED', categoryName: 'Utilities' },
  { pattern: 'PG&E', categoryName: 'Utilities' },
  { pattern: 'COMCAST', categoryName: 'Utilities' },
  { pattern: 'VERIZON', categoryName: 'Utilities' },
  { pattern: 'ATT', categoryName: 'Utilities' },
  { pattern: 'T-MOBILE', categoryName: 'Utilities' },

  // Groceries & Dining
  { pattern: 'WHOLEFDS', categoryName: 'Groceries' },
  { pattern: 'TRADER JOE', categoryName: 'Groceries' },
  { pattern: 'SAFEWAY', categoryName: 'Groceries' },
  { pattern: 'KROGER', categoryName: 'Groceries' },
  { pattern: 'ALDI', categoryName: 'Groceries' },
  { pattern: 'COSTCO', categoryName: 'Groceries' },
  { pattern: 'STARBUCKS', categoryName: 'Dining & Cafes' },
  { pattern: 'CHIPOTLE', categoryName: 'Dining & Cafes' },
  { pattern: 'MCDONALDS', categoryName: 'Dining & Cafes' },
  { pattern: 'SWEETGREEN', categoryName: 'Dining & Cafes' },
  { pattern: 'DOORDASH', categoryName: 'Dining & Cafes' },
  { pattern: 'UBER EATS', categoryName: 'Dining & Cafes' },
  { pattern: 'GRUBHUB', categoryName: 'Dining & Cafes' },

  // Transport
  { pattern: 'UBER', categoryName: 'Transport' },
  { pattern: 'LYFT', categoryName: 'Transport' },
  { pattern: 'SHELL', categoryName: 'Transport' },
  { pattern: 'CHEVRON', categoryName: 'Transport' },
  { pattern: 'BP', categoryName: 'Transport' },
  { pattern: 'EXXON', categoryName: 'Transport' },
  { pattern: 'SUBWAY', categoryName: 'Transport' },
  { pattern: 'MTA', categoryName: 'Transport' },

  // Subscriptions & Streaming
  { pattern: 'NETFLIX', categoryName: 'Subscriptions' },
  { pattern: 'SPOTIFY', categoryName: 'Subscriptions' },
  { pattern: 'APPLE.COM', categoryName: 'Subscriptions' },
  { pattern: 'AMZN DIGITAL', categoryName: 'Subscriptions' },
  { pattern: 'PRIME VIDEO', categoryName: 'Subscriptions' },
  { pattern: 'YOUTUBE', categoryName: 'Subscriptions' },
  { pattern: 'DISNEY', categoryName: 'Subscriptions' },
  { pattern: 'HBO', categoryName: 'Subscriptions' },
  { pattern: 'NEW YORK TIMES', categoryName: 'Subscriptions' },
  { pattern: 'CHATGPT', categoryName: 'Subscriptions' },
  { pattern: 'GITHUB', categoryName: 'Subscriptions' },

  // Healthcare
  { pattern: 'CVS', categoryName: 'Healthcare' },
  { pattern: 'WALGREENS', categoryName: 'Healthcare' },
  { pattern: 'DUANE READE', categoryName: 'Healthcare' },
  { pattern: 'PHARMACY', categoryName: 'Healthcare' },
  { pattern: 'DENTAL', categoryName: 'Healthcare' },

  // Shopping
  { pattern: 'AMAZON', categoryName: 'Shopping' },
  { pattern: 'TARGET', categoryName: 'Shopping' },
  { pattern: 'WALMART', categoryName: 'Shopping' },
  { pattern: 'BEST BUY', categoryName: 'Shopping' },
  { pattern: 'IKEA', categoryName: 'Shopping' },
  { pattern: 'ZARA', categoryName: 'Shopping' },
  { pattern: 'H&M', categoryName: 'Shopping' },

  // Income & Transfers
  { pattern: 'PAYROLL', categoryName: 'Income' },
  { pattern: 'DIRECT DEP', categoryName: 'Income' },
  { pattern: 'SALARY', categoryName: 'Income' },
  { pattern: 'DIVIDEND', categoryName: 'Income' },
  { pattern: 'INTEREST PAYMENT', categoryName: 'Income' },
];

export function categorizeDescription(
  description: string,
  categories: Category[],
  userRules: CategoryRule[] = []
): RuleMatchResult | null {
  const descUpper = description.toUpperCase().trim();

  // 1. Check user-defined custom rules first (sorted by priority descending)
  for (const rule of userRules) {
    const pattern = rule.pattern.toUpperCase();
    let matches = false;

    if (rule.match_type === 'contains') {
      matches = descUpper.includes(pattern);
    } else if (rule.match_type === 'exact') {
      matches = descUpper === pattern;
    } else if (rule.match_type === 'starts_with') {
      matches = descUpper.startsWith(pattern);
    } else if (rule.match_type === 'regex') {
      try {
        const re = new RegExp(rule.pattern, 'i');
        matches = re.test(description);
      } catch {
        matches = false;
      }
    }

    if (matches) {
      const cat = categories.find((c) => c.id === rule.category_id);
      if (cat) {
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          categoryColor: cat.color,
          categoryIcon: cat.icon,
          matchedRuleId: rule.id,
          confidence: 0.95,
        };
      }
    }
  }

  // 2. Fall back to built-in default keyword rules
  for (const rule of DEFAULT_KEYWORD_RULES) {
    if (descUpper.includes(rule.pattern)) {
      const cat = categories.find((c) => c.name.toLowerCase() === rule.categoryName.toLowerCase());
      if (cat) {
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          categoryColor: cat.color,
          categoryIcon: cat.icon,
          confidence: 0.85,
        };
      }
    }
  }

  return null;
}
