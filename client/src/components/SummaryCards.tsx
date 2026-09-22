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
      <div className="fintrack-card fintrack-card-hover p-6 rounded-[24px] relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#868685]">Net Cash Flow</span>
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
          <span className="text-xs font-bold uppercase tracking-wider text-[#868685]">Total Income</span>
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
          <span className="text-xs font-bold uppercase tracking-wider text-[#868685]">Total Expenses</span>
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
          <span className="text-xs font-bold uppercase tracking-wider text-[#868685]">Savings Rate</span>
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
          <span className="text-xs font-bold uppercase tracking-wider text-[#868685]">Subscriptions</span>
          <div className="w-8 h-8 rounded-full bg-[#f5e8fc] text-[#6b21a8] flex items-center justify-center">
            <RefreshCw className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-2xl font-[900] tracking-tight text-[#0e0f0c]">
            {formatCurrency(subscriptionMonthlyTotal)}
            <span className="text-xs text-[#868685] font-normal ml-1">/mo</span>
          </div>
          <div className="mt-1 text-xs text-[#454745] font-medium">
            {subscriptionCount} active detected
          </div>
        </div>
      </div>
    </div>
  );
};
