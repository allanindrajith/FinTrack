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
    if (!period) return '';
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  if (!data || data.length === 0) {
    return (
      <div className="fintrack-card p-6 rounded-[24px] flex flex-col items-center justify-center h-[400px] text-center">
        <div className="text-sm font-bold text-[#0e0f0c]">No Historical Trends Yet</div>
        <div className="text-xs text-[#868685] mt-1">Import multiple statements over time to see monthly trends.</div>
      </div>
    );
  }

  return (
    <div className="fintrack-card p-6 rounded-[24px] flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-[900] text-[#0e0f0c] tracking-tight">Spending & Income Trends</h2>
          <p className="text-xs text-[#454745]">Multi-month cash flow trajectory</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#2ead4b]" />
            <span className="text-[#0e0f0c]">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#d03238]" />
            <span className="text-[#0e0f0c]">Expenses</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2ead4b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2ead4b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d03238" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#d03238" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e8ebe6" vertical={false} />

            <XAxis
              dataKey="period"
              tickFormatter={formatPeriodLabel}
              stroke="#868685"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              stroke="#868685"
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
                    <div className="bg-white border border-[#e8ebe6] p-3 rounded-2xl shadow-xl">
                      <div className="text-xs font-bold text-[#0e0f0c] mb-2">
                        {formatPeriodLabel(item.period)}
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#054d28] font-semibold">Income:</span>
                          <span className="font-[900] text-[#0e0f0c]">{formatCurrency(item.income)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#a72027] font-semibold">Expenses:</span>
                          <span className="font-[900] text-[#0e0f0c]">{formatCurrency(item.expenses)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-[#e8ebe6] font-bold">
                          <span className="text-[#454745]">Net Savings:</span>
                          <span className={item.net >= 0 ? 'text-[#054d28]' : 'text-[#a72027]'}>
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
              stroke="#2ead4b"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#incomeGradient)"
            />

            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#d03238"
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
