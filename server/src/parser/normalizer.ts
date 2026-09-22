import crypto from 'crypto';
import { TransactionType } from '../types/index.js';

export interface DateParseOptions {
  dateFormatPreference?: 'US' | 'EU' | 'ISO' | 'AUTO';
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Robustly parses and normalizes real-world date strings into ISO format (YYYY-MM-DD).
 * Handles ISO, US (MM/DD/YYYY), EU (DD/MM/YYYY, DD.MM.YYYY), text months ("15 Jan 2026"), etc.
 */
export function normalizeDate(rawDateStr: string, options: DateParseOptions = {}): string {
  if (!rawDateStr || typeof rawDateStr !== 'string') {
    throw new Error(`Invalid date value: ${rawDateStr}`);
  }

  const str = rawDateStr.trim();
  const pref = options.dateFormatPreference || 'AUTO';

  // 1. Check for standard ISO format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (with optional time)
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return formatValidDate(year, month, day);
  }

  // 2. Check for text month formats, e.g., "15 Jan 2026", "Jan 15, 2026", "15-Jan-2026", "15-Jan-26"
  const textMonthMatch1 = str.match(/^(\d{1,2})[-/\s]+([a-zA-Z]{3,9})[-/,\s]+(\d{2,4})$/);
  if (textMonthMatch1) {
    const day = parseInt(textMonthMatch1[1], 10);
    const monthStr = textMonthMatch1[2].toLowerCase();
    let year = parseInt(textMonthMatch1[3], 10);
    if (year < 100) year += 2000;
    const month = MONTH_NAMES[monthStr];
    if (month) {
      return formatValidDate(year, month, day);
    }
  }

  const textMonthMatch2 = str.match(/^([a-zA-Z]{3,9})[-/\s]+(\d{1,2})[-/,\s]+(\d{2,4})$/);
  if (textMonthMatch2) {
    const monthStr = textMonthMatch2[1].toLowerCase();
    const day = parseInt(textMonthMatch2[2], 10);
    let year = parseInt(textMonthMatch2[3], 10);
    if (year < 100) year += 2000;
    const month = MONTH_NAMES[monthStr];
    if (month) {
      return formatValidDate(year, month, day);
    }
  }

  // 3. Numeric formats: MM/DD/YYYY vs DD/MM/YYYY vs DD.MM.YYYY
  // Delimiters: /, -, .
  const numMatch = str.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})(?:[T\s].*)?$/);
  if (numMatch) {
    const part1 = parseInt(numMatch[1], 10);
    const delimiter = numMatch[2];
    const part2 = parseInt(numMatch[3], 10);
    let year = parseInt(numMatch[4], 10);
    if (year < 100) year += 2000;

    let month: number;
    let day: number;

    if (pref === 'US') {
      // US preference: MM/DD/YYYY
      month = part1;
      day = part2;
    } else if (pref === 'EU' || delimiter === '.') {
      // EU preference or dot delimiter (standard in Germany/EU: DD.MM.YYYY)
      day = part1;
      month = part2;
    } else {
      // AUTO detection
      if (part1 > 12 && part2 <= 12) {
        // Part 1 cannot be month, must be DD/MM/YYYY
        day = part1;
        month = part2;
      } else if (part2 > 12 && part1 <= 12) {
        // Part 2 cannot be month, must be MM/DD/YYYY
        month = part1;
        day = part2;
      } else if (delimiter === '.') {
        day = part1;
        month = part2;
      } else {
        // Default to US (MM/DD/YYYY) when ambiguous with slash, or check if day/month valid
        month = part1;
        day = part2;
      }
    }

    return formatValidDate(year, month, day);
  }

  // Fallback: try native Date parsing
  const parsedTimestamp = Date.parse(str);
  if (!isNaN(parsedTimestamp)) {
    const d = new Date(parsedTimestamp);
    return formatValidDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  throw new Error(`Unable to parse date format: "${rawDateStr}"`);
}

function formatValidDate(year: number, month: number, day: number): string {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day}`);
  }
  const yyyy = year.toString().padStart(4, '0');
  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Normalizes amount values from messy strings into a standard signed number:
 * - Negative for expenses / debits (e.g. -45.50)
 * - Positive for income / credits / deposits (e.g. 1500.00)
 */
export function normalizeAmount(
  rawAmount: string | number,
  typeHint?: string | null,
  options: { invertSign?: boolean } = {}
): { amount: number; type: TransactionType } {
  if (typeof rawAmount === 'number') {
    let amt = rawAmount;
    if (options.invertSign) amt = -amt;
    const type: TransactionType = amt < 0 ? 'debit' : 'credit';
    return { amount: Math.round(amt * 100) / 100, type };
  }

  if (!rawAmount || typeof rawAmount !== 'string') {
    return { amount: 0, type: 'debit' };
  }

  let str = rawAmount.trim();

  // Detect parenthetical negative: (123.45)
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  // Detect trailing or leading minus sign
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.substring(1).trim();
  } else if (str.endsWith('-')) {
    isNegative = true;
    str = str.substring(0, str.length - 1).trim();
  }

  // Check for trailing or leading CR / DR
  if (/\bDR\b/i.test(str)) {
    isNegative = true;
    str = str.replace(/\bDR\b/gi, '').trim();
  } else if (/\bCR\b/i.test(str)) {
    isNegative = false;
    str = str.replace(/\bCR\b/gi, '').trim();
  }

  // Strip currency symbols and whitespace
  str = str.replace(/[$€£¥₹\s]|CAD|USD|EUR|GBP|AUD|CHF/gi, '').trim();

  // Handle European vs Standard thousands/decimal separators
  // European: 1.234,56 or 1 234,56
  // Standard: 1,234.56
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // European: 1.234,56 -> remove dots, replace comma with dot
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Standard: 1,234.56 -> remove commas
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma present: could be decimal (e.g. 12,50 or 123,45) or thousands (e.g. 1,000)
    const commaParts = str.split(',');
    if (commaParts.length === 2 && commaParts[1].length <= 2) {
      // Likely decimal separator: 12,50 -> 12.50
      str = str.replace(',', '.');
    } else {
      // Likely thousand separator: 1,000 -> 1000
      str = str.replace(/,/g, '');
    }
  }

  let num = parseFloat(str);
  if (isNaN(num)) {
    num = 0;
  }

  if (isNegative) {
    num = -Math.abs(num);
  }

  // Evaluate typeHint if provided
  let inferredType: TransactionType = num < 0 ? 'debit' : 'credit';
  if (typeHint) {
    const hint = typeHint.toLowerCase().trim();
    if (['debit', 'sale', 'purchase', 'withdrawal', 'fee', 'charge', 'dr', 'expense'].includes(hint)) {
      inferredType = 'debit';
      num = -Math.abs(num);
    } else if (['credit', 'payment', 'deposit', 'refund', 'income', 'cr', 'transfer in'].includes(hint)) {
      inferredType = 'credit';
      num = Math.abs(num);
    }
  }

  if (options.invertSign) {
    num = -num;
    inferredType = num < 0 ? 'debit' : 'credit';
  }

  return {
    amount: Math.round(num * 100) / 100,
    type: inferredType,
  };
}

/**
 * Normalizes description text:
 * - Trims and removes redundant prefixes (e.g., "PURCHASE AUTHORIZED ON", "SQ *", "TST*")
 * - Cleans up multiple spaces
 */
export function cleanDescription(rawDesc: string): { clean: string; original: string } {
  if (!rawDesc || typeof rawDesc !== 'string') {
    return { clean: 'Unknown Transaction', original: '' };
  }

  const original = rawDesc.trim();
  let clean = original;

  // Remove common bank noise
  clean = clean.replace(/^(POS\s+PURCHASE|PURCHASE\s+AUTHORIZED\s+ON\s+\d{1,2}\/\d{1,2}|CHECKCARD\s+\d{4}|DEBIT\s+CARD\s+PURCHASE\s+-?\s*)/i, '');
  clean = clean.replace(/^(SQ\s*\*|TST\*\s*|PAYPAL\s*\*|AMZN\s+MKTP\s+US\*)/i, '');
  clean = clean.replace(/\s{2,}/g, ' ').trim();

  return {
    clean: clean || original,
    original,
  };
}

/**
 * Generates a deterministic SHA-256 fingerprint for a transaction to prevent duplicate imports.
 */
export function generateTransactionHash(
  accountId: string,
  date: string,
  description: string,
  amount: number
): string {
  const normDesc = description.toLowerCase().replace(/[^a-z0-9]/g, '');
  const amountCents = Math.round(amount * 100);
  const payload = `${accountId}|${date}|${normDesc}|${amountCents}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
