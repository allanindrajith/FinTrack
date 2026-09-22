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
  Settings as SettingsIcon,
  Sparkles,
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
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  onOpenAi: () => void;
  onLogout: () => void;
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
  onOpenAuth,
  onOpenSettings,
  onOpenAi,
  onLogout,
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
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#e8ebe6] bg-white/95 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#9fe870] flex items-center justify-center text-[#0e0f0c] shadow-sm">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-[900] tracking-tight text-[#0e0f0c]">
                      FinTrack
                    </span>
                    <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#e8ebe6] text-[#22720d] rounded-full border border-[#dce3d6]">
                      Zero-Knowledge
                    </span>
                  </div>
                </div>
              </div>

              {/* Nav Tabs (Only show on desktop lg+ when authenticated) */}
              {user && (
                <nav className="hidden lg:flex items-center gap-1 bg-[#e8ebe6] p-1 rounded-full flex-shrink-0">
                  <button
                    id="nav-tab-dashboard"
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
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
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
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
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      activeTab === 'subscriptions'
                        ? 'bg-white text-[#0e0f0c] shadow-sm font-bold'
                        : 'text-[#454745] hover:text-[#0e0f0c]'
                    }`}
                  >
                    Subscriptions
                  </button>
                </nav>
              )}
            </div>

            {/* Controls & Quick Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {user ? (
                <>
                  {/* Account Selector */}
                  <div className="relative flex items-center">
                    <Building className="w-3.5 h-3.5 text-[#5f655b] absolute left-2.5 pointer-events-none" />
                    <select
                      id="account-selector"
                      value={selectedAccountId}
                      onChange={(e) => onSelectAccount(e.target.value)}
                      aria-label="Filter by account"
                      className="pl-7 pr-6 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c] appearance-none cursor-pointer hover:bg-[#dbe0d8] transition-colors min-w-[135px] max-w-[180px] sm:max-w-[220px] truncate min-h-[38px]"
                    >
                      <option value="">All Accounts</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.currency})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Period Selector (Wide desktop only) */}
                  <div className="relative hidden 2xl:flex items-center">
                    <Calendar className="w-3.5 h-3.5 text-[#5f655b] absolute left-2.5 pointer-events-none" />
                    <select
                      id="period-selector"
                      value={selectedPeriod}
                      onChange={(e) => onSelectPeriod(e.target.value)}
                      aria-label="Filter by statement period"
                      className="pl-7 pr-6 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c] appearance-none cursor-pointer hover:bg-[#dbe0d8] transition-colors min-h-[38px]"
                    >
                      {periods.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* AI Insights Button (Desktop lg+ only - on mobile/tablet it is in bottom bar) */}
                  <button
                    id="btn-open-ai"
                    onClick={onOpenAi}
                    title="AI Financial Insights"
                    className="hidden lg:flex items-center gap-1.5 px-2.5 xl:px-3 py-2 bg-[#9fe870]/20 hover:bg-[#9fe870]/40 text-[#1e460d] border border-[#9fe870]/60 text-xs font-bold rounded-full transition-all min-h-[38px]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#1e460d]" />
                    <span className="hidden xl:inline">AI Insights</span>
                  </button>

                  {/* Primary Action Button: FinTrack Green CTA Pill (Desktop lg+ only - on mobile/tablet it is in bottom bar) */}
                  <button
                    id="btn-open-upload"
                    onClick={onOpenUpload}
                    title="Import CSV Statement"
                    className="hidden lg:flex items-center gap-1.5 px-3 xl:px-3.5 py-2 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm active:scale-95 transition-all min-h-[38px]"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#0e0f0c]" />
                    <span className="hidden xl:inline">Import CSV</span>
                  </button>

                  <button
                    id="btn-open-budgets"
                    onClick={onOpenBudgets}
                    title="Budgets"
                    className="hidden 2xl:flex items-center gap-1.5 px-3 py-2 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] text-xs font-semibold rounded-full transition-all min-h-[38px]"
                  >
                    <PieChart className="w-3.5 h-3.5 text-[#0e0f0c]" />
                    <span>Budgets</span>
                  </button>

                  <button
                    id="btn-open-rules"
                    onClick={onOpenRules}
                    title="Auto-Categorization Rules"
                    className="hidden 2xl:flex items-center gap-1.5 px-3 py-2 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] text-xs font-semibold rounded-full transition-all min-h-[38px]"
                  >
                    <Sliders className="w-3.5 h-3.5 text-[#0e0f0c]" />
                    <span>Rules</span>
                  </button>

                  <button
                    id="btn-open-add-account"
                    onClick={onOpenNewAccount}
                    title="Add Account"
                    className="hidden sm:flex p-2 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] rounded-full transition-all min-h-[38px] min-w-[38px] items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {/* Settings Button */}
                  <button
                    id="btn-open-settings"
                    onClick={onOpenSettings}
                    title="FinTrack Settings (Zero-Knowledge, Retention & AI)"
                    className="p-2 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] rounded-full transition-all min-h-[38px] min-w-[38px] flex items-center justify-center"
                  >
                    <SettingsIcon className="w-4 h-4" />
                  </button>

                  {/* User Profile & Logout */}
                  <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-[#e8ebe6]">
                    <button
                      onClick={onLogout}
                      title="Click to sign out"
                      className="group flex items-center gap-2 hover:bg-[#e8ebe6] p-1 sm:p-1.5 xl:px-3 xl:py-1.5 rounded-full transition-all min-h-[38px]"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#9fe870] flex items-center justify-center text-xs font-bold text-[#0e0f0c]">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="hidden xl:block text-left">
                        <div className="text-xs font-bold text-[#0e0f0c] leading-none">{user.name}</div>
                        <div className="text-[10px] text-[#5f655b] group-hover:text-[#d03238] transition-colors">Sign Out</div>
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    id="btn-nav-sign-in"
                    onClick={onOpenAuth}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#0e0f0c] hover:bg-[#232720] text-white text-xs font-bold rounded-full transition-all min-h-[38px]"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-[#9fe870]" />
                    <span>Sign In</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile/Tablet Bottom Navigation Bar (Screens < 1024px, >= 44px tap targets) */}
      {user && (
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e8ebe6] px-3 py-1.5 flex items-center justify-around shadow-modal"
        >
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[64px] rounded-xl transition-all ${
            activeTab === 'dashboard' ? 'text-[#0e0f0c] font-bold' : 'text-[#5f655b]'
          }`}
        >
          <div
            className={`p-1 rounded-full ${
              activeTab === 'dashboard' ? 'bg-[#9fe870]' : 'bg-transparent'
            }`}
          >
            <Wallet className="w-4 h-4 text-[#0e0f0c]" />
          </div>
          <span className="text-[10px] mt-0.5">Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[64px] rounded-xl transition-all ${
            activeTab === 'transactions' ? 'text-[#0e0f0c] font-bold' : 'text-[#5f655b]'
          }`}
        >
          <div
            className={`p-1 rounded-full ${
              activeTab === 'transactions' ? 'bg-[#9fe870]' : 'bg-transparent'
            }`}
          >
            <Sliders className="w-4 h-4 text-[#0e0f0c]" />
          </div>
          <span className="text-[10px] mt-0.5">Records</span>
        </button>

        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[64px] rounded-xl transition-all ${
            activeTab === 'subscriptions' ? 'text-[#0e0f0c] font-bold' : 'text-[#5f655b]'
          }`}
        >
          <div
            className={`p-1 rounded-full ${
              activeTab === 'subscriptions' ? 'bg-[#9fe870]' : 'bg-transparent'
            }`}
          >
            <PieChart className="w-4 h-4 text-[#0e0f0c]" />
          </div>
          <span className="text-[10px] mt-0.5">Recurring</span>
        </button>

        <button
          onClick={onOpenAi}
          className="flex flex-col items-center justify-center min-h-[48px] min-w-[64px] text-[#1e460d] font-bold rounded-xl"
        >
          <div className="p-1 rounded-full bg-[#9fe870]/30 border border-[#9fe870]">
            <Sparkles className="w-4 h-4 text-[#1e460d]" />
          </div>
          <span className="text-[10px] mt-0.5">AI Insights</span>
        </button>

        <button
          onClick={onOpenUpload}
          className="flex flex-col items-center justify-center min-h-[48px] min-w-[64px] text-[#0e0f0c] font-bold rounded-xl"
        >
          <div className="p-1 rounded-full bg-[#9fe870]">
            <Upload className="w-4 h-4 text-[#0e0f0c]" />
          </div>
          <span className="text-[10px] mt-0.5">Import</span>
        </button>
      </nav>
      )}
    </>
  );
};
