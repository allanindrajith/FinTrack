import { describe, it, expect } from 'vitest';
import { parseBankCsv } from '../parser/csvParser.js';

describe('CSV Parser - Bank Format Presets & Edge Cases', () => {
  it('parses real-world Chase Credit Card statements with auto-detection', () => {
    const chaseCsv = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
09/15/2026,09/16/2026,WHOLEFDS SOMA 10145,Groceries,Sale,-84.32,
09/16/2026,09/17/2026,UBER *TRIP HELP.UBER.COM,Travel,Sale,-24.50,
09/18/2026,09/19/2026,AUTOMATIC PAYMENT - THANK YOU,,Payment,500.00,`;

    const result = parseBankCsv(chaseCsv, { accountId: 'chase_cc_1' });

    expect(result.detectedPreset).toBe('chase_credit_card');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.totalRows).toBe(3);
    expect(result.newTransactions.length).toBe(3);

    const [t1, t2, t3] = result.newTransactions;
    expect(t1.date).toBe('2026-09-15');
    expect(t1.amount).toBe(-84.32);
    expect(t1.type).toBe('debit');

    expect(t2.date).toBe('2026-09-16');
    expect(t2.amount).toBe(-24.50);

    expect(t3.date).toBe('2026-09-18');
    expect(t3.amount).toBe(500.00);
    expect(t3.type).toBe('credit');
  });

  it('parses real-world Revolut statements with timestamps and European metadata', () => {
    const revolutCsv = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-08-20 10:12:00,2026-08-20 10:15:00,Netflix.com,-15.99,0.00,EUR,COMPLETED,1250.40
TOPUP,Current,2026-08-21 14:00:00,2026-08-21 14:00:00,Salary Transfer,3200.00,0.00,EUR,COMPLETED,4450.40`;

    const result = parseBankCsv(revolutCsv, { accountId: 'revolut_eur_1' });

    expect(result.detectedPreset).toBe('revolut');
    expect(result.newTransactions.length).toBe(2);

    expect(result.newTransactions[0].date).toBe('2026-08-20');
    expect(result.newTransactions[0].description).toBe('Netflix.com');
    expect(result.newTransactions[0].amount).toBe(-15.99);

    expect(result.newTransactions[1].date).toBe('2026-08-21');
    expect(result.newTransactions[1].amount).toBe(3200.00);
    expect(result.newTransactions[1].type).toBe('credit');
  });

  it('parses Generic CSV with separate Debit and Credit columns', () => {
    const genericCsv = `Date,Description,Debit,Credit,Balance
2026-07-01,Trader Joe's,$62.40,,1200.00
2026-07-02,Client Payment,,$850.00,2050.00`;

    const result = parseBankCsv(genericCsv, { accountId: 'checking_1' });

    expect(result.newTransactions.length).toBe(2);
    expect(result.newTransactions[0].amount).toBe(-62.40);
    expect(result.newTransactions[0].type).toBe('debit');
    expect(result.newTransactions[1].amount).toBe(850.00);
    expect(result.newTransactions[1].type).toBe('credit');
  });

  it('handles bank preamble metadata lines cleanly', () => {
    const csvWithPreamble = `Bank Statement Export
Account Number: ****1234
Period: Sep 1 2026 - Sep 30 2026

Date,Description,Amount
2026-09-05,Coffee Shop,-4.50
2026-09-06,Grocery Market,-52.10`;

    const result = parseBankCsv(csvWithPreamble, { accountId: 'test_acc' });

    expect(result.newTransactions.length).toBe(2);
    expect(result.newTransactions[0].description).toBe('Coffee Shop');
    expect(result.newTransactions[0].amount).toBe(-4.50);
  });

  it('deduplicates identical records against existing database hashes', () => {
    const csv = `Date,Description,Amount
2026-09-10,Spotify Premium,-10.99
2026-09-11,Amazon Purchase,-35.50`;

    const firstImport = parseBankCsv(csv, { accountId: 'acc_dedupe' });
    expect(firstImport.newTransactions.length).toBe(2);
    expect(firstImport.duplicatesSkipped).toBe(0);

    const existingHashes = new Set(firstImport.newTransactions.map(t => t.hash));

    // Second import of same statement + 1 new row
    const secondCsv = `Date,Description,Amount
2026-09-10,Spotify Premium,-10.99
2026-09-11,Amazon Purchase,-35.50
2026-09-12,Gym Membership,-40.00`;

    const secondImport = parseBankCsv(secondCsv, {
      accountId: 'acc_dedupe',
      existingHashes,
    });

    expect(secondImport.totalRows).toBe(3);
    expect(secondImport.duplicatesSkipped).toBe(2);
    expect(secondImport.newTransactions.length).toBe(1);
    expect(secondImport.newTransactions[0].description).toBe('Gym Membership');
  });

  it('allows manual custom column mapping override', () => {
    const customHeaderCsv = `When,Narrative,Outflow,Inflow
2026-08-01,Rent Payment,1800.00,
2026-08-02,Consulting Gig,,2500.00`;

    const result = parseBankCsv(customHeaderCsv, {
      accountId: 'acc_custom',
      customMapping: {
        date: 'When',
        description: 'Narrative',
        debit: 'Outflow',
        credit: 'Inflow',
      },
    });

    expect(result.newTransactions.length).toBe(2);
    expect(result.newTransactions[0].description).toBe('Rent Payment');
    expect(result.newTransactions[0].amount).toBe(-1800.00);
    expect(result.newTransactions[1].amount).toBe(2500.00);
  });
});
