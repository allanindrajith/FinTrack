import React, { useState, useEffect } from 'react';
import {
  Search,
  Trash2,
  Tag,
  Check,
  Building,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Download,
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Status feedback toast
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedAccount, selectedType]);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTransactions = filtered.slice(startIndex, startIndex + pageSize);

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
      const res = await api.recategorizeTransaction(
        rulePromptTx.id,
        pendingCategoryId,
        createRule,
        createRule ? customPattern : undefined,
        rulePromptTx,
        categories,
        transactions
      );
      setStatusFeedback({
        type: 'success',
        message: res.ruleCreated
          ? `Recategorized transaction and auto-updated ${res.otherTransactionsUpdated} other records.`
          : 'Transaction recategorized successfully.',
      });
      setTimeout(() => setStatusFeedback(null), 4000);
      onRefresh();
    } catch (err: any) {
      setStatusFeedback({
        type: 'error',
        message: err.message || 'Failed to recategorize transaction.',
      });
      setTimeout(() => setStatusFeedback(null), 4000);
    } finally {
      setRulePromptTx(null);
      setPendingCategoryId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        await api.deleteTransaction(id);
        setStatusFeedback({
          type: 'success',
          message: 'Transaction deleted successfully.',
        });
        setTimeout(() => setStatusFeedback(null), 4000);
        onRefresh();
      } catch (err: any) {
        setStatusFeedback({
          type: 'error',
          message: err.message || 'Failed to delete transaction.',
        });
        setTimeout(() => setStatusFeedback(null), 4000);
      }
    }
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) return;

    // Helper to sanitize cell against CSV formula injection (CWE-1236)
    const sanitizeCsvCell = (val: string) => {
      let cell = (val || '').replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(cell)) {
        cell = "'" + cell;
      }
      return `"${cell}"`;
    };

    const headers = ['Date', 'Description', 'Original Description', 'Account', 'Category', 'Type', 'Amount'];
    const rows = filtered.map((t) => [
      t.date,
      sanitizeCsvCell(t.description || ''),
      sanitizeCsvCell(t.original_description || ''),
      sanitizeCsvCell(t.account_name || t.account_id || ''),
      sanitizeCsvCell(t.category_name || 'Uncategorized'),
      t.type,
      t.amount.toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `fintrack-transactions-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fintrack-card rounded-[24px] overflow-hidden">
      {/* Table Header & Controls */}
      <div className="p-5 border-b border-[#e8ebe6] bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-[900] text-[#0e0f0c] tracking-tight">Transactions & Statement Records</h2>
          <p className="text-xs text-[#5f655b]">
            {filtered.length} transactions total • Showing {filtered.length === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + pageSize, filtered.length)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-60 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#5f655b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search merchant or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-medium text-[#0e0f0c] placeholder-[#5f655b] focus:outline-none focus:border-[#0e0f0c]"
            />
          </div>

          {/* Account Filter */}
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            aria-label="Filter by account"
            className="px-3 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c] cursor-pointer"
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
            className="px-3 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c] cursor-pointer"
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
            className="px-3 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c] cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="debit">Expenses Only</option>
            <option value="credit">Income Only</option>
          </select>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            title={filtered.length === 0 ? 'No transactions to export' : 'Export decrypted transactions as CSV'}
            className="px-3.5 py-2 bg-[#e8ebe6] hover:bg-[#9fe870] disabled:opacity-40 disabled:hover:bg-[#e8ebe6] text-[#0e0f0c] text-xs font-bold rounded-full flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* User Feedback Toast Banner */}
      {statusFeedback && (
        <div
          className={`px-5 py-3 border-b flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-150 ${
            statusFeedback.type === 'success'
              ? 'bg-[#e2f6d5] border-[#2ead4b]/30 text-[#054d28]'
              : 'bg-[#fce8e8] border-[#d03238]/30 text-[#a72027]'
          }`}
        >
          {statusFeedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{statusFeedback.message}</span>
        </div>
      )}

      {/* Desktop & Tablet View: Full Table (Screens >= 768px) */}
      <div className="hidden md:block overflow-x-auto">
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
            {paginatedTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[#5f655b]">
                  No transactions match your current filters.
                </td>
              </tr>
            ) : (
              paginatedTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#e8ebe6]/40 transition-colors group">
                  {/* Date */}
                  <td className="px-5 py-3.5 font-mono font-medium text-[#454745] whitespace-nowrap">
                    {tx.date}
                  </td>

                  {/* Description */}
                  <td className="px-5 py-3.5 font-semibold text-[#0e0f0c] max-w-xs truncate">
                    <div className="truncate">{tx.description}</div>
                    {tx.original_description && tx.original_description !== tx.description && (
                      <div className="text-[10px] text-[#5f655b] truncate font-normal" title={tx.original_description}>
                        Raw: {tx.original_description}
                      </div>
                    )}
                  </td>

                  {/* Account */}
                  <td className="px-5 py-3.5 text-[#454745] whitespace-nowrap">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Building className="w-3.5 h-3.5 text-[#5f655b]" />
                      <span>{tx.account_name || 'Account'}</span>
                    </span>
                  </td>

                  {/* Category Pill */}
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
                        <Tag className="w-2.5 h-2.5 text-[#5f655b] opacity-0 group-hover:opacity-100 transition-opacity" />
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
                      className="p-1.5 text-[#5f655b] hover:text-[#d03238] rounded-full hover:bg-[#fce8e8] transition-colors"
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

      {/* Mobile Stacked Card View (Screens < 768px, no horizontal table dragging required!) */}
      <div className="block md:hidden divide-y divide-[#e8ebe6] bg-white">
        {paginatedTransactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#5f655b]">
            No transactions match your current filters.
          </div>
        ) : (
          paginatedTransactions.map((tx) => (
            <div key={tx.id} className="p-4 space-y-2 hover:bg-[#e8ebe6]/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#0e0f0c] leading-snug break-words">
                    {tx.description}
                  </div>
                  <div className="text-[11px] font-mono text-[#5f655b] mt-0.5 flex items-center gap-1.5">
                    <span>{tx.date}</span>
                    <span>•</span>
                    <span>{tx.account_name || 'Account'}</span>
                  </div>
                </div>

                <div
                  className={`text-sm font-[900] whitespace-nowrap ${
                    tx.amount < 0 ? 'text-[#a72027]' : 'text-[#054d28]'
                  }`}
                >
                  {tx.amount < 0 ? `-${formatCurrency(Math.abs(tx.amount))}` : `+${formatCurrency(tx.amount)}`}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] transition-all min-h-[36px]"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: tx.category_color || '#9fe870' }}
                    />
                    <span>{tx.category_name || 'Uncategorized'}</span>
                    <Tag className="w-2.5 h-2.5 text-[#5f655b]" />
                  </button>
                )}

                <button
                  onClick={() => handleDelete(tx.id)}
                  title="Delete transaction"
                  className="p-2 text-[#5f655b] hover:text-[#d03238] rounded-full hover:bg-[#fce8e8] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls Bar */}
      <div className="px-5 py-3.5 bg-[#e8ebe6]/50 border-t border-[#e8ebe6] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5f655b]">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            aria-label="Rows per page"
            className="px-2.5 py-1 bg-white border border-[#e8ebe6] rounded-lg text-xs font-bold text-[#0e0f0c] focus:outline-none"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <span className="hidden sm:inline">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="sm:hidden">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#e8ebe6] text-xs font-bold text-[#0e0f0c] hover:bg-[#e8ebe6] disabled:opacity-40 disabled:cursor-not-allowed transition-all min-h-[36px]"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#e8ebe6] text-xs font-bold text-[#0e0f0c] hover:bg-[#e8ebe6] disabled:opacity-40 disabled:cursor-not-allowed transition-all min-h-[36px]"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
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
                <p className="text-xs text-[#5f655b]">
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
              <p className="text-[11px] text-[#5f655b]">
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
