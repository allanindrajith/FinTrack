import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CategoryBreakdownItem } from '../../types.js';

interface CategoryPieChartProps {
  data: CategoryBreakdownItem[];
  totalSpent: number;
}

// FinTrack Nordic fintech color palette
const FINTRACK_PALETTE = [
  '#9fe870', // FinTrack Green
  '#2ead4b', // Positive Green
  '#ffc091', // Accent Orange
  '#38c8ff', // Accent Cyan
  '#ffd11a', // Warning Yellow
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#163300', // Deep Forest
  '#454745', // Body Ink
  '#a72027', // Dark Red
];

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
      <div className="fintrack-card p-6 rounded-[24px] flex flex-col items-center justify-center h-[400px] text-center">
        <div className="w-12 h-12 rounded-full bg-[#e8ebe6] flex items-center justify-center text-[#454745] mb-3">
          📊
        </div>
        <div className="text-sm font-bold text-[#0e0f0c]">No Expenses Recorded</div>
        <div className="text-xs text-[#868685] mt-1 max-w-xs">
          Import a bank statement CSV to see your category spending breakdown.
        </div>
      </div>
    );
  }

  return (
    <div className="fintrack-card p-6 rounded-[24px] flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-[900] text-[#0e0f0c] tracking-tight">Spending by Category</h2>
          <p className="text-xs text-[#454745]">Distribution of expenses this period</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#868685] font-semibold uppercase tracking-wider">Total Outflow</div>
          <div className="text-xl font-[900] text-[#0e0f0c]">{formatCurrency(totalSpent)}</div>
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
                      <div className="bg-white border border-[#e8ebe6] p-3 rounded-2xl shadow-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs font-bold text-[#0e0f0c]">{item.categoryName}</span>
                        </div>
                        <div className="text-sm font-[900] text-[#0e0f0c]">
                          {formatCurrency(item.totalAmount)}
                        </div>
                        <div className="text-[11px] text-[#868685]">
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
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={FINTRACK_PALETTE[index % FINTRACK_PALETTE.length]}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-wider text-[#868685] font-bold">Total</span>
            <span className="text-base font-[900] text-[#0e0f0c]">{formatCurrency(totalSpent)}</span>
          </div>
        </div>

        {/* Legend List */}
        <div className="w-full md:w-1/2 overflow-y-auto max-h-56 pr-2 space-y-2">
          {data.map((cat, index) => (
            <div
              key={cat.categoryId}
              className="flex items-center justify-between p-2 rounded-xl bg-[#e8ebe6]/50 hover:bg-[#e8ebe6] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: FINTRACK_PALETTE[index % FINTRACK_PALETTE.length] }}
                />
                <span className="text-xs font-semibold text-[#0e0f0c] truncate">
                  {cat.categoryName}
                </span>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="text-xs font-[900] text-[#0e0f0c]">{formatCurrency(cat.totalAmount)}</div>
                <div className="text-[10px] text-[#868685]">{cat.percentage}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
