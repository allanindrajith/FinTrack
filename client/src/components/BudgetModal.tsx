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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Monthly Category Budgets</h2>
              <p className="text-xs text-slate-400">Set target spending limits for {period}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {success && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Budgets saved successfully!</span>
            </div>
          )}

          <div className="space-y-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded-xl"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs font-semibold text-white">{cat.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">$</span>
                  <input
                    type="number"
                    step="10"
                    placeholder="0"
                    value={budgetValues[cat.id] || ''}
                    onChange={(e) =>
                      setBudgetValues({ ...budgetValues, [cat.id]: e.target.value })
                    }
                    className="w-28 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-brand-500 text-right"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg glow-brand transition-all"
            >
              {saving ? 'Saving...' : 'Save Budgets'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
