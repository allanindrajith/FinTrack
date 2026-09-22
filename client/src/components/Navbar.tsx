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
  const periods = [
    { value: '2026-09', label: 'Sep 2026' },
    { value: '2026-08', label: 'Aug 2026' },
    { value: '2026-07', label: 'Jul 2026' },
    { value: '2026-06', label: 'Jun 2026' },
    { value: '2026-05', label: 'May 2026' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#e8ebe6] bg-white/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-[#9fe870] flex items-center justify-center text-[#0e0f0c] shadow-sm">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-[900] tracking-tight text-[#0e0f0c]">
                  FinTrack
                </span>
              </div>
            </div>

            {/* Nav Tabs (Scandinavian fintech pill style) */}
            <nav className="hidden md:flex items-center gap-1 bg-[#e8ebe6] p-1 rounded-full">
              <button
                id="nav-tab-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-[#0e0f0c] shadow-sm font-bold'
                    : 'text-[#454745] hover:text-[#0e0f0c]'
                }`}
              >
                Dashboard
              </button>
              <button
                id="nav-tab-transactions"
                onClick={() => setActiveTab('transactions')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeTab === 'transactions'
                    ? 'bg-white text-[#0e0f0c] shadow-sm font-bold'
                    : 'text-[#454745] hover:text-[#0e0f0c]'
                }`}
              >
                Transactions
              </button>
              <button
                id="nav-tab-subscriptions"
                onClick={() => setActiveTab('subscriptions')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeTab === 'subscriptions'
                    ? 'bg-white text-[#0e0f0c] shadow-sm font-bold'
                    : 'text-[#454745] hover:text-[#0e0f0c]'
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
              <Building className="w-4 h-4 text-[#454745] absolute left-3 pointer-events-none" />
              <select
                id="account-selector"
                value={selectedAccountId}
                onChange={(e) => onSelectAccount(e.target.value)}
                aria-label="Filter by account"
                className="pl-8 pr-7 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c] appearance-none cursor-pointer hover:bg-[#dbe0d8] transition-colors"
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
              <Calendar className="w-4 h-4 text-[#454745] absolute left-3 pointer-events-none" />
              <select
                id="period-selector"
                value={selectedPeriod}
                onChange={(e) => onSelectPeriod(e.target.value)}
                aria-label="Filter by statement period"
                className="pl-8 pr-7 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c] appearance-none cursor-pointer hover:bg-[#dbe0d8] transition-colors"
              >
                {periods.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Primary Action Button: FinTrack Green CTA Pill */}
            <button
              id="btn-open-upload"
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm active:scale-95 transition-all"
            >
              <Upload className="w-3.5 h-3.5 text-[#0e0f0c]" />
              <span>Import CSV</span>
            </button>

            <button
              id="btn-open-budgets"
              onClick={onOpenBudgets}
              title="Budgets"
              className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] text-xs font-semibold rounded-full transition-all"
            >
              <PieChart className="w-3.5 h-3.5 text-[#0e0f0c]" />
              <span>Budgets</span>
            </button>

            <button
              id="btn-open-rules"
              onClick={onOpenRules}
              title="Auto-Categorization Rules"
              className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] text-xs font-semibold rounded-full transition-all"
            >
              <Sliders className="w-3.5 h-3.5 text-[#0e0f0c]" />
              <span>Rules</span>
            </button>

            <button
              id="btn-open-add-account"
              onClick={onOpenNewAccount}
              title="Add Account"
              className="p-2 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] rounded-full transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#e8ebe6]">
              <div className="w-8 h-8 rounded-full bg-[#e8ebe6] flex items-center justify-center text-xs font-bold text-[#0e0f0c]">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-bold text-[#0e0f0c]">{user?.name || 'Demo User'}</div>
                <div className="text-[10px] text-[#868685]">FinTrack Workspace</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
