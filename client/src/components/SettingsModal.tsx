import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Shield,
  Clock,
  Sparkles,
  Key,
  AlertTriangle,
  CheckCircle2,
  Save,
  FileText,
  Lock,
} from 'lucide-react';
import { api } from '../services/api.js';
import { cryptoService } from '../services/crypto.js';
import { User, AuditLogEntry } from '../types.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserUpdate: (updatedUser: User) => void;
  onDataDeleted?: () => void;
  onAccountDeleted?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdate,
  onDataDeleted,
  onAccountDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'encryption' | 'retention' | 'ai' | 'audit'>('profile');
  
  // Profile state
  const [name, setName] = useState(user.name || '');
  const [currency, setCurrency] = useState(user.currency || 'USD');
  const [profilePicture, setProfilePicture] = useState(user.profile_picture || '');
  
  // Security / Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Retention state
  const [retentionPolicy, setRetentionPolicy] = useState(user.retention_policy || 'never');
  const [customDate, setCustomDate] = useState(user.retention_custom_date || '');
  
  // AI Settings state
  const [aiConsent, setAiConsent] = useState(Boolean(user.ai_consent));
  const [aiProvider, setAiProvider] = useState(user.ai_provider || 'gemini');
  const [byoKey, setByoKey] = useState('');
  const [hasExistingByoKey, setHasExistingByoKey] = useState(Boolean(user.has_byo_key));
  
  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // UI feedback
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showSoftDeleteConfirm, setShowSoftDeleteConfirm] = useState(false);
  const [showAccountDeleteConfirm, setShowAccountDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(user.name || '');
      setCurrency(user.currency || 'USD');
      setProfilePicture(user.profile_picture || '');
      setRetentionPolicy(user.retention_policy || 'never');
      setCustomDate(user.retention_custom_date || '');
      setAiConsent(Boolean(user.ai_consent));
      setAiProvider(user.ai_provider || 'gemini');
      setHasExistingByoKey(Boolean(user.has_byo_key));
      setSuccessMsg('');
      setErrorMsg('');
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen && activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [isOpen, activeTab]);

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.getAuditLogs();
      setAuditLogs(res.logs || []);
    } catch {
      // Non-blocking
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.updateProfile({ name, currency, profilePicture });
      onUserUpdate(res.user);
      setSuccessMsg('Profile settings updated successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.updatePassword(currentPassword, newPassword);
      // Re-derive local crypto vault key with new password
      await cryptoService.deriveKeyFromPassphrase(newPassword, user.email);
      setSuccessMsg('Password changed. Encryption vault re-keyed successfully.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRetention = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.updateSettings({
        retentionPolicy,
        retentionCustomDate: retentionPolicy === 'custom' ? customDate : undefined,
      });
      onUserUpdate(res.user);
      setSuccessMsg('Data retention policy updated.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update retention policy.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.updateSettings({
        aiConsent,
        aiProvider,
        aiApiKey: byoKey.trim().length > 0 ? byoKey.trim() : undefined,
      });
      onUserUpdate(res.user);
      if (byoKey.trim().length > 0) {
        setHasExistingByoKey(true);
        setByoKey('');
      }
      setSuccessMsg('AI settings updated successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update AI settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      await api.deleteFinancialData();
      setShowSoftDeleteConfirm(false);
      setSuccessMsg('Financial data has been soft-deleted from your account. Permanent purge completes in 24–48 hours.');
      if (onDataDeleted) onDataDeleted();
      fetchAuditLogs();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete financial data.');
    } finally {
      setSaving(false);
    }
  };

  const handleAccountDelete = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      await api.deleteUserAccount();
      setShowAccountDeleteConfirm(false);
      onClose();
      if (onAccountDeleted) onAccountDeleted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete account.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0e0f0c]/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border border-[#e8ebe6] rounded-[24px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-modal animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8ebe6]">
          <div>
            <h2 className="text-lg font-[900] text-[#0e0f0c] tracking-tight">FinTrack Settings</h2>
            <p className="text-xs text-[#5f655b]">Manage profile, privacy, zero-knowledge encryption & AI</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-[#5f655b] hover:text-[#0e0f0c] rounded-full hover:bg-[#e8ebe6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-[#e8ebe6] bg-[#f8faf7] overflow-x-auto">
          {[
            { id: 'profile', label: 'Profile', icon: UserIcon },
            { id: 'encryption', label: 'Zero-Knowledge', icon: Shield },
            { id: 'retention', label: 'Data Retention', icon: Clock },
            { id: 'ai', label: 'AI Insights', icon: Sparkles },
            { id: 'audit', label: 'Audit Logs', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-[#0e0f0c] text-[#0e0f0c]'
                    : 'border-transparent text-[#5f655b] hover:text-[#0e0f0c]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-[#fce8e8] border border-[#d03238]/30 rounded-xl text-xs text-[#a72027] font-semibold flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-[#eaf8e2] border border-[#9fe870]/50 rounded-xl text-xs text-[#1e460d] font-semibold flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <h3 className="text-sm font-[900] text-[#0e0f0c]">User Profile</h3>
                <div>
                  <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] border border-transparent focus:outline-none focus:border-[#0e0f0c]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Email Address</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="flex-1 px-3.5 py-2.5 bg-[#f1f3ef] rounded-xl text-xs font-semibold text-[#7c8378] border border-[#e8ebe6] cursor-not-allowed"
                    />
                    <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-[#e8ebe6] text-[#0e0f0c]">
                      {user.email_verified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Currency Preference</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] border border-transparent focus:outline-none focus:border-[#0e0f0c]"
                    >
                      <option value="USD">$ USD - US Dollar</option>
                      <option value="EUR">€ EUR - Euro</option>
                      <option value="GBP">£ GBP - British Pound</option>
                      <option value="CAD">C$ CAD - Canadian Dollar</option>
                      <option value="AUD">A$ AUD - Australian Dollar</option>
                      <option value="JPY">¥ JPY - Japanese Yen</option>
                      <option value="CHF">CHF - Swiss Franc</option>
                      <option value="INR">₹ INR - Indian Rupee</option>
                      <option value="SGD">S$ SGD - Singapore Dollar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Avatar / Profile Picture URL</label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={profilePicture}
                      onChange={(e) => setProfilePicture(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] border border-transparent focus:outline-none focus:border-[#0e0f0c]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm transition-all flex items-center gap-2"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
                </button>
              </form>

              <hr className="border-[#e8ebe6]" />

              {/* Password update */}
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <h3 className="text-sm font-[900] text-[#0e0f0c]">Change Password & Re-Key Vault</h3>
                <p className="text-xs text-[#5f655b]">
                  Updating your password also updates the derivation key for your client-side encryption vault.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] border border-transparent focus:outline-none focus:border-[#0e0f0c]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0e0f0c] mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] border border-transparent focus:outline-none focus:border-[#0e0f0c]"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#0e0f0c] hover:bg-[#22241f] text-white font-bold text-xs rounded-full transition-all flex items-center gap-2"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{saving ? 'Re-Keying...' : 'Update Password'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: ZERO-KNOWLEDGE ENCRYPTION */}
          {activeTab === 'encryption' && (
            <div className="space-y-5">
              <div className="p-4 bg-[#f4f7f2] border border-[#dce3d6] rounded-2xl flex items-start gap-3.5">
                <Shield className="w-5 h-5 text-[#22720d] flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-[900] text-[#0e0f0c]">Client-Side Zero-Knowledge Architecture</h4>
                  <p className="text-xs text-[#5f655b] leading-relaxed">
                    FinTrack employs military-grade <strong>AES-256-GCM</strong> encryption directly inside your browser.
                    Your cryptographic master key is derived locally via <strong>PBKDF2</strong> with 600,000 SHA-256 rounds.
                    The server stores only ciphertext blobs; neither Google Cloud, database admins, nor anyone else can see your transaction amounts or merchants.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-[#e8ebe6] rounded-2xl bg-white space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0e0f0c]">
                    <Lock className="w-4 h-4 text-[#9fe870]" />
                    <span>Vault Status</span>
                  </div>
                  <p className="text-xs text-[#5f655b]">
                    {cryptoService.isUnlocked() ? (
                      <span className="text-[#22720d] font-bold">● Unlocked in memory</span>
                    ) : (
                      <span className="text-[#a72027] font-bold">○ Locked</span>
                    )}
                  </p>
                </div>

                <div className="p-4 border border-[#e8ebe6] rounded-2xl bg-white space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0e0f0c]">
                    <Shield className="w-4 h-4 text-[#0e0f0c]" />
                    <span>Deduplication Mechanism</span>
                  </div>
                  <p className="text-xs text-[#5f655b]">
                    Blind HMAC-SHA256 hash preventing duplicate uploads without revealing amounts.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[#fff9e6] border border-[#f0df97] rounded-2xl text-xs text-[#705600] space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Zero-Knowledge Architectural Trade-off</span>
                </div>
                <p className="leading-relaxed">
                  Because the server never possesses your plaintext keys or financial figures, all categorization rules,
                  budget trackers, and monthly charts are evaluated <strong>client-side</strong> on your computer.
                  Raw data sent to third-party AI models requires your explicit consent toggle in the AI Insights tab.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: DATA RETENTION & DELETION */}
          {activeTab === 'retention' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-[900] text-[#0e0f0c]">Automated Data Retention Policy</h3>
                <p className="text-xs text-[#5f655b] leading-relaxed">
                  Choose how long FinTrack retains your statement records. Our background scheduled worker automatically
                  purges transactions past their retention horizon.
                </p>

                <div className="space-y-2">
                  {[
                    { id: '1d', label: '1 Day (Ephemeral)' },
                    { id: '7d', label: '7 Days' },
                    { id: '1m', label: '1 Month' },
                    { id: '3m', label: '3 Months' },
                    { id: '1y', label: '1 Year' },
                    { id: 'never', label: 'Never (Keep until manually removed)' },
                    { id: 'custom', label: 'Custom Cutoff Date' },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        retentionPolicy === option.id
                          ? 'border-[#0e0f0c] bg-[#f8faf7] text-[#0e0f0c]'
                          : 'border-[#e8ebe6] hover:border-[#ccd1c8] text-[#5f655b]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="retentionPolicy"
                          value={option.id}
                          checked={retentionPolicy === option.id}
                          onChange={(e) => setRetentionPolicy(e.target.value)}
                          className="accent-[#0e0f0c]"
                        />
                        <span>{option.label}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {retentionPolicy === 'custom' && (
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Purge transactions older than:</label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="px-3.5 py-2 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] border border-transparent focus:outline-none focus:border-[#0e0f0c]"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveRetention}
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm transition-all"
                >
                  {saving ? 'Updating...' : 'Save Retention Policy'}
                </button>
              </div>

              <hr className="border-[#e8ebe6]" />

              {/* Danger Zone */}
              <div className="space-y-4">
                <h3 className="text-sm font-[900] text-[#a72027]">Danger Zone: Manual Purge</h3>

                {/* Soft-Delete Data */}
                <div className="p-4 border border-[#fce8e8] bg-[#fffbfb] rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0e0f0c]">Purge All Financial Data</h4>
                    <p className="text-[11px] text-[#5f655b]">
                      Soft-deletes immediately from your view. Permanently hard-purged from the database in 24–48 hours.
                    </p>
                  </div>
                  {showSoftDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSoftDelete}
                        disabled={saving}
                        className="px-3 py-1.5 bg-[#d03238] text-white font-bold text-xs rounded-full"
                      >
                        Confirm Purge
                      </button>
                      <button
                        onClick={() => setShowSoftDeleteConfirm(false)}
                        className="px-3 py-1.5 bg-[#e8ebe6] text-[#0e0f0c] font-bold text-xs rounded-full"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSoftDeleteConfirm(true)}
                      className="px-3.5 py-2 border border-[#d03238] text-[#d03238] hover:bg-[#fce8e8] font-bold text-xs rounded-full transition-all"
                    >
                      Delete My Data
                    </button>
                  )}
                </div>

                {/* Hard Delete Account */}
                <div className="p-4 border border-[#fce8e8] bg-[#fffbfb] rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#a72027]">Permanently Delete Account</h4>
                    <p className="text-[11px] text-[#5f655b]">
                      Cascade deletes your profile, categories, transactions, and AI history irreversibly.
                    </p>
                  </div>
                  {showAccountDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAccountDelete}
                        disabled={saving}
                        className="px-3 py-1.5 bg-[#a72027] text-white font-bold text-xs rounded-full"
                      >
                        Permanently Delete
                      </button>
                      <button
                        onClick={() => setShowAccountDeleteConfirm(false)}
                        className="px-3 py-1.5 bg-[#e8ebe6] text-[#0e0f0c] font-bold text-xs rounded-full"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAccountDeleteConfirm(true)}
                      className="px-3.5 py-2 bg-[#d03238] hover:bg-[#a72027] text-white font-bold text-xs rounded-full transition-all"
                    >
                      Delete Account
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI INTEGRATION & BYO KEY */}
          {activeTab === 'ai' && (
            <div className="space-y-5">
              <div className="p-4 bg-[#f8faf7] border border-[#e8ebe6] rounded-2xl space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="text-xs font-[900] text-[#0e0f0c]">Opt-in to AI Financial Insights</h4>
                    <p className="text-xs text-[#5f655b] leading-relaxed">
                      AI Insights powers natural language financial Q&A and spending advice.
                      To query an AI model, relevant transaction summaries must be sent to the selected AI provider.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={aiConsent}
                    onChange={(e) => setAiConsent(e.target.checked)}
                    className="w-5 h-5 accent-[#9fe870] rounded cursor-pointer mt-1"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-[900] text-[#0e0f0c]">AI Provider Selection</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'gemini', name: 'Google Gemini', model: 'gemini-1.5-flash', badge: 'Default' },
                    { id: 'openai', name: 'OpenAI', model: 'gpt-4o-mini', badge: 'BYO Key' },
                    { id: 'anthropic', name: 'Anthropic Claude', model: 'claude-3-5-haiku', badge: 'BYO Key' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAiProvider(p.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        aiProvider === p.id
                          ? 'border-[#0e0f0c] bg-[#f8faf7] shadow-sm'
                          : 'border-[#e8ebe6] hover:border-[#ccd1c8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[#0e0f0c]">{p.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#e8ebe6] text-[#5f655b]">
                          {p.badge}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#5f655b] font-mono">{p.model}</span>
                    </button>
                  ))}
                </div>

                {/* BYO Key Box */}
                <div className="p-4 border border-[#e8ebe6] rounded-2xl bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#0e0f0c]">
                      Connect Your Own API Key (BYO-Key)
                    </label>
                    {hasExistingByoKey && (
                      <span className="text-[11px] font-bold text-[#22720d] bg-[#eaf8e2] px-2 py-0.5 rounded-full">
                        ✓ BYO Key Connected (Encrypted at rest)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5f655b]">
                    Paste your API key for {aiProvider === 'gemini' ? 'Google Gemini' : aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'}.
                    Keys are stored encrypted with AES-256 at rest, never logged, and only used for your requests.
                  </p>
                  <input
                    type="password"
                    placeholder="sk-... or AIzaSy..."
                    value={byoKey}
                    onChange={(e) => setByoKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold font-mono text-[#0e0f0c] border border-transparent focus:outline-none focus:border-[#0e0f0c]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveAiSettings}
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm transition-all"
                >
                  {saving ? 'Saving...' : 'Save AI Configuration'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-[900] text-[#0e0f0c]">Privacy & Deletion Audit Trail</h3>
                  <p className="text-xs text-[#5f655b]">
                    Cryptographic audit trail logging actions with timestamp only (never financial content).
                  </p>
                </div>
                <button
                  onClick={fetchAuditLogs}
                  disabled={loadingLogs}
                  className="text-xs font-bold text-[#0e0f0c] hover:underline"
                >
                  {loadingLogs ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-8 text-center bg-[#f8faf7] rounded-2xl border border-[#e8ebe6] text-xs text-[#5f655b]">
                  No audit logs recorded yet. Deletion and purge events will appear here.
                </div>
              ) : (
                <div className="border border-[#e8ebe6] rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f8faf7] border-b border-[#e8ebe6] text-[#5f655b] font-bold">
                      <tr>
                        <th className="py-2.5 px-4">Action</th>
                        <th className="py-2.5 px-4">Entity</th>
                        <th className="py-2.5 px-4">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e8ebe6]">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#f8faf7]/50">
                          <td className="py-2.5 px-4 font-bold text-[#0e0f0c]">{log.action}</td>
                          <td className="py-2.5 px-4 text-[#5f655b]">{log.entity_type}</td>
                          <td className="py-2.5 px-4 text-[#5f655b] font-mono text-[11px]">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
