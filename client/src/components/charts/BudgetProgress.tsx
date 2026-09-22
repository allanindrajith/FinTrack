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
    <div className="wise-card p-6 rounded-[24px] flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-[900] text-[#0e0f0c] tracking-tight">Budget vs. Actual</h2>
          <p className="text-xs text-[#454745]">Monthly spending limits and utilization</p>
        </div>
        <button
          onClick={onOpenBudgetModal}
          className="flex items-center gap-1 text-xs font-bold text-[#0e0f0c] bg-[#e8ebe6] hover:bg-[#dbe0d8] px-3 py-1.5 rounded-full transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Set Budgets</span>
        </button>
      </div>

      {/* Overall Summary Box */}
      <div className="p-4 bg-[#e8ebe6] rounded-2xl mb-4">
        <div className="flex items-center justify-between text-xs mb-2 font-bold text-[#0e0f0c]">
          <span>Total Monthly Budget</span>
          <span>
            {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)} ({overallPercentage}%)
          </span>
        </div>
        <div className="w-full bg-white rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              overallPercentage > 100
                ? 'bg-[#d03238]'
                : overallPercentage >= 85
                ? 'bg-[#ffd11a]'
                : 'bg-[#2ead4b]'
            }`}
            style={{ width: `${Math.min(overallPercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Category Budget Items */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-center">
            <p className="text-xs text-[#868685]">No category budgets set for this month.</p>
            <button
              onClick={onOpenBudgetModal}
              className="mt-2 text-xs font-bold text-[#0e0f0c] underline"
            >
              + Add category budgets
            </button>
          </div>
        ) : (
          budgets.map((b) => (
            <div key={b.id} className="p-3 rounded-2xl bg-[#e8ebe6]/40 hover:bg-[#e8ebe6]/70 transition-colors">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: b.categoryColor }}
                  />
                  <span className="font-bold text-[#0e0f0c]">{b.categoryName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[#0e0f0c]">
                    {formatCurrency(b.spent)} / {formatCurrency(b.budgetAmount)}
                  </span>
                  {b.status === 'exceeded' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#a72027] bg-[#fce8e8] px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" /> Exceeded
                    </span>
                  )}
                  {b.status === 'warning' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#4a3b1c] bg-[#ffd11a]/30 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> Near limit
                    </span>
                  )}
                  {b.status === 'good' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#054d28] bg-[#e2f6d5] px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Good
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    b.percentage > 100
                      ? 'bg-[#d03238]'
                      : b.percentage >= 85
                      ? 'bg-[#ffd11a]'
                      : 'bg-[#2ead4b]'
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
