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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0e0f0c]/50 backdrop-blur-sm">
      <div className="bg-white border border-[#e8ebe6] rounded-[24px] w-full max-w-2xl overflow-hidden shadow-modal animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8ebe6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#9fe870] flex items-center justify-center text-[#0e0f0c]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-[900] text-[#0e0f0c]">Auto-Categorization Rules</h2>
              <p className="text-xs text-[#454745]">Manage rules that automatically categorize imported statements</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#868685] hover:text-[#0e0f0c] rounded-full hover:bg-[#e8ebe6]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {statusMessage && (
            <div className="p-3.5 bg-[#e2f6d5] border border-[#2ead4b]/30 rounded-2xl text-xs text-[#054d28] font-bold flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Add Rule Form */}
          <form onSubmit={handleCreateRule} className="p-5 bg-[#e8ebe6]/50 border border-[#e8ebe6] rounded-2xl space-y-3">
            <div className="text-xs font-[900] text-[#0e0f0c] uppercase tracking-wider">Add New Rule</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#0e0f0c] mb-1">Target Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white rounded-xl text-xs font-semibold text-[#0e0f0c] border border-[#e8ebe6]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#0e0f0c] mb-1">Match Type</label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white rounded-xl text-xs font-semibold text-[#0e0f0c] border border-[#e8ebe6]"
                >
                  <option value="contains">Contains (e.g. UBER)</option>
                  <option value="starts_with">Starts With</option>
                  <option value="exact">Exact Match</option>
                  <option value="regex">Regular Expression</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#0e0f0c] mb-1">Pattern / Keyword</label>
                <input
                  type="text"
                  placeholder="e.g. WHOLEFDS or NETFLIX"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-xl text-xs font-semibold text-[#0e0f0c] border border-[#e8ebe6] placeholder-[#868685] focus:outline-none focus:border-[#0e0f0c]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add & Apply Rule</span>
              </button>
            </div>
          </form>

          {/* Rules List */}
          <div>
            <div className="text-xs font-[900] text-[#0e0f0c] mb-2.5 uppercase tracking-wider">Custom Rules ({rules.length})</div>
            {rules.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#868685] border border-[#e8ebe6] rounded-2xl">
                No custom rules created yet. Rules created here or from transaction recategorizations will appear here.
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3.5 bg-[#e8ebe6]/40 border border-[#e8ebe6] rounded-2xl"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: r.category_color || '#9fe870' }}
                      />
                      <div>
                        <div className="text-xs font-bold text-[#0e0f0c]">
                          "{r.pattern}" <span className="font-normal text-[#454745]">({r.match_type})</span>
                        </div>
                        <div className="text-[11px] text-[#454745] mt-0.5">
                          Assigned to: <strong className="text-[#0e0f0c]">{r.category_name}</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRule(r.id)}
                      className="p-1.5 text-[#868685] hover:text-[#d03238] rounded-full hover:bg-[#fce8e8] transition-colors"
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
