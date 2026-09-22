import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Settings,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Account, Category, CategoryRule, ColumnMapping, CsvPreviewResult } from '../types.js';
import { api } from '../services/api.js';

interface CsvUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  selectedAccountId: string;
  onSuccess: () => void;
  categories?: Category[];
  rules?: CategoryRule[];
}

const SAMPLE_CHASE_CSV = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
09/14/2026,09/15/2026,WHOLEFDS SOMA 10145,Groceries,Sale,-92.40,
09/15/2026,09/16/2026,UBER *TRIP HELP.UBER.COM,Travel,Sale,-31.20,
09/16/2026,09/17/2026,NETFLIX.COM,Entertainment,Sale,-19.99,
09/17/2026,09/18/2026,STARBUCKS STORE 4921,Dining,Sale,-8.45,
09/18/2026,09/19/2026,AMAZON.COM PRIME,Shopping,Sale,-45.00,
09/19/2026,09/20/2026,AUTOMATIC PAYMENT - THANK YOU,,Payment,650.00,`;

const SAMPLE_REVOLUT_CSV = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-09-08 11:20:00,2026-09-08 11:25:00,Spotify Family,-16.99,0.00,EUR,COMPLETED,1420.50
CARD_PAYMENT,Current,2026-09-09 14:10:00,2026-09-09 14:12:00,Lidl Supermarket,-48.60,0.00,EUR,COMPLETED,1371.90
TOPUP,Current,2026-09-15 09:00:00,2026-09-15 09:00:00,Client Freelance Invoice,1850.00,0.00,EUR,COMPLETED,3221.90`;

const SAMPLE_GENERIC_DEBIT_CREDIT = `Date,Description,Debit,Credit,Balance
12/09/2026,Trader Joe's Groceries,84.15,,2100.50
14/09/2026,Chevron Fuel Station,45.00,,2055.50
15/09/2026,Consulting Retainer,,1500.00,3555.50`;

export const CsvUploaderModal: React.FC<CsvUploaderModalProps> = ({
  isOpen,
  onClose,
  accounts,
  selectedAccountId,
  onSuccess,
  categories,
  rules,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [targetAccount, setTargetAccount] = useState<string>(selectedAccountId || (accounts[0]?.id || ''));
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dateFormatPreference, setDateFormatPreference] = useState<'AUTO' | 'US' | 'EU'>('AUTO');
  const [invertAmountSign, setInvertAmountSign] = useState(false);
  const [showManualMapping, setShowManualMapping] = useState(false);
  const [customMapping, setCustomMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amount: '',
    debit: '',
    credit: '',
    type: '',
  });
  const [importResult, setImportResult] = useState<{
    totalRows: number;
    importedCount: number;
    duplicatesSkipped: number;
    detectedPresetName?: string;
  } | null>(null);
  const [error, setError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setCsvText('');
    setImportResult(null);
    setError('');
    await generatePreview(selectedFile);
  };

  const loadSample = async (sampleData: string) => {
    setFile(null);
    setCsvText(sampleData);
    setImportResult(null);
    setError('');
    await generatePreview(sampleData);
  };

  const generatePreview = async (input: File | string) => {
    setLoadingPreview(true);
    setError('');
    try {
      const res = await api.previewCsv(input, targetAccount);
      setPreview(res);
      setCustomMapping({
        date: res.headers.find(h => h.toLowerCase().includes('date')) || res.headers[0] || '',
        description: res.headers.find(h => h.toLowerCase().includes('desc') || h.toLowerCase().includes('narrative')) || res.headers[1] || '',
        amount: res.headers.find(h => h.toLowerCase().includes('amount')) || '',
        debit: res.headers.find(h => h.toLowerCase().includes('debit') || h.toLowerCase().includes('out')) || '',
        credit: res.headers.find(h => h.toLowerCase().includes('credit') || h.toLowerCase().includes('in')) || '',
        type: res.headers.find(h => h.toLowerCase().includes('type')) || '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleUpload = async () => {
    if (!file && !csvText) {
      setError('Please select a CSV file or choose a sample.');
      return;
    }
    if (!targetAccount) {
      setError('Please select a target account for this statement.');
      return;
    }

    setImporting(true);
    setError('');
    try {
      const res = await api.uploadCsv(file || csvText, targetAccount, {
        customMapping: showManualMapping ? customMapping : undefined,
        dateFormatPreference,
        invertAmountSign,
        categories,
        rules,
      });

      setImportResult({
        totalRows: res.totalRows,
        importedCount: res.importedCount,
        duplicatesSkipped: res.duplicatesSkipped,
        detectedPresetName: res.detectedPresetName || 'Standard CSV',
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setCsvText('');
    setPreview(null);
    setImportResult(null);
    setError('');
    setShowManualMapping(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0e0f0c]/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-[#e8ebe6] rounded-[24px] w-full max-w-3xl overflow-hidden shadow-modal animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8ebe6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#9fe870] flex items-center justify-center text-[#0e0f0c]">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-[900] text-[#0e0f0c]">Import Bank Statement (CSV)</h2>
              <p className="text-xs text-[#454745]">Upload bank or credit card statements with auto-deduplication</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#5f655b] hover:text-[#0e0f0c] rounded-full hover:bg-[#e8ebe6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 bg-[#fce8e8] border border-[#d03238]/30 rounded-2xl text-xs text-[#a72027] font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {importResult ? (
            /* Success Summary View */
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#e2f6d5] text-[#054d28] mx-auto flex items-center justify-center">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-[900] text-[#0e0f0c]">Statement Imported Successfully!</h3>
                <p className="text-xs text-[#454745] mt-1">
                  Processed format: <strong className="text-[#054d28] font-bold">{importResult.detectedPresetName}</strong>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
                <div className="p-4 bg-[#e8ebe6] rounded-2xl">
                  <div className="text-2xl font-[900] text-[#0e0f0c]">{importResult.totalRows}</div>
                  <div className="text-[11px] font-bold text-[#454745]">Total Rows</div>
                </div>
                <div className="p-4 bg-[#e2f6d5] rounded-2xl">
                  <div className="text-2xl font-[900] text-[#054d28]">{importResult.importedCount}</div>
                  <div className="text-[11px] font-bold text-[#054d28]">New Imported</div>
                </div>
                <div className="p-4 bg-[#fff9db] rounded-2xl">
                  <div className="text-2xl font-[900] text-[#b86700]">{importResult.duplicatesSkipped}</div>
                  <div className="text-[11px] font-bold text-[#4a3b1c]">Duplicates Skipped</div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-xs font-semibold text-[#0e0f0c] rounded-full transition-all"
                >
                  Import Another
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-[#9fe870] hover:bg-[#cdffad] text-xs font-bold text-[#0e0f0c] rounded-full shadow-sm transition-all"
                >
                  View in Dashboard
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Account & Parse Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Target Account</label>
                  <select
                    id="upload-target-account"
                    value={targetAccount}
                    onChange={(e) => setTargetAccount(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c]"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Date Format Interpretation</label>
                  <select
                    value={dateFormatPreference}
                    onChange={(e) => setDateFormatPreference(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-[#e8ebe6] border border-transparent rounded-full text-xs font-semibold text-[#0e0f0c] focus:outline-none focus:border-[#0e0f0c]"
                  >
                    <option value="AUTO">Auto Detect (Default)</option>
                    <option value="US">US Format (MM/DD/YYYY)</option>
                    <option value="EU">European Format (DD/MM/YYYY or DD.MM.YYYY)</option>
                  </select>
                </div>
              </div>

              {/* Dropzone */}
              {!preview ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) {
                      handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#5f655b]/40 hover:border-[#0e0f0c] bg-[#e8ebe6]/40 hover:bg-[#e8ebe6] p-10 rounded-[24px] flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-14 h-14 rounded-full bg-[#9fe870] text-[#0e0f0c] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-[900] text-[#0e0f0c]">Click or drag & drop bank statement CSV</div>
                  <div className="text-xs text-[#454745] mt-1 font-medium">
                    Supports Chase, Revolut, Generic CSV with Debit/Credit or Amount
                  </div>
                </div>
              ) : (
                /* CSV Preview & Column Detection Card */
                <div className="space-y-4">
                  <div className="p-4 bg-[#e8ebe6] rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[#0e0f0c]" />
                      <div>
                        <div className="text-xs font-bold text-[#0e0f0c] flex items-center gap-2">
                          <span>{file ? file.name : 'Sample Statement Loaded'}</span>
                          {preview.detectedPresetName && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#e2f6d5] text-[#054d28]">
                              ✓ {preview.detectedPresetName} ({Math.round(preview.confidence * 100)}% Match)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#454745] mt-0.5 font-medium">
                          {preview.totalRows} transactions found in CSV • Auto-deduplication active
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-xs text-[#0e0f0c] font-bold px-3 py-1.5 rounded-full bg-white hover:bg-[#dbe0d8] transition-colors"
                    >
                      Change File
                    </button>
                  </div>

                  {/* Manual Column Mapping Accordion */}
                  <div className="border border-[#e8ebe6] rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowManualMapping(!showManualMapping)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-[#e8ebe6]/60 hover:bg-[#e8ebe6] text-xs font-bold text-[#0e0f0c] transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-[#0e0f0c]" />
                        <span>Column Mapping Configuration {showManualMapping ? '(Open)' : '(Auto-detected)'}</span>
                      </span>
                      <span className="text-[11px] font-extrabold text-[#054d28] bg-[#e2f6d5] px-2.5 py-0.5 rounded-full">
                        {showManualMapping ? 'Hide' : 'Customize Columns'}
                      </span>
                    </button>

                    {showManualMapping && (
                      <div className="p-4 bg-white border-t border-[#e8ebe6] grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#0e0f0c] mb-1">Date Column *</label>
                          <select
                            value={customMapping.date}
                            onChange={(e) => setCustomMapping({ ...customMapping, date: e.target.value })}
                            className="w-full px-3 py-1.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c]"
                          >
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#0e0f0c] mb-1">Description Column *</label>
                          <select
                            value={customMapping.description}
                            onChange={(e) => setCustomMapping({ ...customMapping, description: e.target.value })}
                            className="w-full px-3 py-1.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c]"
                          >
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#0e0f0c] mb-1">Single Amount Column</label>
                          <select
                            value={customMapping.amount || ''}
                            onChange={(e) => setCustomMapping({ ...customMapping, amount: e.target.value })}
                            className="w-full px-3 py-1.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c]"
                          >
                            <option value="">-- None (use Debit/Credit) --</option>
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#0e0f0c] mb-1">Separate Debit Column</label>
                          <select
                            value={customMapping.debit || ''}
                            onChange={(e) => setCustomMapping({ ...customMapping, debit: e.target.value })}
                            className="w-full px-3 py-1.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c]"
                          >
                            <option value="">-- None --</option>
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#0e0f0c] mb-1">Separate Credit Column</label>
                          <select
                            value={customMapping.credit || ''}
                            onChange={(e) => setCustomMapping({ ...customMapping, credit: e.target.value })}
                            className="w-full px-3 py-1.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c]"
                          >
                            <option value="">-- None --</option>
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center pt-5">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#0e0f0c]">
                            <input
                              type="checkbox"
                              checked={invertAmountSign}
                              onChange={(e) => setInvertAmountSign(e.target.checked)}
                              className="rounded text-[#0e0f0c] focus:ring-0"
                            />
                            <span>Invert amount polarity (+/-)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sample preview table */}
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#454745] mb-2">
                      Sample Extracted Rows Preview
                    </div>
                    <div className="overflow-x-auto border border-[#e8ebe6] rounded-2xl bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#e8ebe6] text-[#454745] border-b border-[#e8ebe6] font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="px-4 py-2.5">Normalized Date</th>
                            <th className="px-4 py-2.5">Description</th>
                            <th className="px-4 py-2.5 text-right">Amount</th>
                            <th className="px-4 py-2.5">Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e8ebe6]">
                          {preview.sampleParsed.map((item, idx) => (
                            <tr key={idx} className="hover:bg-[#e8ebe6]/30">
                              <td className="px-4 py-2.5 font-mono text-[#454745]">{item.date}</td>
                              <td className="px-4 py-2.5 font-semibold text-[#0e0f0c]">{item.description}</td>
                              <td className={`px-4 py-2.5 text-right font-[900] ${item.amount < 0 ? 'text-[#a72027]' : 'text-[#054d28]'}`}>
                                {item.amount < 0 ? `-$${Math.abs(item.amount).toFixed(2)}` : `+$${item.amount.toFixed(2)}`}
                              </td>
                              <td className="px-4 py-2.5 capitalize text-[#454745] font-medium">{item.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sample Presets Quick Load */}
              {!preview && (
                <div className="pt-3 border-t border-[#e8ebe6]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0e0f0c] mb-2.5">
                    <Sparkles className="w-4 h-4 text-[#ffd11a]" />
                    <span>Quick Test with Real Bank Format Presets:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      id="btn-sample-chase"
                      onClick={() => loadSample(SAMPLE_CHASE_CSV)}
                      className="p-3.5 bg-[#e8ebe6]/50 hover:bg-[#e8ebe6] border border-[#e8ebe6] rounded-2xl text-left transition-all"
                    >
                      <div className="text-xs font-[900] text-[#0e0f0c]">Chase Credit Card</div>
                      <div className="text-[11px] text-[#454745] mt-0.5">US MM/DD/YYYY, negative sales</div>
                    </button>

                    <button
                      id="btn-sample-revolut"
                      onClick={() => loadSample(SAMPLE_REVOLUT_CSV)}
                      className="p-3.5 bg-[#e8ebe6]/50 hover:bg-[#e8ebe6] border border-[#e8ebe6] rounded-2xl text-left transition-all"
                    >
                      <div className="text-xs font-[900] text-[#0e0f0c]">Revolut EUR</div>
                      <div className="text-[11px] text-[#454745] mt-0.5">EU timestamp, Card Payment/Topup</div>
                    </button>

                    <button
                      id="btn-sample-generic"
                      onClick={() => loadSample(SAMPLE_GENERIC_DEBIT_CREDIT)}
                      className="p-3.5 bg-[#e8ebe6]/50 hover:bg-[#e8ebe6] border border-[#e8ebe6] rounded-2xl text-left transition-all"
                    >
                      <div className="text-xs font-[900] text-[#0e0f0c]">Generic Statement</div>
                      <div className="text-[11px] text-[#454745] mt-0.5">Separate Debit & Credit columns</div>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!importResult && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#e8ebe6] bg-[#e8ebe6]/30">
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-[#454745] hover:text-[#0e0f0c] transition-colors"
            >
              Cancel
            </button>

            <button
              id="btn-confirm-import"
              onClick={handleUpload}
              disabled={(!file && !csvText) || importing || loadingPreview}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#9fe870] hover:bg-[#cdffad] disabled:opacity-50 text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm active:scale-95 transition-all"
            >
              {importing ? (
                <span>Parsing & Normalizing...</span>
              ) : (
                <>
                  <span>Import Statement</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#0e0f0c]" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
