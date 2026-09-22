import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
import { Budget } from '../../types.js';

interface BudgetProgressProps {
  budgets: Budget[];
  totalBudget: number;
  totalSpent: number;
  overallPercentage: number;
  onOpenBudgetModal: () => void;
}

export const BudgetProgress: React.FC<BudgetProgressProps> = ({
  budgets,
  totalBudget,
  totalSpent,
  overallPercentage,
  onOpenBudgetModal,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="glass-card p-6 rounded-2xl flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Budget vs. Actual</h2>
          <p className="text-xs text-slate-400">Monthly spending limits and utilization</p>
        </div>
        <button
          onClick={onOpenBudgetModal}
          className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Set Budgets</span>
        </button>
      </div>

      {/* Overall Summary Bar */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
          <span className="text-slate-300">Total Monthly Budget</span>
          <span className="text-white">
            {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)} ({overallPercentage}%)
          </span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              overallPercentage > 100
                ? 'bg-rose-500'
                : overallPercentage >= 85
                ? 'bg-amber-400'
                : 'bg-emerald-400'
            }`}
            style={{ width: `${Math.min(overallPercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Category Budget Items */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-xs text-slate-400">No category budgets set for this month.</p>
            <button
              onClick={onOpenBudgetModal}
              className="mt-2 text-xs font-bold text-brand-400 hover:underline"
            >
              + Add category budgets
            </button>
          </div>
        ) : (
          budgets.map((b) => (
            <div key={b.id} className="p-2.5 rounded-xl bg-slate-900/40 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: b.categoryColor }}
                  />
                  <span className="font-semibold text-slate-200">{b.categoryName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">
                    {formatCurrency(b.spent)} / {formatCurrency(b.budgetAmount)}
                  </span>
                  {b.status === 'exceeded' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-950/60 border border-rose-800/50 px-1.5 py-0.5 rounded">
                      <AlertCircle className="w-3 h-3" /> Exceeded
                    </span>
                  )}
                  {b.status === 'warning' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/50 px-1.5 py-0.5 rounded">
                      <AlertTriangle className="w-3 h-3" /> Near limit
                    </span>
                  )}
                  {b.status === 'good' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3" /> Good
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    b.percentage > 100
                      ? 'bg-rose-500'
                      : b.percentage >= 85
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(b.percentage, 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
