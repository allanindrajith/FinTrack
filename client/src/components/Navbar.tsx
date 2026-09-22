import React from 'react';
import {
  Wallet,
  Upload,
  Sliders,
  PieChart,
  Plus,
  Calendar,
  Building,
  User as UserIcon,
} from 'lucide-react';
import { Account, User } from '../types.js';

interface NavbarProps {
  accounts: Account[];
  selectedAccountId: string;
  onSelectAccount: (id: string) => void;
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  onOpenUpload: () => void;
  onOpenRules: () => void;
  onOpenBudgets: () => void;
  onOpenNewAccount: () => void;
  user: User | null;
  activeTab: 'dashboard' | 'transactions' | 'subscriptions';
  setActiveTab: (tab: 'dashboard' | 'transactions' | 'subscriptions') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  selectedPeriod,
  onSelectPeriod,
  onOpenUpload,
  onOpenRules,
  onOpenBudgets,
  onOpenNewAccount,
  user,
  activeTab,
  setActiveTab,
}) => {
  // Available periods (last 6 months)
  const periods = [
    { value: '2026-09', label: 'Sep 2026' },
    { value: '2026-08', label: 'Aug 2026' },
    { value: '2026-07', label: 'Jul 2026' },
    { value: '2026-06', label: 'Jun 2026' },
    { value: '2026-05', label: 'May 2026' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 glow-brand flex items-center justify-center shadow-lg">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-brand-400" />
                </div>
              </div>
              <div>
                <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  FinTrack
                </span>
                <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-400 bg-brand-950/80 border border-brand-800/50 rounded">
                  v1.0
                </span>
              </div>
            </div>

            {/* Nav Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 border border-slate-800/80 p-1 rounded-xl">
              <button
                id="nav-tab-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-brand-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Dashboard
              </button>
              <button
                id="nav-tab-transactions"
                onClick={() => setActiveTab('transactions')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'transactions'
                    ? 'bg-brand-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Transactions
              </button>
              <button
                id="nav-tab-subscriptions"
                onClick={() => setActiveTab('subscriptions')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'subscriptions'
                    ? 'bg-brand-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Subscriptions
              </button>
            </nav>
          </div>

          {/* Controls & Quick Actions */}
          <div className="flex items-center gap-2.5">
            {/* Account Selector */}
            <div className="relative flex items-center">
              <Building className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                id="account-selector"
                value={selectedAccountId}
                onChange={(e) => onSelectAccount(e.target.value)}
                aria-label="Filter by account"
                className="pl-8 pr-8 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-brand-500 appearance-none cursor-pointer hover:bg-slate-800/50 transition-colors"
              >
                <option value="">All Accounts</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Period Selector */}
            <div className="relative hidden sm:flex items-center">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                id="period-selector"
                value={selectedPeriod}
                onChange={(e) => onSelectPeriod(e.target.value)}
                aria-label="Filter by statement period"
                className="pl-8 pr-8 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-brand-500 appearance-none cursor-pointer hover:bg-slate-800/50 transition-colors"
              >
                {periods.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <button
              id="btn-open-upload"
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg glow-brand transition-all active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>

            <button
              id="btn-open-budgets"
              onClick={onOpenBudgets}
              title="Budgets"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition-all"
            >
              <PieChart className="w-3.5 h-3.5 text-brand-400" />
              <span>Budgets</span>
            </button>

            <button
              id="btn-open-rules"
              onClick={onOpenRules}
              title="Auto-Categorization Rules"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition-all"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>Rules</span>
            </button>

            <button
              id="btn-open-add-account"
              onClick={onOpenNewAccount}
              title="Add Account"
              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* User Profile / Status */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-brand-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-semibold text-slate-200">{user?.name || 'Demo User'}</div>
                <div className="text-[10px] text-slate-500">Active Workspace</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
