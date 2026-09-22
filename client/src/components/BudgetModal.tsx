import React, { useState, useEffect } from 'react';
import { X, PieChart, Check } from 'lucide-react';
import { Budget, Category } from '../types.js';
import { api } from '../services/api.js';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  period: string;
  onBudgetsUpdated: () => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  categories,
  period,
  onBudgetsUpdated,
}) => {
  const [budgetValues, setBudgetValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCurrentBudgets();
    }
  }, [isOpen, period]);

  const loadCurrentBudgets = async () => {
    try {
      const res = await api.getBudgets(period);
      const map: Record<number, string> = {};
      res.budgets.forEach((b: Budget) => {
        map[b.categoryId] = String(b.budgetAmount);
      });
      setBudgetValues(map);
    } catch (err) {
      console.error('Failed to load budgets:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      for (const [catId, val] of Object.entries(budgetValues)) {
        const num = parseFloat(val);
        if (!isNaN(num) && num >= 0) {
          await api.setBudget(Number(catId), num, period);
        }
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onBudgetsUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to save budgets');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0e0f0c]/50 backdrop-blur-sm">
      <div className="bg-white border border-[#e8ebe6] rounded-[24px] w-full max-w-xl overflow-hidden shadow-modal animate-in zoom-in-95">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8ebe6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#9fe870] flex items-center justify-center text-[#0e0f0c]">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-[900] text-[#0e0f0c]">Monthly Category Budgets</h2>
              <p className="text-xs text-[#454745]">Set target spending limits for {period}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#868685] hover:text-[#0e0f0c] rounded-full hover:bg-[#e8ebe6]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {success && (
            <div className="p-3.5 bg-[#e2f6d5] border border-[#2ead4b]/30 rounded-2xl text-xs text-[#054d28] font-bold flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Budgets saved successfully!</span>
            </div>
          )}

          <div className="space-y-2.5">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3.5 bg-[#e8ebe6]/40 border border-[#e8ebe6] rounded-2xl"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs font-bold text-[#0e0f0c]">{cat.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#868685]">$</span>
                  <input
                    type="number"
                    step="10"
                    placeholder="0"
                    value={budgetValues[cat.id] || ''}
                    onChange={(e) =>
                      setBudgetValues({ ...budgetValues, [cat.id]: e.target.value })
                    }
                    className="w-32 px-3 py-1.5 bg-white border border-[#e8ebe6] rounded-xl text-xs font-[900] text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c] text-right"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#e8ebe6]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-[#454745] hover:text-[#0e0f0c]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm transition-all"
            >
              {saving ? 'Saving...' : 'Save Budgets'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
