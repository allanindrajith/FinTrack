export type TransactionType = 'debit' | 'credit';

export interface Transaction {
  id: number;
  user_id: number;
  account_id: string;
  account_name?: string;
  date: string;
  description: string;
  original_description?: string;
  amount: number;
  type: TransactionType;
  category_id?: number;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  hash: string;
}

export interface Account {
  id: string;
  user_id: number;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment';
  currency: string;
  institution?: string;
  transaction_count?: number;
  balance_calculated?: number;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  is_default: number;
}

export interface CategoryRule {
  id: number;
  category_id: number;
  category_name?: string;
  category_color?: string;
  match_type: 'contains' | 'exact' | 'regex' | 'starts_with';
  pattern: string;
  priority: number;
}

export interface Budget {
  id: number;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  budgetAmount: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'good' | 'warning' | 'exceeded';
  period: string;
}

export interface CashFlowSummary {
  period: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  transactionCount: number;
}

export interface CategoryBreakdownItem {
  categoryId: number;
  categoryName: string;
  color: string;
  icon: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export interface TrendItem {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

export interface SubscriptionItem {
  merchant: string;
  category: string;
  averageAmount: number;
  frequency: 'monthly' | 'weekly' | 'annual';
  lastDate: string;
  nextEstimatedDate: string;
  occurrences: number;
  transactions: any[];
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  type?: string;
  category?: string;
}

export interface CsvPreviewResult {
  headers: string[];
  previewRows: Record<string, string>[];
  detectedPreset?: string;
  detectedPresetName?: string;
  confidence: number;
  totalRows: number;
  sampleParsed: any[];
}

export interface User {
  id: number;
  name: string;
  email: string;
}
