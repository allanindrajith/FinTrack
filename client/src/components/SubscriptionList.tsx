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
        <div className="fintrack-card p-6 rounded-[24px]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#868685]">
            Detected Subscriptions
          </div>
          <div className="text-3xl font-[900] text-[#0e0f0c] mt-2">
            {subscriptions.length}
          </div>
          <div className="text-xs text-[#454745] mt-1 font-medium">
            Charges recurring with regular ~30 day interval
          </div>
        </div>

        <div className="fintrack-card p-6 rounded-[24px]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#6b21a8]">
            Monthly Burn Rate
          </div>
          <div className="text-3xl font-[900] text-[#6b21a8] mt-2">
            {formatCurrency(monthlyTotal)}
          </div>
          <div className="text-xs text-[#454745] mt-1 font-medium">
            Expected monthly outflow for recurring services
          </div>
        </div>

        <div className="fintrack-card p-6 rounded-[24px]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#054d28]">
            Annual Projected
          </div>
          <div className="text-3xl font-[900] text-[#054d28] mt-2">
            {formatCurrency(annualProjected)}
          </div>
          <div className="text-xs text-[#454745] mt-1 font-medium">
            Annualized cost if all subscriptions continue
          </div>
        </div>
      </div>

      {/* Subscription Cards Grid */}
      <div className="fintrack-card rounded-[24px] p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-[900] text-[#0e0f0c] tracking-tight">Recurring Subscriptions & Services</h2>
            <p className="text-xs text-[#454745]">
              Identified by FinTrack's pattern recognition engine across statement history
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#e2f6d5] rounded-full text-xs font-bold text-[#054d28]">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Auto-Detector Active</span>
          </div>
        </div>

        {subscriptions.length === 0 ? (
          <div className="text-center py-16 text-[#868685]">
            <AlertCircle className="w-8 h-8 text-[#868685] mx-auto mb-2" />
            <div className="text-sm font-bold text-[#0e0f0c]">No recurring subscriptions detected yet</div>
            <div className="text-xs text-[#868685] mt-1 max-w-sm mx-auto">
              As you import more monthly statements, transactions repeating at similar amounts every 28-32 days will automatically show up here.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subscriptions.map((sub, index) => (
              <div
                key={index}
                className="p-5 rounded-[20px] bg-[#e8ebe6]/40 hover:bg-[#e8ebe6] transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-[900] text-[#0e0f0c] truncate">{sub.merchant}</div>
                    <div className="text-[11px] text-[#454745] flex items-center gap-1.5 mt-0.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-[#9fe870]" />
                      <span>{sub.category}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-[900] text-[#0e0f0c]">{formatCurrency(sub.averageAmount)}</div>
                    <div className="text-[10px] text-[#868685] uppercase font-bold">/ month</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#e8ebe6] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#868685] block text-[11px]">Last Billed</span>
                    <span className="text-[#0e0f0c] font-semibold flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-[#868685]" />
                      {sub.lastDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#868685] block text-[11px]">Est. Renewal</span>
                    <span className="text-[#054d28] font-bold flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-[#2ead4b]" />
                      {sub.nextEstimatedDate}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-[#868685] font-medium">
                  <span>Occurrences: {sub.occurrences} statements</span>
                  <span className="text-[#0e0f0c] font-bold">~{formatCurrency(sub.averageAmount * 12)} / year</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
