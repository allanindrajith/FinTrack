import Papa from 'papaparse';
import { ColumnMapping, NormalizedTransaction, ParseResult } from '../types/index.js';
import { cleanDescription, generateTransactionHash, normalizeAmount, normalizeDate } from './normalizer.js';
import { autoDetectColumns, detectPreset } from './presets.js';

export interface ParseOptions {
  accountId: string;
  customMapping?: ColumnMapping;
  dateFormatPreference?: 'US' | 'EU' | 'ISO' | 'AUTO';
  invertAmountSign?: boolean;
  existingHashes?: Set<string>;
}

/**
 * Detects if a CSV file has preamble metadata lines before the actual table header.
 * Some banks (e.g. PayPal, certain credit unions) output lines like "Downloaded: 2026-01-01" before headers.
 */
function cleanPreamble(csvText: string): string {
  const lines = csvText.split(/\r?\n/);
  let headerIndex = -1;

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].toLowerCase();
    // Check if line looks like a header (contains 'date' and ('desc' or 'amount' or 'debit' or 'credit'))
    if (line.includes('date') && (line.includes('desc') || line.includes('amount') || line.includes('debit') || line.includes('credit') || line.includes('details') || line.includes('type'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex > 0) {
    return lines.slice(headerIndex).join('\n');
  }

  return csvText;
}

/**
 * Main CSV parsing function. Takes raw CSV string and returns normalized transactions.
 */
export function parseBankCsv(csvContent: string, options: ParseOptions): ParseResult {
  const cleanedCsv = cleanPreamble(csvContent);

  const parsed = Papa.parse<Record<string, string>>(cleanedCsv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header: string) => header.trim(),
  });

  const headers = parsed.meta.fields || [];
  const rows = parsed.data || [];

  if (headers.length === 0 || rows.length === 0) {
    return {
      totalRows: 0,
      parsedTransactions: [],
      duplicatesSkipped: 0,
      newTransactions: [],
      confidence: 0,
      headers: [],
      previewRows: [],
    };
  }

  // 1. Detect preset or auto-map
  const matchedPreset = detectPreset(headers);
  const activeMapping = options.customMapping || (matchedPreset ? matchedPreset.getMapping(headers) : autoDetectColumns(headers));

  // Calculate detection confidence
  let confidence = 0.5;
  if (matchedPreset) {
    confidence = 0.95;
  } else if (activeMapping.date && activeMapping.description && (activeMapping.amount || (activeMapping.debit && activeMapping.credit))) {
    confidence = 0.85;
  }

  const existingHashes = options.existingHashes || new Set<string>();
  const batchHashes = new Set<string>();

  const parsedTransactions: NormalizedTransaction[] = [];
  const newTransactions: NormalizedTransaction[] = [];
  let duplicatesSkipped = 0;

  for (const row of rows) {
    // Skip empty or summary rows
    if (!row[activeMapping.date] && !row[activeMapping.description]) {
      continue;
    }

    try {
      // 1. Parse Date
      const rawDate = row[activeMapping.date] || '';
      if (!rawDate.trim()) continue;
      const normalizedDate = normalizeDate(rawDate, {
        dateFormatPreference: options.dateFormatPreference || (matchedPreset?.id === 'revolut' ? 'ISO' : 'AUTO'),
      });

      // 2. Parse Description
      const rawDesc = row[activeMapping.description] || 'Unknown';
      const { clean, original } = cleanDescription(rawDesc);

      // 3. Parse Amount & Type
      let finalAmount = 0;
      let finalType: 'debit' | 'credit' = 'debit';

      if (activeMapping.debit && activeMapping.credit) {
        // Separate Debit & Credit columns
        const rawDebit = row[activeMapping.debit]?.trim() || '';
        const rawCredit = row[activeMapping.credit]?.trim() || '';

        if (rawDebit && rawDebit !== '0' && rawDebit !== '0.00' && rawDebit !== '$0.00') {
          const { amount } = normalizeAmount(rawDebit, 'debit', { invertSign: options.invertAmountSign });
          finalAmount = -Math.abs(amount);
          finalType = 'debit';
        } else if (rawCredit && rawCredit !== '0' && rawCredit !== '0.00' && rawCredit !== '$0.00') {
          const { amount } = normalizeAmount(rawCredit, 'credit', { invertSign: options.invertAmountSign });
          finalAmount = Math.abs(amount);
          finalType = 'credit';
        }
      } else if (activeMapping.amount) {
        const rawAmount = row[activeMapping.amount] || '0';
        const typeHint = activeMapping.type ? row[activeMapping.type] : undefined;
        const norm = normalizeAmount(rawAmount, typeHint, { invertSign: options.invertAmountSign });
        finalAmount = norm.amount;
        finalType = norm.type;
      }

      // Generate deterministic hash for deduplication
      const hash = generateTransactionHash(options.accountId, normalizedDate, clean, finalAmount);

      const transaction: NormalizedTransaction = {
        accountId: options.accountId,
        date: normalizedDate,
        description: clean,
        originalDescription: original,
        amount: finalAmount,
        type: finalType,
        hash,
        rawData: row,
      };

      parsedTransactions.push(transaction);

      // Check deduplication
      if (existingHashes.has(hash) || batchHashes.has(hash)) {
        duplicatesSkipped++;
      } else {
        batchHashes.add(hash);
        newTransactions.push(transaction);
      }
    } catch (err) {
      // Row failed parsing (e.g. malformed date or footer text) -> skip gracefully
      continue;
    }
  }

  return {
    totalRows: rows.length,
    parsedTransactions,
    duplicatesSkipped,
    newTransactions,
    detectedPreset: matchedPreset?.id,
    detectedPresetName: matchedPreset?.name,
    confidence,
    headers,
    previewRows: rows.slice(0, 5),
  };
}
