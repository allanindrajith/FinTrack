import React, { useState } from 'react';
import {
  Search,
  Trash2,
  Tag,
  Check,
  Building,
} from 'lucide-react';
import { Account, Category, Transaction } from '../types.js';
import { api } from '../services/api.js';

interface TransactionTableProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onRefresh: () => void;
  selectedAccountId: string;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  categories,
  accounts,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'debit' | 'credit'>('all');
  const [editingTxId, setEditingTxId] = useState<number | null>(null);

  // Recategorization prompt state
  const [rulePromptTx, setRulePromptTx] = useState<Transaction | null>(null);
  const [pendingCategoryId, setPendingCategoryId] = useState<number | null>(null);
  const [customPattern, setCustomPattern] = useState<string>('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  // Filter and sort transactions
  const filtered = transactions.filter((t) => {
    if (searchTerm) {
      const matchDesc = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchOrig = (t.original_description || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchDesc && !matchOrig) return false;
    }
    if (selectedCategory && String(t.category_id) !== selectedCategory) {
      return false;
    }
    if (selectedAccount && t.account_id !== selectedAccount) {
      return false;
    }
    if (selectedType !== 'all' && t.type !== selectedType) {
      return false;
    }
    return true;
  });

  const handleCategoryChangeClick = (tx: Transaction, newCatId: number) => {
    if (tx.category_id === newCatId) {
      setEditingTxId(null);
      return;
    }

    setRulePromptTx(tx);
    setPendingCategoryId(newCatId);
    const pattern = tx.description.split(/[\s*#-]/)[0].toUpperCase();
    setCustomPattern(pattern || tx.description.toUpperCase());
    setEditingTxId(null);
  };

  const handleConfirmRecategorization = async (createRule: boolean) => {
    if (!rulePromptTx || pendingCategoryId === null) return;

    try {
      await api.recategorizeTransaction(
        rulePromptTx.id,
        pendingCategoryId,
        createRule,
        createRule ? customPattern : undefined
      );
      onRefresh();
    } catch (err) {
      console.error('Failed to recategorize transaction:', err);
    } finally {
      setRulePromptTx(null);
      setPendingCategoryId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        await api.deleteTransaction(id);
        onRefresh();
      } catch (err) {
        console.error('Failed to delete transaction:', err);
      }
    }
  };

  return (
    <div className="fintrack-card rounded-[24px] overflow-hidden">
      {/* Table Header & Controls */}
      <div className="p-5 border-b border-[#e8ebe6] bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-[900] text-[#0e0f0c] tracking-tight">Transactions & Statement Records</h2>
          <p className="text-xs text-[#454745]">
            {filtered.length} transactions displayed • Click any category pill to recategorize
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#868685] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search description, merchant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-medium text-[#0e0f0c] placeholder-[#868685] focus:outline-none focus:border-[#0e0f0c]"
            />
          </div>

          {/* Account Filter */}
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            aria-label="Filter by account"
            className="px-3 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c]"
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
            className="px-3 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            aria-label="Filter by transaction type"
            className="px-3 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c]"
          >
            <option value="all">All Types</option>
            <option value="debit">Expenses Only</option>
            <option value="credit">Income Only</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#e8ebe6] text-[#454745] border-b border-[#e8ebe6] uppercase tracking-wider font-bold text-[11px]">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Account</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-center w-12">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8ebe6]/80 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[#868685]">
                  No transactions match your current filters.
                </td>
              </tr>
            ) : (
              filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#e8ebe6]/40 transition-colors group">
                  {/* Date */}
                  <td className="px-5 py-3.5 font-mono font-medium text-[#454745] whitespace-nowrap">
                    {tx.date}
                  </td>

                  {/* Description */}
                  <td className="px-5 py-3.5 font-semibold text-[#0e0f0c] max-w-xs truncate">
                    <div className="truncate">{tx.description}</div>
                    {tx.original_description && tx.original_description !== tx.description && (
                      <div className="text-[10px] text-[#868685] truncate font-normal" title={tx.original_description}>
                        Raw: {tx.original_description}
                      </div>
                    )}
                  </td>

                  {/* Account */}
                  <td className="px-5 py-3.5 text-[#454745] whitespace-nowrap">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Building className="w-3.5 h-3.5 text-[#868685]" />
                      <span>{tx.account_name || 'Account'}</span>
                    </span>
                  </td>

                  {/* Category (Interactive Recategorization Pill) */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    {editingTxId === tx.id ? (
                      <select
                        autoFocus
                        defaultValue={tx.category_id || ''}
                        onChange={(e) => handleCategoryChangeClick(tx, Number(e.target.value))}
                        onBlur={() => setEditingTxId(null)}
                        className="px-2.5 py-1 bg-white border-2 border-[#0e0f0c] rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingTxId(tx.id)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#e8ebe6] hover:bg-[#dbe0d8] transition-all text-[#0e0f0c]"
                        title="Click to recategorize"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: tx.category_color || '#9fe870' }}
                        />
                        <span>{tx.category_name || 'Uncategorized'}</span>
                        <Tag className="w-2.5 h-2.5 text-[#868685] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </td>

                  {/* Amount */}
                  <td
                    className={`px-5 py-3.5 text-right font-[900] text-sm whitespace-nowrap ${
                      tx.amount < 0 ? 'text-[#a72027]' : 'text-[#054d28]'
                    }`}
                  >
                    {tx.amount < 0 ? `-${formatCurrency(Math.abs(tx.amount))}` : `+${formatCurrency(tx.amount)}`}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-center whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(tx.id)}
                      title="Delete transaction"
                      className="p-1.5 text-[#868685] hover:text-[#d03238] rounded-full hover:bg-[#fce8e8] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recategorization & Learning Rule Prompt Modal */}
      {rulePromptTx && pendingCategoryId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0e0f0c]/50 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-md p-6 space-y-4 shadow-modal border border-[#e8ebe6] animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#e2f6d5] text-[#054d28] flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-[900] text-[#0e0f0c]">Remember for Future Imports?</h3>
                <p className="text-xs text-[#454745]">
                  Assigned to <strong className="text-[#0e0f0c]">{categories.find((c) => c.id === pendingCategoryId)?.name}</strong>
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#e8ebe6] rounded-2xl space-y-2">
              <label className="block text-xs font-bold text-[#0e0f0c]">
                Matching Rule Keyword / Pattern
              </label>
              <input
                type="text"
                value={customPattern}
                onChange={(e) => setCustomPattern(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c]"
              />
              <p className="text-[11px] text-[#454745]">
                Any future imported transaction containing this keyword will automatically be assigned this category.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => handleConfirmRecategorization(false)}
                className="px-4 py-2 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-xs font-semibold text-[#0e0f0c] rounded-full transition-all"
              >
                Only this transaction
              </button>
              <button
                onClick={() => handleConfirmRecategorization(true)}
                className="px-5 py-2 bg-[#9fe870] hover:bg-[#cdffad] text-xs font-bold text-[#0e0f0c] rounded-full shadow-sm transition-all"
              >
                Remember Rule & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
