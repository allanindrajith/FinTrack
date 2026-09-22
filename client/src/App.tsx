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
      const sum = await api.getSummary(selectedPeriod, selectedAccountId || undefined);
      setSummary(sum);

      const catBreakdown = await api.getCategoryBreakdown(selectedPeriod, selectedAccountId || undefined);
      setCategoryBreakdown(catBreakdown.breakdown);
      setTotalSpent(catBreakdown.totalSpent);

      const trendRes = await api.getTrends(6, selectedAccountId || undefined);
      setTrends(trendRes.trends);

      const subRes = await api.getSubscriptions(selectedAccountId || undefined);
      setSubscriptions(subRes.subscriptions);
      setSubMonthlyTotal(subRes.monthlyTotal);
      setSubAnnual(subRes.annualProjected);

      const budRes = await api.getBudgets(selectedPeriod);
      setBudgets(budRes.budgets);
      setTotalBudget(budRes.totalBudget);
      setBudgetSpent(budRes.totalSpent);
      setBudgetOverallPct(budRes.overallPercentage);

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
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Signature Wise Hero Banner */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-8 rounded-[24px] bg-white border border-[#e8ebe6] shadow-card">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#e2f6d5] text-[#054d28]">
                {selectedAccountId
                  ? accounts.find((a) => a.id === selectedAccountId)?.name
                  : 'Consolidated Accounts'}
              </span>
              <span className="text-xs text-[#868685] font-semibold">• {selectedPeriod}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-[900] text-[#0e0f0c] tracking-tight leading-tight">
              Personal wealth without borders.
            </h1>
            <p className="text-sm text-[#454745] font-normal leading-relaxed">
              Consolidated cash flow, automatic statement normalization, and recurring subscription tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm active:scale-95 transition-all"
            >
              <Upload className="w-4 h-4 text-[#0e0f0c]" />
              <span>Import Bank CSV</span>
            </button>
            <button
              onClick={() => setIsBudgetsOpen(true)}
              className="flex items-center gap-1.5 px-5 py-3 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] font-bold text-xs rounded-full transition-all"
            >
              <Sparkles className="w-4 h-4 text-[#0e0f0c]" />
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
              <div className="wise-card p-6 rounded-[24px] flex flex-col h-[400px]">
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
                          <div className="text-[11px] text-[#868685] flex items-center gap-2 mt-0.5">
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
