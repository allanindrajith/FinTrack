import { Category, CategoryRule, NormalizedTransaction } from '../types/index.js';

export const DEFAULT_CATEGORIES: Array<Omit<Category, 'id'>> = [
  { name: 'Groceries', color: '#10b981', icon: 'ShoppingCart', isDefault: true },
  { name: 'Dining & Drinks', color: '#f59e0b', icon: 'Utensils', isDefault: true },
  { name: 'Transport & Fuel', color: '#3b82f6', icon: 'Car', isDefault: true },
  { name: 'Subscriptions & Entertainment', color: '#8b5cf6', icon: 'Film', isDefault: true },
  { name: 'Housing & Utilities', color: '#06b6d4', icon: 'Home', isDefault: true },
  { name: 'Shopping', color: '#ec4899', icon: 'ShoppingBag', isDefault: true },
  { name: 'Health & Wellness', color: '#ef4444', icon: 'HeartPulse', isDefault: true },
  { name: 'Travel & Lodging', color: '#14b8a6', icon: 'Plane', isDefault: true },
  { name: 'Income & Salary', color: '#22c55e', icon: 'TrendingUp', isDefault: true },
  { name: 'Financial & Fees', color: '#64748b', icon: 'Building2', isDefault: true },
  { name: 'Other / Uncategorized', color: '#94a3b8', icon: 'HelpCircle', isDefault: true },
];

export interface DefaultRuleDefinition {
  categoryName: string;
  pattern: string;
  matchType: 'contains' | 'regex' | 'starts_with' | 'exact';
  priority: number;
}

export const DEFAULT_RULES: DefaultRuleDefinition[] = [
  // Income & Salary
  { categoryName: 'Income & Salary', pattern: 'SALARY|PAYROLL|DIRECT DEP|EMPLOYER|PAYCHECK|STIPEND', matchType: 'regex', priority: 50 },
  
  // Groceries
  { categoryName: 'Groceries', pattern: 'WHOLEFDS|TRADER JOE|SAFEWAY|KROGER|ALDI|LIDL|SUPERMARKET|GROCERY|COSTCO|HEB|PUBLIX|WEGMANS', matchType: 'regex', priority: 40 },

  // Subscriptions & Entertainment
  { categoryName: 'Subscriptions & Entertainment', pattern: 'NETFLIX|SPOTIFY|APPLE.COM/BILL|AMZN DIGITAL|DISNEY|HULU|HBO|MAX|YOUTUBE|STEAM|PLAYSTATION|NINTENDO|NEW YORK TIMES|SUBSTACK', matchType: 'regex', priority: 40 },

  // Transport & Fuel
  { categoryName: 'Transport & Fuel', pattern: 'UBER|LYFT|SHELL|CHEVRON|EXXON|BP |GAS STATION|SPEEDWAY|MOBIL|TRANSIT|METRO|MTA|CLIPPER|PARKING|TOLL', matchType: 'regex', priority: 40 },

  // Dining & Drinks
  { categoryName: 'Dining & Drinks', pattern: 'STARBUCKS|MCDONALD|CHIPOTLE|DOORDASH|UBER EATS|GRUBHUB|CAFE|COFFEE|BURGER|PIZZA|TACO|RESTAURANT|BAKERY|BAR |BREWERY|DINER|SWEETGREEN|SHAKE SHACK', matchType: 'regex', priority: 35 },

  // Housing & Utilities
  { categoryName: 'Housing & Utilities', pattern: 'PG&E|CONEDISON|NATIONAL GRID|ELECTRIC|WATER BILL|COMCAST|XFINITY|VERIZON|AT&T|T-MOBILE|SPECTRUM|INTERNET|RENT |MORTGAGE', matchType: 'regex', priority: 40 },

  // Health & Wellness
  { categoryName: 'Health & Wellness', pattern: 'CVS|WALGREENS|PHARMACY|HEALTH|HOSPITAL|DENTAL|OPTOMETRY|EQUINOX|PLANET FIT|GYM|FITNESS', matchType: 'regex', priority: 35 },

  // Travel & Lodging
  { categoryName: 'Travel & Lodging', pattern: 'AIRBNB|HOTEL|MARRIOTT|HILTON|HYATT|DELTA|UNITED AIR|AMERICAN AIR|SOUTHWEST|EXPEDIA|BOOKING.COM', matchType: 'regex', priority: 35 },

  // Shopping
  { categoryName: 'Shopping', pattern: 'AMAZON|AMZN|TARGET|WALMART|BEST BUY|IKEA|HOME DEPOT|LOWES|ZARA|H&M|UNIQLO|NIKE|SEPHORA|APPLE STORE', matchType: 'regex', priority: 30 },

  // Financial & Fees
  { categoryName: 'Financial & Fees', pattern: 'FEE|INTEREST CHARGE|OVERDRAFT|ATM SURCHARGE|WIRE TRANSFER FEE', matchType: 'regex', priority: 30 },
];

/**
 * Matches a transaction description against user custom rules and system default rules.
 */
export function categorizeTransaction(
  description: string,
  userRules: CategoryRule[] = [],
  categories: Category[] = []
): { categoryId?: number; categoryName: string; matchedRule?: string } {
  const upperDesc = description.toUpperCase().trim();

  // 1. Check user custom rules first (sorted by priority DESC)
  const sortedUserRules = [...userRules].sort((a, b) => b.priority - a.priority);
  for (const rule of sortedUserRules) {
    if (matchesRule(upperDesc, rule.pattern, rule.matchType)) {
      const cat = categories.find(c => c.id === rule.categoryId);
      return {
        categoryId: rule.categoryId,
        categoryName: cat?.name || rule.categoryName || 'Custom',
        matchedRule: `Custom (${rule.matchType}: ${rule.pattern})`,
      };
    }
  }

  // 2. Check default rules
  const sortedDefaultRules = [...DEFAULT_RULES].sort((a, b) => b.priority - a.priority);
  for (const defRule of sortedDefaultRules) {
    if (matchesRule(upperDesc, defRule.pattern, defRule.matchType)) {
      const cat = categories.find(c => c.name.toLowerCase() === defRule.categoryName.toLowerCase());
      return {
        categoryId: cat?.id,
        categoryName: defRule.categoryName,
        matchedRule: `Default (${defRule.categoryName})`,
      };
    }
  }

  // 3. Fallback to Other / Uncategorized
  const fallbackCat = categories.find(c => c.name.includes('Uncategorized') || c.name.includes('Other'));
  return {
    categoryId: fallbackCat?.id,
    categoryName: fallbackCat?.name || 'Other / Uncategorized',
  };
}

function matchesRule(
  text: string,
  pattern: string,
  matchType: 'contains' | 'regex' | 'starts_with' | 'exact'
): boolean {
  const upperPattern = pattern.toUpperCase();

  switch (matchType) {
    case 'exact':
      return text === upperPattern;
    case 'starts_with':
      return text.startsWith(upperPattern);
    case 'contains':
      return text.includes(upperPattern);
    case 'regex':
      try {
        const re = new RegExp(pattern, 'i');
        return re.test(text);
      } catch {
        return false;
      }
    default:
      return text.includes(upperPattern);
  }
}

/**
 * Categorizes an entire array of transactions in-place or returning enriched copies.
 */
export function autoCategorizeTransactions(
  transactions: NormalizedTransaction[],
  userRules: CategoryRule[] = [],
  categories: Category[] = []
): NormalizedTransaction[] {
  return transactions.map(t => {
    // If transaction already has a category set (e.g. from bank export like Chase), we can retain or verify
    if (t.categoryId && t.categoryName) {
      return t;
    }

    const { categoryId, categoryName } = categorizeTransaction(t.description, userRules, categories);
    return {
      ...t,
      categoryId,
      categoryName,
    };
  });
}
