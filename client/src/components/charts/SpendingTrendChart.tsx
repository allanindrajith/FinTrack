import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendItem } from '../../types.js';

interface SpendingTrendChartProps {
  data: TrendItem[];
}

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({ data }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatPeriodLabel = (period: string) => {
    // Convert "2026-09" to "Sep 26"
    if (!period) return '';
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  if (!data || data.length === 0) {
    return (
      <div className="glass-card p-6 rounded-2xl flex flex-col items-center justify-center h-[400px] text-center">
        <div className="text-sm font-semibold text-slate-300">No Historical Trends Yet</div>
        <div className="text-xs text-slate-500 mt-1">Import multiple statements over time to see monthly trends.</div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-2xl flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Spending & Income Trends</h2>
          <p className="text-xs text-slate-400">Multi-month cash flow trajectory</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-brand-500" />
            <span className="text-slate-300 font-medium">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-slate-300 font-medium">Expenses</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

            <XAxis
              dataKey="period"
              tickFormatter={formatPeriodLabel}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v >= 1000 ? `${v / 1000}k` : v}`}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as TrendItem;
                  return (
                    <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-xl shadow-xl backdrop-blur-md">
                      <div className="text-xs font-bold text-slate-300 mb-2">
                        {formatPeriodLabel(item.period)}
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-brand-400 font-medium">Income:</span>
                          <span className="font-bold text-white">{formatCurrency(item.income)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-rose-400 font-medium">Expenses:</span>
                          <span className="font-bold text-white">{formatCurrency(item.expenses)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800 font-bold">
                          <span className="text-slate-400">Net Savings:</span>
                          <span className={item.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {formatCurrency(item.net)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Area
              type="monotone"
              dataKey="income"
              stroke="#22c55e"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#incomeGradient)"
            />

            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#f43f5e"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#expenseGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
