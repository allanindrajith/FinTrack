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
import { cryptoService } from './crypto.js';
import { categorizeDescription } from './clientCategorizer.js';

const API_BASE = '/api';

function getHeaders(isFormData = false): HeadersInit {
  const token = localStorage.getItem('fintrack_token') || localStorage.getItem('serendib_token');
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
    localStorage.setItem('serendib_token', data.token);
    return data;
  },
  async register(name: string, email: string, password: string): Promise<{ user: User; token: string; message?: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, email, password }),
    });
    const data = await handleResponse<{ user: User; token: string; message?: string }>(res);
    if (data.token) {
      localStorage.setItem('fintrack_token', data.token);
      localStorage.setItem('serendib_token', data.token);
    }
    return data;
  },
  async loginGoogle(credential: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ credential }),
    });
    const data = await handleResponse<{ user: User; token: string }>(res);
    localStorage.setItem('fintrack_token', data.token);
    localStorage.setItem('serendib_token', data.token);
    return data;
  },
  async loginApple(identityToken: string, user?: { name?: { firstName: string; lastName: string } }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/apple`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ identityToken, user }),
    });
    const data = await handleResponse<{ user: User; token: string }>(res);
    localStorage.setItem('fintrack_token', data.token);
    localStorage.setItem('serendib_token', data.token);
    return data;
  },
  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email }),
    });
    return handleResponse(res);
  },
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ token, newPassword }),
    });
    return handleResponse(res);
  },
  logout() {
    localStorage.removeItem('fintrack_token');
    localStorage.removeItem('serendib_token');
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: getHeaders() }).catch(() => {});
  },
  async loginDemo(): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await handleResponse<{ user: User; token: string }>(res);
    localStorage.setItem('fintrack_token', data.token);
    localStorage.setItem('serendib_token', data.token);
    return data;
  },

  // User Profile & Settings
  async getProfile(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/users/me`, { headers: getHeaders() });
    return handleResponse(res);
  },
  async updateProfile(data: { name?: string; currency?: string; profilePicture?: string }): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/users/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  async updatePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/users/password`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return handleResponse(res);
  },
  async updateSettings(settings: {
    retentionPolicy?: string;
    retentionCustomDate?: string;
    aiConsent?: boolean;
    aiProvider?: string;
    aiApiKey?: string;
  }): Promise<{ user: User; message: string }> {
    const res = await fetch(`${API_BASE}/users/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    });
    return handleResponse(res);
  },
  async deleteFinancialData(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/users/delete-data`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  async deleteUserAccount(): Promise<{ success: boolean; message: string }> {
    // DELETE /api/users/me — requires the /me alias in users.ts
    const res = await fetch(`${API_BASE}/users/me`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  async getAuditLogs(): Promise<{ logs: any[] }> {
    const res = await fetch(`${API_BASE}/users/audit-logs`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // Zero-Knowledge Encrypted Transactions
  async uploadEncryptedTransactions(accountId: string, encryptedRecords: Array<{
    date: string;
    encryptedBlob: string;
    hash: string;
  }>): Promise<{
    importedCount: number;
    duplicatesSkipped: number;
    total: number;
  }> {
    const res = await fetch(`${API_BASE}/transactions/upload-encrypted`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ accountId, encryptedRecords }),
    });
    return handleResponse(res);
  },
  async getEncryptedTransactions(accountId?: string, limit = 1000): Promise<{
    records: Array<{
      id: number;
      account_id: string;
      date: string;
      encrypted_blob: string;
      hash: string;
      account_name?: string;
    }>;
    total: number;
  }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (accountId) params.set('accountId', accountId);
    // Uses GET /api/transactions/encrypted (alias added in transactions.ts)
    const res = await fetch(`${API_BASE}/transactions/encrypted?${params.toString()}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // AI Insights
  async queryAi(prompt: string, contextSummary?: string): Promise<{ answer: string; provider: string; isByoKey: boolean }> {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ prompt, contextSummary }),
    });
    return handleResponse(res);
  },
  async categorizeWithAi(
    descriptions: string[],
    categories: string[]
  ): Promise<{ categorizations: Array<{ description: string; categoryName: string; confidence: number }> }> {
    const res = await fetch(`${API_BASE}/ai/categorize`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ descriptions, categories }),
    });
    return handleResponse(res);
  },
  async getAiHistory(): Promise<{ messages: Array<{ role: 'user' | 'assistant'; content: string; created_at: string }> }> {
    const res = await fetch(`${API_BASE}/ai/history`, { headers: getHeaders() });
    return handleResponse(res);
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
    rulePattern?: string,
    txContext?: Transaction,
    categories?: Category[],
    allLoadedTransactions?: Transaction[]
  ): Promise<{ transaction?: Transaction; ruleCreated: boolean; otherTransactionsUpdated: number }> {
    if (!cryptoService.isUnlocked()) {
      throw new Error('Encryption vault is locked. Please unlock your vault before modifying records.');
    }

    const matchedCat = categories?.find((c) => c.id === categoryId);

    // 1. Re-encrypt this specific transaction with updated category metadata
    if (txContext) {
      const plaintext = {
        description: txContext.description,
        original_description: txContext.original_description,
        amount: txContext.amount,
        type: txContext.type,
        category_id: categoryId,
        category_name: matchedCat?.name || txContext.category_name,
        category_color: matchedCat?.color || txContext.category_color,
        category_icon: matchedCat?.icon || txContext.category_icon,
      };

      const encryptedBlob = await cryptoService.encryptTransaction(plaintext);
      await fetch(`${API_BASE}/transactions/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ encryptedBlob, date: txContext.date }),
      });
    }

    // 2. Create rule if requested
    let ruleCreated = false;
    let otherCount = 0;
    if (createRule && rulePattern) {
      try {
        await this.createRule(categoryId, rulePattern.trim(), 'contains', 20);
        ruleCreated = true;

        // Auto-update other matching transactions loaded in memory
        if (allLoadedTransactions && allLoadedTransactions.length > 0) {
          const upperPattern = rulePattern.trim().toUpperCase();
          for (const otherTx of allLoadedTransactions) {
            if (otherTx.id === id) continue;
            const desc = (otherTx.description || '').toUpperCase();
            if (desc.includes(upperPattern)) {
              try {
                const plaintext = {
                  description: otherTx.description,
                  original_description: otherTx.original_description,
                  amount: otherTx.amount,
                  type: otherTx.type,
                  category_id: categoryId,
                  category_name: matchedCat?.name,
                  category_color: matchedCat?.color,
                  category_icon: matchedCat?.icon,
                };
                const blob = await cryptoService.encryptTransaction(plaintext);
                await fetch(`${API_BASE}/transactions/${otherTx.id}`, {
                  method: 'PUT',
                  headers: getHeaders(),
                  body: JSON.stringify({ encryptedBlob: blob, date: otherTx.date }),
                });
                otherCount++;
              } catch (e) {
                console.warn('Failed to update matching transaction:', otherTx.id, e);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Create rule error during recategorization:', err);
      }
    }

    return { ruleCreated, otherTransactionsUpdated: otherCount };
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
  /**
   * Zero-Knowledge CSV Upload:
   * 1. Send CSV to server for parsing only (POST /transactions/preview with sampleOnly flag)
   * 2. Encrypt each parsed transaction on the client with AES-256-GCM
   * 3. Upload encrypted blobs + blind HMAC dedup hashes to /transactions/upload-encrypted
   *
   * The server never sees plaintext amounts, descriptions, or categories.
   */
  async uploadCsv(
    fileOrText: File | string,
    accountId: string,
    options: {
      customMapping?: ColumnMapping;
      dateFormatPreference?: string;
      invertAmountSign?: boolean;
      categories?: Category[];
      rules?: CategoryRule[];
    } = {}
  ): Promise<{
    totalRows: number;
    importedCount: number;
    duplicatesSkipped: number;
    detectedPreset?: string;
    detectedPresetName?: string;
    confidence: number;
  }> {
    if (!cryptoService.isUnlocked()) {
      throw new Error('Encryption vault is locked. Please unlock your vault before importing transactions.');
    }

    // Step 1: Parse CSV on server (no financial data stored — just structural parsing)
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

    // Use existing /preview endpoint to get full parsed rows (not just sample)
    formData.append('fullParse', 'true');
    const parseRes = await fetch(`${API_BASE}/transactions/preview`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    const parseData = await handleResponse<CsvPreviewResult>(parseRes);

    if (!parseData.sampleParsed || parseData.sampleParsed.length === 0) {
      return {
        totalRows: 0,
        importedCount: 0,
        duplicatesSkipped: 0,
        detectedPreset: parseData.detectedPreset,
        detectedPresetName: parseData.detectedPresetName,
        confidence: parseData.confidence,
      };
    }

    // Step 2: Encrypt each transaction client-side
    const encryptedRecords: Array<{ date: string; encryptedBlob: string; hash: string }> = [];

    for (const row of parseData.sampleParsed) {
      try {
        const rawDesc = String(row.description || row.Description || '').trim();
        // CWE-1236 Formula Injection Neutralization: strip control chars and quote triggers
        let cleanDesc = rawDesc.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        if (/^[=+\-@\t\r]/.test(cleanDesc)) {
          cleanDesc = `'${cleanDesc}`;
        }
        const description = cleanDesc || 'Unknown Transaction';
        const amount = Number(row.amount ?? row.Amount ?? 0);
        const date = String(row.date || row.Date || '').trim();
        const type = amount >= 0 ? 'credit' : 'debit';

        if (!date || isNaN(amount)) continue;

        // Apply client-side categorizer
        const catMatch = options.categories && options.rules
          ? categorizeDescription(description, options.categories, options.rules)
          : null;

        const plaintext = {
          description,
          original_description: description,
          amount,
          type: type as 'debit' | 'credit',
          category_id: catMatch?.categoryId,
          category_name: catMatch?.categoryName,
          category_color: catMatch?.categoryColor,
          category_icon: catMatch?.categoryIcon,
        };

        const encryptedBlob = await cryptoService.encryptTransaction(plaintext);
        const hash = await cryptoService.computeBlindHash(date, amount, description);

        encryptedRecords.push({ date, encryptedBlob, hash });
      } catch (err) {
        console.warn('Skipping row due to encryption error:', err);
      }
    }

    // Step 3: Upload encrypted blobs to server
    const uploadRes = await this.uploadEncryptedTransactions(accountId, encryptedRecords);

    return {
      totalRows: parseData.sampleParsed.length,
      importedCount: uploadRes.importedCount,
      duplicatesSkipped: uploadRes.duplicatesSkipped,
      detectedPreset: parseData.detectedPreset,
      detectedPresetName: parseData.detectedPresetName,
      confidence: parseData.confidence,
    };
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
