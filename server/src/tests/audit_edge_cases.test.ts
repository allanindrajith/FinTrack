import { describe, it, expect } from 'vitest';
import { parseBankCsv } from '../parser/csvParser.js';
import { normalizeAmount, normalizeDate, cleanDescription } from '../parser/normalizer.js';

describe('Audit Edge Cases - Parser & Normalizer', () => {
  it('handles completely empty CSV string', () => {
    const result = parseBankCsv('', { accountId: 'acc_1' });
    expect(result.totalRows).toBe(0);
    expect(result.parsedTransactions).toEqual([]);
    expect(result.headers).toEqual([]);
  });

  it('handles CSV with only whitespace and empty newlines', () => {
    const result = parseBankCsv('   \n\n\r\n   \t  \n', { accountId: 'acc_1' });
    expect(result.totalRows).toBe(0);
    expect(result.parsedTransactions).toEqual([]);
  });

  it('handles CSV with header only, zero data rows', () => {
    const result = parseBankCsv('Date,Description,Amount\n', { accountId: 'acc_1' });
    expect(result.totalRows).toBe(0);
    expect(result.parsedTransactions).toEqual([]);
  });

  it('handles malformed CSV without proper delimiters or columns', () => {
    const malformed = 'Not a CSV at all! Just some random text\nAnother line with no commas';
    const result = parseBankCsv(malformed, { accountId: 'acc_1' });
    // Should not throw, should return 0 parsed valid transactions
    expect(result.parsedTransactions.length).toBe(0);
  });

  it('handles special characters and emojis in description', () => {
    const raw = '🍣 Sushi Bar & Grill #123 (Downtown) - 100% Organic! 🚀';
    const { clean, original } = cleanDescription(raw);
    expect(clean).toContain('Sushi Bar & Grill');
    expect(original).toBe(raw);
  });

  it('identifies formula injection in descriptions (CSV Injection)', () => {
    const formulas = [
      '=cmd|\' /C calc\'!A0',
      '+1+2',
      '-2+3',
      '@SUM(A1:A10)',
      '\t=1+1',
      '\r=2+2',
    ];

    for (const f of formulas) {
      const { clean, original } = cleanDescription(f);
      // Verify leading formula characters are neutralized by prepending single quote
      expect(clean.startsWith("'")).toBe(true);
      expect(original.startsWith("'")).toBe(true);
    }
  });

  it('handles extreme numbers (zero, large values, micro-cents)', () => {
    const normZero = normalizeAmount('$0.00');
    expect(normZero.amount).toBe(0);

    const normBig = normalizeAmount('$1,234,567,890.50');
    expect(normBig.amount).toBe(1234567890.50);

    const normNeg = normalizeAmount('($9,999.99)');
    expect(normNeg.amount).toBe(-9999.99);
  });
});
