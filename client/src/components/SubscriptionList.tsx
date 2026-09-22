import React from 'react';
import { RefreshCw, Calendar, AlertCircle } from 'lucide-react';
import { SubscriptionItem } from '../types.js';

interface SubscriptionListProps {
  subscriptions: SubscriptionItem[];
  monthlyTotal: number;
  annualProjected: number;
}

export const SubscriptionList: React.FC<SubscriptionListProps> = ({
  subscriptions,
  monthlyTotal,
  annualProjected,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Detected Subscriptions
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {subscriptions.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Charges recurring with regular ~30 day interval
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-400">
            Monthly Burn Rate
          </div>
          <div className="text-3xl font-black text-purple-400 mt-2">
            {formatCurrency(monthlyTotal)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Expected monthly outflow for recurring services
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Annual Projected
          </div>
          <div className="text-3xl font-black text-indigo-400 mt-2">
            {formatCurrency(annualProjected)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Annualized cost if all subscriptions continue
          </div>
        </div>
      </div>

      {/* Subscription Cards Grid */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Recurring Subscriptions & Services</h2>
            <p className="text-xs text-slate-400">
              Identified by FinTrack's pattern recognition engine across statement history
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-950/60 border border-purple-800/50 rounded-xl text-xs font-bold text-purple-300">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Auto-Detector Active</span>
          </div>
        </div>

        {subscriptions.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-300">No recurring subscriptions detected yet</div>
            <div className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              As you import more monthly statements, transactions repeating at similar amounts every 28-32 days will automatically show up here.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subscriptions.map((sub, index) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{sub.merchant}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>{sub.category}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-white">{formatCurrency(sub.averageAmount)}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">/ month</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Last Billed</span>
                    <span className="text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {sub.lastDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Est. Next Renewal</span>
                    <span className="text-brand-400 font-bold flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-brand-400" />
                      {sub.nextEstimatedDate}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Occurrences: {sub.occurrences} statements</span>
                  <span className="text-slate-400">~{formatCurrency(sub.averageAmount * 12)} / year</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
