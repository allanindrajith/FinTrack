import { describe, it, expect } from 'vitest';
import { normalizeDate, normalizeAmount, cleanDescription, generateTransactionHash } from '../parser/normalizer.js';

describe('Normalizer - Date Parsing', () => {
  it('parses standard ISO dates (YYYY-MM-DD)', () => {
    expect(normalizeDate('2026-09-22')).toBe('2026-09-22');
    expect(normalizeDate('2026/01/05')).toBe('2026-01-05');
    expect(normalizeDate('2026.12.31')).toBe('2026-12-31');
    expect(normalizeDate('2026-05-14T09:30:00Z')).toBe('2026-05-14');
    expect(normalizeDate('2026-08-19 18:45:00')).toBe('2026-08-19');
  });

  it('parses US format (MM/DD/YYYY)', () => {
    expect(normalizeDate('09/22/2026', { dateFormatPreference: 'US' })).toBe('2026-09-22');
    expect(normalizeDate('1/5/2026', { dateFormatPreference: 'US' })).toBe('2026-01-05');
    expect(normalizeDate('12/31/2025')).toBe('2025-12-31'); // 31 > 12 auto-detects
  });

  it('parses European format (DD/MM/YYYY and DD.MM.YYYY)', () => {
    expect(normalizeDate('22/09/2026')).toBe('2026-09-22'); // 22 > 12 auto-detects EU
    expect(normalizeDate('15.08.2026')).toBe('2026-08-15'); // dot delimiter standard EU
    expect(normalizeDate('05/01/2026', { dateFormatPreference: 'EU' })).toBe('2026-01-05');
  });

  it('parses text month formats', () => {
    expect(normalizeDate('15 Jan 2026')).toBe('2026-01-15');
    expect(normalizeDate('Jan 15, 2026')).toBe('2026-01-15');
    expect(normalizeDate('15-Jan-2026')).toBe('2026-01-15');
    expect(normalizeDate('15-Jan-26')).toBe('2026-01-15');
    expect(normalizeDate('October 31, 2026')).toBe('2026-10-31');
  });

  it('throws for completely invalid date strings', () => {
    expect(() => normalizeDate('not-a-date')).toThrow();
    expect(() => normalizeDate('')).toThrow();
  });
});

describe('Normalizer - Amount & Polarity Parsing', () => {
  it('parses standard positive and negative numbers', () => {
    expect(normalizeAmount('123.45')).toEqual({ amount: 123.45, type: 'credit' });
    expect(normalizeAmount('-45.99')).toEqual({ amount: -45.99, type: 'debit' });
  });

  it('handles currency symbols ($ € £ ₹)', () => {
    expect(normalizeAmount('$1,234.56')).toEqual({ amount: 1234.56, type: 'credit' });
    expect(normalizeAmount('-$50.00')).toEqual({ amount: -50.00, type: 'debit' });
    expect(normalizeAmount('£79.99')).toEqual({ amount: 79.99, type: 'credit' });
    expect(normalizeAmount('€ 45,99')).toEqual({ amount: 45.99, type: 'credit' });
  });

  it('handles parenthetical negative numbers (e.g. (150.00))', () => {
    expect(normalizeAmount('(150.00)')).toEqual({ amount: -150.00, type: 'debit' });
    expect(normalizeAmount('($2,450.50)')).toEqual({ amount: -2450.50, type: 'debit' });
  });

  it('handles European thousands and decimal separators (1.234,56)', () => {
    expect(normalizeAmount('1.234,56')).toEqual({ amount: 1234.56, type: 'credit' });
    expect(normalizeAmount('-2.500,00')).toEqual({ amount: -2500.00, type: 'debit' });
    expect(normalizeAmount('45,50')).toEqual({ amount: 45.50, type: 'credit' });
  });

  it('handles trailing minus signs and CR/DR indicators', () => {
    expect(normalizeAmount('45.99-')).toEqual({ amount: -45.99, type: 'debit' });
    expect(normalizeAmount('100.00 DR')).toEqual({ amount: -100.00, type: 'debit' });
    expect(normalizeAmount('250.00 CR')).toEqual({ amount: 250.00, type: 'credit' });
  });

  it('respects type hints (e.g. sale, payment, debit, credit)', () => {
    expect(normalizeAmount('50.00', 'sale')).toEqual({ amount: -50.00, type: 'debit' });
    expect(normalizeAmount('50.00', 'debit')).toEqual({ amount: -50.00, type: 'debit' });
    expect(normalizeAmount('500.00', 'deposit')).toEqual({ amount: 500.00, type: 'credit' });
    expect(normalizeAmount('500.00', 'payment')).toEqual({ amount: 500.00, type: 'credit' });
  });
});

describe('Normalizer - Description Cleaning', () => {
  it('cleans redundant bank prefixes and merchant codes', () => {
    const res1 = cleanDescription('PURCHASE AUTHORIZED ON 09/22 UBER *TRIP 1234 CA S12345678');
    expect(res1.clean).toContain('UBER *TRIP 1234 CA');
    expect(res1.original).toBe('PURCHASE AUTHORIZED ON 09/22 UBER *TRIP 1234 CA S12345678');

    const res2 = cleanDescription('SQ *BLUE BOTTLE COFFEE');
    expect(res2.clean).toBe('BLUE BOTTLE COFFEE');

    const res3 = cleanDescription('TST* JOES DINER');
    expect(res3.clean).toBe('JOES DINER');
  });
});

describe('Normalizer - Deduplication Fingerprint Hash', () => {
  it('generates consistent hashes for identical transactions', () => {
    const hash1 = generateTransactionHash('acc_1', '2026-09-22', 'Uber *Trip', -24.50);
    const hash2 = generateTransactionHash('acc_1', '2026-09-22', 'uber trip', -24.50);
    expect(hash1).toBe(hash2);
  });

  it('generates different hashes for different dates or amounts', () => {
    const hash1 = generateTransactionHash('acc_1', '2026-09-22', 'Netflix', -19.99);
    const hash2 = generateTransactionHash('acc_1', '2026-08-22', 'Netflix', -19.99);
    const hash3 = generateTransactionHash('acc_1', '2026-09-22', 'Netflix', -15.99);
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });
});
