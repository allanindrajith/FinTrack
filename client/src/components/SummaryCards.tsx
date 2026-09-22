import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  RefreshCw,
} from 'lucide-react';
import { CashFlowSummary } from '../types.js';

interface SummaryCardsProps {
  summary: CashFlowSummary | null;
  subscriptionMonthlyTotal: number;
  subscriptionCount: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  subscriptionMonthlyTotal,
  subscriptionCount,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const income = summary?.totalIncome || 0;
  const expenses = summary?.totalExpenses || 0;
  const netSavings = summary?.netSavings || 0;
  const savingsRate = summary?.savingsRate || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Net Cash Flow */}
      <div className="glass-card glass-card-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Net Cash Flow</span>
          <div className={`p-2 rounded-xl ${netSavings >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {netSavings >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </div>
        </div>
        <div className="mt-3">
          <div className={`text-2xl font-black tracking-tight ${netSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netSavings >= 0 ? `+${formatCurrency(netSavings)}` : formatCurrency(netSavings)}
          </div>
          <div className="mt-1 text-xs text-slate-400 flex items-center gap-1">
            <span>Income vs Expenses</span>
            <span className={`font-semibold ${netSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ({netSavings >= 0 ? 'Surplus' : 'Deficit'})
            </span>
          </div>
        </div>
        <div className={`absolute bottom-0 left-0 right-0 h-1 ${netSavings >= 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-red-400'}`} />
      </div>

      {/* 2. Total Income */}
      <div className="glass-card glass-card-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Income</span>
          <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black tracking-tight text-white">
            {formatCurrency(income)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Deposits & Salary
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 to-emerald-400" />
      </div>

      {/* 3. Total Expenses */}
      <div className="glass-card glass-card-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Expenses</span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black tracking-tight text-white">
            {formatCurrency(expenses)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Outflow this period
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
      </div>

      {/* 4. Savings Rate */}
      <div className="glass-card glass-card-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Savings Rate</span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <Percent className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black tracking-tight text-blue-400">
            {savingsRate}%
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {savingsRate >= 20 ? 'Target achieved (≥20%)' : 'Below target'}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
      </div>

      {/* 5. Subscriptions Burn */}
      <div className="glass-card glass-card-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Subscriptions</span>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <RefreshCw className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black tracking-tight text-purple-400">
            {formatCurrency(subscriptionMonthlyTotal)}
            <span className="text-xs text-slate-400 font-normal ml-1">/mo</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {subscriptionCount} active detected
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-violet-500" />
      </div>
    </div>
  );
};
