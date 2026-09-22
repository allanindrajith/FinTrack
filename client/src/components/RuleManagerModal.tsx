import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Sliders, CheckCircle } from 'lucide-react';
import { Category, CategoryRule } from '../types.js';
import { api } from '../services/api.js';

interface RuleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onRulesUpdated: () => void;
}

export const RuleManagerModal: React.FC<RuleManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onRulesUpdated,
}) => {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number>(categories[0]?.id || 1);
  const [pattern, setPattern] = useState('');
  const [matchType, setMatchType] = useState<'contains' | 'exact' | 'starts_with' | 'regex'>('contains');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen]);

  const loadRules = async () => {
    try {
      const res = await api.getRules();
      setRules(res.rules);
    } catch (err) {
      console.error('Failed to load rules:', err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return;

    try {
      const res = await api.createRule(selectedCategory, pattern.trim(), matchType);
      setPattern('');
      setStatusMessage(`Rule created! Updated ${res.updatedTransactionsCount} matching transactions.`);
      setTimeout(() => setStatusMessage(''), 4000);
      await loadRules();
      onRulesUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to create rule');
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      await api.deleteRule(id);
      await loadRules();
      onRulesUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to delete rule');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Auto-Categorization Rules</h2>
              <p className="text-xs text-slate-400">Manage rules that automatically categorize imported statements</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {statusMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Add Rule Form */}
          <form onSubmit={handleCreateRule} className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-wider">Add New Rule</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Target Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Match Type</label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="contains">Contains (e.g. UBER)</option>
                  <option value="starts_with">Starts With</option>
                  <option value="exact">Exact Match</option>
                  <option value="regex">Regular Expression</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Pattern / Keyword</label>
                <input
                  type="text"
                  placeholder="e.g. WHOLEFDS or NETFLIX"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add & Apply Rule</span>
              </button>
            </div>
          </form>

          {/* Rules List */}
          <div>
            <div className="text-xs font-bold text-slate-300 mb-2">Custom Rules ({rules.length})</div>
            {rules.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 border border-slate-800/80 rounded-xl">
                No custom rules created yet. Rules created here or from transaction recategorizations will appear here.
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: r.category_color || '#3b82f6' }}
                      />
                      <div>
                        <div className="text-xs font-bold text-white">
                          "{r.pattern}" <span className="font-normal text-slate-400">({r.match_type})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Assigned to: <strong className="text-slate-200">{r.category_name}</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRule(r.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
