import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CategoryBreakdownItem } from '../../types.js';

interface CategoryPieChartProps {
  data: CategoryBreakdownItem[];
  totalSpent: number;
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data, totalSpent }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (!data || data.length === 0) {
    return (
      <div className="glass-card p-6 rounded-2xl flex flex-col items-center justify-center h-[380px] text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
          📊
        </div>
        <div className="text-sm font-semibold text-slate-300">No Expenses Recorded</div>
        <div className="text-xs text-slate-500 mt-1 max-w-xs">
          Import a bank statement CSV to see your category spending breakdown.
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-2xl flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Spending by Category</h2>
          <p className="text-xs text-slate-400">Distribution of expenses this period</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400 font-medium">Total Outflow</div>
          <div className="text-lg font-extrabold text-white">{formatCurrency(totalSpent)}</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row items-center gap-6">
        {/* Donut Chart */}
        <div className="w-full md:w-1/2 h-56 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as CategoryBreakdownItem;
                    return (
                      <div className="bg-slate-900/95 border border-slate-700/80 p-2.5 rounded-xl shadow-xl backdrop-blur-md">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs font-bold text-white">{item.categoryName}</span>
                        </div>
                        <div className="text-sm font-extrabold text-brand-400">
                          {formatCurrency(item.totalAmount)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.percentage}% of spending ({item.transactionCount} txns)
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="totalAmount"
                nameKey="categoryName"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || '#3b82f6'}
                    stroke="#0f172a"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Total</span>
            <span className="text-sm font-black text-white">{formatCurrency(totalSpent)}</span>
          </div>
        </div>

        {/* Legend List */}
        <div className="w-full md:w-1/2 overflow-y-auto max-h-56 pr-2 space-y-2">
          {data.map((cat) => (
            <div
              key={cat.categoryId}
              className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {cat.categoryName}
                </span>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="text-xs font-bold text-white">{formatCurrency(cat.totalAmount)}</div>
                <div className="text-[10px] text-slate-400">{cat.percentage}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
