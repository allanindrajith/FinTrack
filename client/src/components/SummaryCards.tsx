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
  isDecrypting?: boolean;
  onOpenUpload?: () => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  subscriptionMonthlyTotal,
  subscriptionCount,
  isDecrypting = false,
  onOpenUpload,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  if (isDecrypting) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="fintrack-card p-6 rounded-[24px] animate-pulse bg-white border border-[#e8ebe6] h-[132px] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-[#e8ebe6] rounded-full" />
              <div className="w-8 h-8 rounded-full bg-[#e8ebe6]" />
            </div>
            <div className="space-y-2">
              <div className="h-6 w-28 bg-[#e8ebe6] rounded-lg" />
              <div className="h-2.5 w-16 bg-[#e8ebe6] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const income = summary?.totalIncome || 0;
  const expenses = summary?.totalExpenses || 0;
  const netSavings = summary?.netSavings || 0;
  const savingsRate = summary?.savingsRate || 0;

  return (
    <div className="space-y-4">
      {summary && summary.transactionCount === 0 && onOpenUpload && (
        <div className="p-4 rounded-[20px] bg-[#9fe870]/20 border border-[#9fe870]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">💡</span>
            <div>
              <div className="text-xs font-bold text-[#0e0f0c]">No transactions recorded for this period</div>
              <div className="text-[11px] text-[#454745]">Upload your Chase, Revolut, or generic bank statement CSV to populate your cash flow metrics.</div>
            </div>
          </div>
          <button
            onClick={onOpenUpload}
            className="flex-shrink-0 px-4 py-2 bg-[#9fe870] hover:bg-[#8ee05d] text-[#0e0f0c] text-xs font-extrabold rounded-full shadow-xs transition-all"
          >
            Import Bank Statement
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Net Cash Flow */}
      <div className="fintrack-card fintrack-card-hover p-6 rounded-[24px] relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#5f655b]">Net Cash Flow</span>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${netSavings >= 0 ? 'bg-[#e2f6d5] text-[#054d28]' : 'bg-[#fce8e8] text-[#a72027]'}`}>
            {netSavings >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </div>
        </div>
        <div className="mt-4">
          <div className={`text-2xl font-[900] tracking-tight ${netSavings >= 0 ? 'text-[#054d28]' : 'text-[#a72027]'}`}>
            {netSavings >= 0 ? `+${formatCurrency(netSavings)}` : formatCurrency(netSavings)}
          </div>
          <div className="mt-1 text-xs text-[#454745] flex items-center gap-1.5 font-medium">
            <span>Income vs Expenses</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${netSavings >= 0 ? 'bg-[#e2f6d5] text-[#054d28]' : 'bg-[#fce8e8] text-[#a72027]'}`}>
              {netSavings >= 0 ? 'Surplus' : 'Deficit'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Total Income */}
      <div className="fintrack-card fintrack-card-hover p-6 rounded-[24px] relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#5f655b]">Total Income</span>
          <div className="w-8 h-8 rounded-full bg-[#e2f6d5] text-[#054d28] flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-2xl font-[900] tracking-tight text-[#0e0f0c]">
            {formatCurrency(income)}
          </div>
          <div className="mt-1 text-xs text-[#454745] font-medium">
            Deposits & Salary
          </div>
        </div>
      </div>

      {/* 3. Total Expenses */}
      <div className="fintrack-card fintrack-card-hover p-6 rounded-[24px] relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#5f655b]">Total Expenses</span>
          <div className="w-8 h-8 rounded-full bg-[#fce8e8] text-[#a72027] flex items-center justify-center">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-2xl font-[900] tracking-tight text-[#0e0f0c]">
            {formatCurrency(expenses)}
          </div>
          <div className="mt-1 text-xs text-[#454745] font-medium">
            Outflow this period
          </div>
        </div>
      </div>

      {/* 4. Savings Rate */}
      <div className="fintrack-card fintrack-card-hover p-6 rounded-[24px] relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#5f655b]">Savings Rate</span>
          <div className="w-8 h-8 rounded-full bg-[#e8ebe6] text-[#0e0f0c] flex items-center justify-center">
            <Percent className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-2xl font-[900] tracking-tight text-[#0e0f0c]">
            {savingsRate}%
          </div>
          <div className="mt-1 text-xs text-[#454745] font-medium">
            {savingsRate >= 20 ? 'Target achieved (≥20%)' : 'Below target'}
          </div>
        </div>
      </div>

      {/* 5. Subscriptions Burn */}
      <div className="fintrack-card fintrack-card-hover p-6 rounded-[24px] relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#5f655b]">Subscriptions</span>
          <div className="w-8 h-8 rounded-full bg-[#f5e8fc] text-[#6b21a8] flex items-center justify-center">
            <RefreshCw className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-2xl font-[900] tracking-tight text-[#0e0f0c]">
            {formatCurrency(subscriptionMonthlyTotal)}
            <span className="text-xs text-[#5f655b] font-normal ml-1">/mo</span>
          </div>
          <div className="mt-1 text-xs text-[#454745] font-medium">
            {subscriptionCount} active detected
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
