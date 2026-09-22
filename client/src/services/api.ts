import {
  Account,
  Budget,
  CashFlowSummary,
  Category,
  CategoryBreakdownItem,
  CategoryRule,
  ColumnMapping,
  CsvPreviewResult,
  SubscriptionItem,
  Transaction,
  TrendItem,
  User,
} from '../types.js';

const API_BASE = '/api';

function getHeaders(isFormData = false): HeadersInit {
  const token = localStorage.getItem('fintrack_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  async getMe(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse<{ user: User; token: string }>(res);
    localStorage.setItem('fintrack_token', data.token);
    return data;
  },
  async register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, email, password }),
    });
    const data = await handleResponse<{ user: User; token: string }>(res);
    localStorage.setItem('fintrack_token', data.token);
    return data;
  },
  logout() {
    localStorage.removeItem('fintrack_token');
  },

  // Accounts
  async getAccounts(): Promise<{ accounts: Account[] }> {
    const res = await fetch(`${API_BASE}/accounts`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async createAccount(name: string, type: string, currency = 'USD', institution = ''): Promise<{ account: Account }> {
    const res = await fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, type, currency, institution }),
    });
    return handleResponse(res);
  },
  async deleteAccount(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/accounts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Categories & Rules
  async getCategories(): Promise<{ categories: Category[] }> {
    const res = await fetch(`${API_BASE}/categories`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async createCategory(name: string, color: string, icon: string): Promise<{ category: Category }> {
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, color, icon }),
    });
    return handleResponse(res);
  },
  async getRules(): Promise<{ rules: CategoryRule[] }> {
    const res = await fetch(`${API_BASE}/categories/rules`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async createRule(categoryId: number, pattern: string, matchType = 'contains', priority = 20): Promise<{ rule: CategoryRule; updatedTransactionsCount: number }> {
    const res = await fetch(`${API_BASE}/categories/rules`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ categoryId, pattern, matchType, priority }),
    });
    return handleResponse(res);
  },
  async deleteRule(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/categories/rules/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Transactions
  async getTransactions(params: {
    accountId?: string;
    categoryId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: string;
  } = {}): Promise<{ transactions: Transaction[]; total: number }> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const res = await fetch(`${API_BASE}/transactions?${searchParams.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  async updateTransaction(id: number, data: Partial<Transaction>): Promise<{ transaction: Transaction }> {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  async recategorizeTransaction(
    id: number,
    categoryId: number,
    createRule = false,
    rulePattern?: string
  ): Promise<{ transaction: Transaction; ruleCreated: boolean; otherTransactionsUpdated: number }> {
    const res = await fetch(`${API_BASE}/transactions/${id}/recategorize`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ categoryId, createRule, rulePattern }),
    });
    return handleResponse(res);
  },
  async deleteTransaction(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // CSV Upload & Preview
  async previewCsv(fileOrText: File | string, accountId?: string): Promise<CsvPreviewResult> {
    const formData = new FormData();
    if (typeof fileOrText === 'string') {
      formData.append('csvText', fileOrText);
    } else {
      formData.append('file', fileOrText);
    }
    if (accountId) formData.append('accountId', accountId);

    const res = await fetch(`${API_BASE}/transactions/preview`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    return handleResponse(res);
  },
  async uploadCsv(
    fileOrText: File | string,
    accountId: string,
    options: {
      customMapping?: ColumnMapping;
      dateFormatPreference?: string;
      invertAmountSign?: boolean;
    } = {}
  ): Promise<{
    totalRows: number;
    importedCount: number;
    duplicatesSkipped: number;
    detectedPreset?: string;
    detectedPresetName?: string;
    confidence: number;
  }> {
    const formData = new FormData();
    if (typeof fileOrText === 'string') {
      formData.append('csvText', fileOrText);
    } else {
      formData.append('file', fileOrText);
    }
    formData.append('accountId', accountId);
    if (options.customMapping) {
      formData.append('customMapping', JSON.stringify(options.customMapping));
    }
    if (options.dateFormatPreference) {
      formData.append('dateFormatPreference', options.dateFormatPreference);
    }
    if (options.invertAmountSign !== undefined) {
      formData.append('invertAmountSign', String(options.invertAmountSign));
    }

    const res = await fetch(`${API_BASE}/transactions/upload`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    return handleResponse(res);
  },

  // Analytics & Budgets
  async getSummary(period?: string, accountId?: string): Promise<CashFlowSummary> {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    if (accountId) params.append('accountId', accountId);
    const res = await fetch(`${API_BASE}/analytics/summary?${params.toString()}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getCategoryBreakdown(period?: string, accountId?: string): Promise<{ period: string; totalSpent: number; breakdown: CategoryBreakdownItem[] }> {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    if (accountId) params.append('accountId', accountId);
    const res = await fetch(`${API_BASE}/analytics/category-breakdown?${params.toString()}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getTrends(months = 6, accountId?: string): Promise<{ trends: TrendItem[] }> {
    const params = new URLSearchParams();
    params.append('months', String(months));
    if (accountId) params.append('accountId', accountId);
    const res = await fetch(`${API_BASE}/analytics/trends?${params.toString()}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getSubscriptions(accountId?: string): Promise<{
    subscriptions: SubscriptionItem[];
    monthlyTotal: number;
    annualProjected: number;
    count: number;
  }> {
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', accountId);
    const res = await fetch(`${API_BASE}/analytics/subscriptions?${params.toString()}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async getBudgets(period?: string): Promise<{
    period: string;
    totalBudget: number;
    totalSpent: number;
    overallPercentage: number;
    budgets: Budget[];
  }> {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    const res = await fetch(`${API_BASE}/budgets?${params.toString()}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async setBudget(categoryId: number, amount: number, period?: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/budgets`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ categoryId, amount, period }),
    });
    return handleResponse(res);
  },
  async deleteBudget(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/budgets/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
};
