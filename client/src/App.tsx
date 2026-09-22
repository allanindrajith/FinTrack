import { useState, useEffect, useCallback } from 'react';
import {
  Account,
  Budget,
  CashFlowSummary,
  Category,
  CategoryBreakdownItem,
  SubscriptionItem,
  Transaction,
  TrendItem,
  User,
} from './types.js';
import { api } from './services/api.js';
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
import { ArrowRight, Sparkles, Upload } from 'lucide-react';

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

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isBudgetsOpen, setIsBudgetsOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  // Initialize and load accounts
  useEffect(() => {
    loadUserAndAccounts();
  }, []);

  const loadUserAndAccounts = async () => {
    try {
      const meRes = await api.getMe();
      setUser(meRes.user);

      const accRes = await api.getAccounts();
      setAccounts(accRes.accounts);

      const catRes = await api.getCategories();
      setCategories(catRes.categories);
    } catch (err) {
      console.error('Initialization error:', err);
    }
  };

  const loadDashboardData = useCallback(async () => {
    try {
      // 1. Summary
      const sum = await api.getSummary(selectedPeriod, selectedAccountId || undefined);
      setSummary(sum);

      // 2. Category Breakdown
      const catBreakdown = await api.getCategoryBreakdown(selectedPeriod, selectedAccountId || undefined);
      setCategoryBreakdown(catBreakdown.breakdown);
      setTotalSpent(catBreakdown.totalSpent);

      // 3. Trends
      const trendRes = await api.getTrends(6, selectedAccountId || undefined);
      setTrends(trendRes.trends);

      // 4. Subscriptions
      const subRes = await api.getSubscriptions(selectedAccountId || undefined);
      setSubscriptions(subRes.subscriptions);
      setSubMonthlyTotal(subRes.monthlyTotal);
      setSubAnnual(subRes.annualProjected);

      // 5. Budgets
      const budRes = await api.getBudgets(selectedPeriod);
      setBudgets(budRes.budgets);
      setTotalBudget(budRes.totalBudget);
      setBudgetSpent(budRes.totalSpent);
      setBudgetOverallPct(budRes.overallPercentage);

      // 6. Transactions
      const txRes = await api.getTransactions({
        accountId: selectedAccountId || undefined,
        limit: 100,
      });
      setTransactions(txRes.transactions);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  }, [selectedPeriod, selectedAccountId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
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
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Welcome / Context Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 border border-slate-800/80 shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Financial Overview
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                {selectedAccountId
                  ? accounts.find((a) => a.id === selectedAccountId)?.name
                  : 'Consolidated (All Accounts)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Tracking cash flow, recurring expenses, and category budgets for{' '}
              <strong className="text-slate-300 font-semibold">{selectedPeriod}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 transition-all shadow"
            >
              <Upload className="w-3.5 h-3.5 text-brand-400" />
              <span>Import Bank CSV</span>
            </button>
            <button
              onClick={() => setIsBudgetsOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-brand-400 rounded-xl text-xs font-bold transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
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
              <div className="glass-card p-6 rounded-2xl flex flex-col h-[400px]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Recent Transactions</h2>
                    <p className="text-xs text-slate-400">Latest statement records</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className="flex items-center gap-1 text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    <span>View All ({transactions.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {transactions.slice(0, 6).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/40 hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tx.category_color || '#94a3b8' }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{tx.description}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{tx.date}</span>
                            <span>•</span>
                            <span className="text-slate-300">{tx.category_name || 'Uncategorized'}</span>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`text-xs font-bold flex-shrink-0 ml-2 ${
                          tx.amount < 0 ? 'text-rose-400' : 'text-emerald-400'
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

      {/* Modals */}
      <CsvUploaderModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
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
    </div>
  );
}

export default App;
