import { useState, useEffect, useCallback } from 'react';
import {
  Account,
  Budget,
  CashFlowSummary,
  Category,
  CategoryRule,
  CategoryBreakdownItem,
  SubscriptionItem,
  Transaction,
  TrendItem,
  User,
} from './types.js';
import { api } from './services/api.js';
import { cryptoService } from './services/crypto.js';
import { clientAnalytics } from './services/clientAnalytics.js';
import { Navbar } from './components/Navbar.js';
import { SummaryCards } from './components/SummaryCards.js';
import { CategoryPieChart } from './components/charts/CategoryPieChart.js';
import { SpendingTrendChart } from './components/charts/SpendingTrendChart.js';
import { BudgetProgress } from './components/charts/BudgetProgress.js';
import { TransactionTable } from './components/TransactionTable.js';
import { SubscriptionList } from './components/SubscriptionList.js';
import { CsvUploaderModal } from './components/CsvUploaderModal.js';
import { RuleManagerModal } from './components/RuleManagerModal.js';
import { BudgetModal } from './components/BudgetModal.js';
import { AccountModal } from './components/AccountModal.js';
import { AuthModal } from './components/AuthModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { AiInsightsDrawer } from './components/AiInsightsDrawer.js';
import { ArrowRight, Sparkles, Upload, Shield, Lock, CheckCircle2, PieChart } from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-09');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'subscriptions'>('dashboard');

  // Dashboard Data State
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [subMonthlyTotal, setSubMonthlyTotal] = useState<number>(0);
  const [subAnnual, setSubAnnual] = useState<number>(0);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [totalBudget, setTotalBudget] = useState<number>(0);
  const [budgetSpent, setBudgetSpent] = useState<number>(0);
  const [budgetOverallPct, setBudgetOverallPct] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isBudgetsOpen, setIsBudgetsOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  useEffect(() => {
    loadUserAndAccounts();
  }, []);

  const loadUserAndAccounts = async () => {
    try {
      const token = localStorage.getItem('fintrack_token') || localStorage.getItem('serendib_token');
      if (!token) {
        setUser(null);
        return;
      }

      const meRes = await api.getMe();
      setUser(meRes.user);

      // Auto-unlock vault key if demo account
      if (meRes.user.email === 'demo@fintrack.app' && !cryptoService.isUnlocked()) {
        await cryptoService.deriveKeyFromPassphrase('demo123456', 'demo@fintrack.app');
      }

      const accRes = await api.getAccounts();
      setAccounts(accRes.accounts);

      const catRes = await api.getCategories();
      setCategories(catRes.categories);

      const rulesRes = await api.getRules();
      setRules(rulesRes.rules);
    } catch (err) {
      console.error('Initialization error:', err);
      setUser(null);
    }
  };

  const handleTryDemo = async () => {
    try {
      const res = await api.loginDemo();
      await cryptoService.deriveKeyFromPassphrase('demo123456', 'demo@fintrack.app');
      setUser(res.user);
      await loadUserAndAccounts();
      await loadDashboardData();
    } catch (err) {
      console.error('Demo login error:', err);
    }
  };

  const loadDashboardData = useCallback(async () => {
    setIsDecrypting(true);
    try {
      // Zero-knowledge data flow:
      // 1. Fetch encrypted blobs from server (server never sees plaintext)
      // 2. Decrypt each transaction on the client with AES-256-GCM
      // 3. Run all analytics locally on decrypted plaintext

      // Always fetch raw encrypted blobs
      const encRes = await api.getEncryptedTransactions(
        selectedAccountId || undefined,
        2000
      );
      const encryptedRows = encRes.records || [];

      // Decrypt all rows client-side (skip rows if vault locked or key mismatch)
      const decryptedTxs: Transaction[] = [];
      const vaultUnlocked = cryptoService.isUnlocked();

      if (vaultUnlocked) {
        const batchResults = await cryptoService.decryptTransactionsBatch(encryptedRows);
        for (const res of batchResults) {
          const row = res.item;
          const plaintext = res.plaintext || {
            description: '🔒 Decryption Failed',
            amount: 0,
            type: 'debit' as const,
          };
          decryptedTxs.push({
            id: row.id,
            user_id: 0,
            account_id: row.account_id,
            account_name: row.account_name,
            date: row.date,
            hash: row.hash,
            description: plaintext.description,
            original_description: plaintext.original_description,
            amount: plaintext.amount,
            type: plaintext.type,
            category_id: plaintext.category_id,
            category_name: plaintext.category_name,
            category_color: plaintext.category_color,
            category_icon: plaintext.category_icon,
          });
        }
      } else {
        for (const row of encryptedRows) {
          decryptedTxs.push({
            id: row.id,
            user_id: 0,
            account_id: row.account_id,
            account_name: row.account_name,
            date: row.date,
            hash: row.hash,
            description: '🔒 Encrypted',
            amount: 0,
            type: 'debit',
          });
        }
      }

      setTransactions(decryptedTxs);

      // Client-side analytics
      const summary = clientAnalytics.calculateSummary(decryptedTxs, selectedPeriod);
      setSummary(summary);

      const catResult = clientAnalytics.calculateCategoryBreakdown(decryptedTxs, selectedPeriod);
      setCategoryBreakdown(catResult.breakdown);
      setTotalSpent(catResult.totalSpent);

      const trends = clientAnalytics.calculateTrends(decryptedTxs, 6);
      setTrends(trends);

      const subResult = clientAnalytics.detectSubscriptions(decryptedTxs);
      setSubscriptions(subResult.subscriptions);
      setSubMonthlyTotal(subResult.monthlyTotal);
      setSubAnnual(subResult.annualProjected);

      // Budgets: fetch budget limits from server, compute spent client-side
      const budgetsRaw = await api.getBudgets(selectedPeriod);
      const budgetResult = clientAnalytics.calculateBudgetProgress(
        budgetsRaw.budgets,
        decryptedTxs,
        selectedPeriod
      );
      setBudgets(budgetResult.budgets);
      setTotalBudget(budgetResult.totalBudget);
      setBudgetSpent(budgetResult.totalSpent);
      setBudgetOverallPct(budgetResult.overallPercentage);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsDecrypting(false);
    }
  }, [selectedPeriod, selectedAccountId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return (
    <div className="min-h-screen bg-[#e8ebe6] text-[#0e0f0c] flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
        selectedPeriod={selectedPeriod}
        onSelectPeriod={setSelectedPeriod}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenBudgets={() => setIsBudgetsOpen(true)}
        onOpenNewAccount={() => setIsAccountOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAi={() => setIsAiOpen(true)}
        onLogout={() => {
          api.logout();
          setUser(null);
          setIsAuthOpen(true);
        }}
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      {!user ? (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10 animate-in fade-in duration-300">
          {/* Welcome Hero */}
          <div className="p-8 sm:p-12 rounded-[24px] bg-white border border-[#e8ebe6] shadow-card text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#e2f6d5] text-[#054d28] text-xs font-bold border border-[#dce3d6]">
              <Shield className="w-4 h-4 text-[#22720d]" />
              <span>Zero-Knowledge Client-Side Encryption</span>
            </div>
            
            <h1 className="text-3xl sm:text-5xl font-[900] text-[#0e0f0c] tracking-tight leading-tight max-w-2xl mx-auto">
              Personal wealth. <br />
              <span className="text-[#054d28]">Zero compromises on privacy.</span>
            </h1>

            <p className="text-sm sm:text-base text-[#454745] max-w-xl mx-auto leading-relaxed">
              FinTrack encrypts your transactions with AES-256-GCM right inside your browser before they ever leave your machine. The server never sees your balances, merchants, or spending habits.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                id="btn-hero-get-started"
                onClick={() => setIsAuthOpen(true)}
                className="px-8 py-3.5 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-black text-sm rounded-full shadow-sm active:scale-95 transition-all flex items-center gap-2"
              >
                <span>Get Started / Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <button
                id="btn-hero-demo-vault"
                onClick={handleTryDemo}
                className="px-6 py-3.5 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] font-bold text-sm rounded-full active:scale-95 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[#0e0f0c]" />
                <span>Explore Demo Vault</span>
              </button>
            </div>
          </div>

          {/* Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-[24px] bg-white border border-[#e8ebe6] shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#9fe870]/20 flex items-center justify-center text-[#1e460d]">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-[900] text-[#0e0f0c]">Client-Side AES-256-GCM</h2>
              <p className="text-xs text-[#5f655b] leading-relaxed">
                Keys are derived locally via 600,000 PBKDF2 rounds. The server stores only ciphertext blobs and blind HMAC deduplication hashes.
              </p>
            </div>

            <div className="p-6 rounded-[24px] bg-white border border-[#e8ebe6] shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#e8ebe6] flex items-center justify-center text-[#0e0f0c]">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-[900] text-[#0e0f0c]">Dual-Tier Gemini AI</h2>
              <p className="text-xs text-[#5f655b] leading-relaxed">
                Opt-in natural language insights powered by Google Gemini Flash default, with BYO-key support for OpenAI and Anthropic Claude.
              </p>
            </div>

            <div className="p-6 rounded-[24px] bg-white border border-[#e8ebe6] shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#e8ebe6] flex items-center justify-center text-[#0e0f0c]">
                <CheckCircle2 className="w-5 h-5 text-[#22720d]" />
              </div>
              <h2 className="text-sm font-[900] text-[#0e0f0c]">Automated Retention Purges</h2>
              <p className="text-xs text-[#5f655b] leading-relaxed">
                Configurable retention horizons (1d, 7d, 1m, 3m, 1y, custom, never) with scheduled background purges and 24–48h hard deletes.
              </p>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8 space-y-6">
          {/* Signature FinTrack Hero Banner */}
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 p-6 sm:p-8 rounded-[24px] bg-white border border-[#e8ebe6] shadow-card">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#e2f6d5] text-[#054d28]">
                  {selectedAccountId
                    ? accounts.find((a) => a.id === selectedAccountId)?.name
                    : 'Consolidated Accounts'}
                </span>
                <span className="text-xs text-[#5f655b] font-semibold">• {selectedPeriod}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-[900] text-[#0e0f0c] tracking-tight leading-tight">
                Personal wealth without borders.
              </h1>
              <p className="text-xs sm:text-sm text-[#454745] font-normal leading-relaxed">
                Consolidated cash flow, automatic statement normalization, and recurring subscription tracking.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full xl:w-auto flex-shrink-0">
              <button
                id="btn-hero-import"
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm active:scale-95 transition-all min-h-[42px]"
              >
                <Upload className="w-4 h-4 text-[#0e0f0c]" />
                <span>Import Bank CSV</span>
              </button>
              <button
                id="btn-hero-ai"
                onClick={() => setIsAiOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-[#9fe870]/20 hover:bg-[#9fe870]/40 text-[#1e460d] border border-[#9fe870]/60 font-bold text-xs rounded-full shadow-xs active:scale-95 transition-all min-h-[42px]"
              >
                <Sparkles className="w-4 h-4 text-[#1e460d]" />
                <span>Ask FinTrack AI</span>
              </button>
              <button
                id="btn-hero-budgets"
                onClick={() => setIsBudgetsOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] font-bold text-xs rounded-full transition-all min-h-[42px]"
              >
                <PieChart className="w-4 h-4 text-[#0e0f0c]" />
                <span>Adjust Budgets</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Dashboard View */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* KPI Summary Cards */}
              <SummaryCards
                summary={summary}
                subscriptionMonthlyTotal={subMonthlyTotal}
                subscriptionCount={subscriptions.length}
                isDecrypting={isDecrypting}
                onOpenUpload={() => setIsUploadOpen(true)}
              />

              {/* Row 1: Donut Category Breakdown & Spending Trend Area Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CategoryPieChart data={categoryBreakdown} totalSpent={totalSpent} />
                <SpendingTrendChart data={trends} />
              </div>

              {/* Row 2: Budget Progress & Recent Transactions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BudgetProgress
                  budgets={budgets}
                  totalBudget={totalBudget}
                  totalSpent={budgetSpent}
                  overallPercentage={budgetOverallPct}
                  onOpenBudgetModal={() => setIsBudgetsOpen(true)}
                />

                {/* Quick Recent Transactions Card */}
                <div className="fintrack-card p-6 rounded-[24px] flex flex-col h-[400px]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-[900] text-[#0e0f0c] tracking-tight">Recent Transactions</h2>
                      <p className="text-xs text-[#454745]">Latest statement records</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('transactions')}
                      className="flex items-center gap-1 text-xs font-bold text-[#0e0f0c] hover:underline transition-colors"
                    >
                      <span>View All ({transactions.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {transactions.slice(0, 6).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-[#e8ebe6]/40 hover:bg-[#e8ebe6] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tx.category_color || '#9fe870' }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#0e0f0c] truncate">{tx.description}</div>
                            <div className="text-[11px] text-[#5f655b] flex items-center gap-2 mt-0.5">
                              <span className="font-mono">{tx.date}</span>
                              <span>•</span>
                              <span className="text-[#454745] font-medium">{tx.category_name || 'Uncategorized'}</span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`text-xs font-[900] flex-shrink-0 ml-2 ${
                            tx.amount < 0 ? 'text-[#a72027]' : 'text-[#054d28]'
                          }`}
                        >
                          {tx.amount < 0 ? `-$${Math.abs(tx.amount).toFixed(2)}` : `+$${tx.amount.toFixed(2)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Full Transactions Table */}
          {activeTab === 'transactions' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <TransactionTable
                transactions={transactions}
                categories={categories}
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onRefresh={loadDashboardData}
              />
            </div>
          )}

          {/* Tab 3: Subscriptions Detector */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <SubscriptionList
                subscriptions={subscriptions}
                monthlyTotal={subMonthlyTotal}
                annualProjected={subAnnual}
              />
            </div>
          )}
        </main>
      )}

      {/* Modals */}
      <CsvUploaderModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        categories={categories}
        rules={rules}
        onSuccess={() => {
          loadUserAndAccounts();
          loadDashboardData();
        }}
      />

      <RuleManagerModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        categories={categories}
        onRulesUpdated={loadDashboardData}
      />

      <BudgetModal
        isOpen={isBudgetsOpen}
        onClose={() => setIsBudgetsOpen(false)}
        categories={categories}
        period={selectedPeriod}
        onBudgetsUpdated={loadDashboardData}
      />

      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        onAccountCreated={() => {
          loadUserAndAccounts();
          loadDashboardData();
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => {
          setUser(u);
          loadUserAndAccounts();
          loadDashboardData();
        }}
      />

      {user && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          user={user}
          onUserUpdate={(u) => setUser(u)}
          onDataDeleted={() => {
            loadUserAndAccounts();
            loadDashboardData();
          }}
          onAccountDeleted={() => {
            api.logout();
            setUser(null);
            setIsAuthOpen(true);
          }}
        />
      )}

      {user && (
        <AiInsightsDrawer
          isOpen={isAiOpen}
          onClose={() => setIsAiOpen(false)}
          user={user}
          transactions={transactions}
          summary={summary || {
            period: selectedPeriod,
            totalIncome: 0,
            totalExpenses: 0,
            netSavings: 0,
            savingsRate: 0,
            transactionCount: transactions.length,
          }}
        />
      )}
    </div>
  );
}

export default App;
