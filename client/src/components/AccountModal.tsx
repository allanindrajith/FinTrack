import React, { useState } from 'react';
import { X, Building, Plus, AlertCircle } from 'lucide-react';
import { api } from '../services/api.js';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onAccountCreated,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('credit');
  const [currency, setCurrency] = useState('USD');
  const [institution, setInstitution] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMessage('');
    try {
      await api.createAccount(name.trim(), type, currency, institution.trim());
      setName('');
      setInstitution('');
      onAccountCreated();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0e0f0c]/50 backdrop-blur-sm">
      <div className="bg-white border border-[#e8ebe6] rounded-[24px] w-full max-w-md overflow-hidden shadow-modal animate-in zoom-in-95">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8ebe6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#9fe870] flex items-center justify-center text-[#0e0f0c]">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-[900] text-[#0e0f0c]">Add Financial Account</h2>
              <p className="text-xs text-[#5f655b]">Track multiple bank accounts and credit cards</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#5f655b] hover:text-[#0e0f0c] rounded-full hover:bg-[#e8ebe6]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-[#fce8e8] border border-[#d03238]/30 rounded-xl text-xs text-[#a72027] font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Account Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Chase Sapphire Preferred or Capital One"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] placeholder-[#5f655b] focus:outline-none focus:border-[#0e0f0c]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Account Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c]"
              >
                <option value="credit">Credit Card</option>
                <option value="checking">Checking Account</option>
                <option value="savings">Savings Account</option>
                <option value="investment">Investment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c]"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Financial Institution (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Chase, Bank of America, Revolut"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] placeholder-[#5f655b] focus:outline-none focus:border-[#0e0f0c]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e8ebe6]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#454745] hover:text-[#0e0f0c]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{loading ? 'Creating...' : 'Create Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
