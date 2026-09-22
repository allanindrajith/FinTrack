export interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  type?: string;
  category?: string;
}

export type TransactionType = 'debit' | 'credit';

export interface NormalizedTransaction {
  id?: number | string;
  accountId: string;
  date: string; // YYYY-MM-DD
  description: string;
  originalDescription: string;
  amount: number; // Signed float: negative for expenses/debits, positive for income/credits
  type: TransactionType;
  categoryId?: number;
  categoryName?: string;
  isRecurring?: boolean;
  hash: string;
  rawData?: Record<string, any>;
}

export interface BankPreset {
  id: string;
  name: string;
  description: string;
  matchesHeaders: (headers: string[]) => boolean;
  getMapping: (headers: string[]) => ColumnMapping;
  customRowTransform?: (row: Record<string, string>) => {
    date?: string;
    description?: string;
    amount?: number;
    type?: TransactionType;
  } | null;
}

export interface ParseResult {
  totalRows: number;
  parsedTransactions: NormalizedTransaction[];
  duplicatesSkipped: number;
  newTransactions: NormalizedTransaction[];
  detectedPreset?: string;
  detectedPresetName?: string;
  confidence: number;
  headers: string[];
  previewRows: Record<string, string>[];
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
}

export interface CategoryRule {
  id: number;
  categoryId: number;
  categoryName?: string;
  matchType: 'contains' | 'exact' | 'regex' | 'starts_with';
  pattern: string;
  priority: number;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment';
  currency: string;
  balance?: number;
  institution?: string;
  createdAt: string;
}

export interface SubscriptionDetection {
  merchant: string;
  category: string;
  averageAmount: number;
  frequency: 'monthly' | 'weekly' | 'annual';
  lastDate: string;
  nextEstimatedDate: string;
  occurrences: number;
  transactions: NormalizedTransaction[];
}

export interface MonthlyCategoryBreakdown {
  categoryId: number;
  categoryName: string;
  color: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export interface CashFlowSummary {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number; // Percentage
  period: string; // e.g. "2026-09"
}

export interface Budget {
  id: number;
  categoryId: number;
  categoryName?: string;
  amount: number;
  period: string; // YYYY-MM
  spent?: number;
  percentage?: number;
}
