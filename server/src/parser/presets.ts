import { BankPreset, ColumnMapping } from '../types/index.js';

export const BANK_PRESETS: BankPreset[] = [
  {
    id: 'chase_credit_card',
    name: 'Chase Credit Card',
    description: 'Standard Chase Credit Card export (Transaction Date, Description, Amount, etc.)',
    matchesHeaders: (headers: string[]) => {
      const lower = headers.map(h => h.trim().toLowerCase());
      return lower.includes('transaction date') && lower.includes('post date') && lower.includes('description') && lower.includes('amount');
    },
    getMapping: (headers: string[]): ColumnMapping => {
      const findHeader = (target: string) => headers.find(h => h.trim().toLowerCase() === target) || '';
      return {
        date: findHeader('transaction date') || findHeader('post date'),
        description: findHeader('description'),
        amount: findHeader('amount'),
        type: findHeader('type'),
        category: findHeader('category'),
      };
    },
  },
  {
    id: 'chase_checking',
    name: 'Chase Checking / Savings',
    description: 'Standard Chase Bank statement export (Posting Date, Description, Amount, Type, etc.)',
    matchesHeaders: (headers: string[]) => {
      const lower = headers.map(h => h.trim().toLowerCase());
      return (lower.includes('posting date') || lower.includes('post date')) && lower.includes('description') && lower.includes('amount') && (lower.includes('details') || lower.includes('check or slip #'));
    },
    getMapping: (headers: string[]): ColumnMapping => {
      const findHeader = (target: string) => headers.find(h => h.trim().toLowerCase() === target) || '';
      return {
        date: findHeader('posting date') || findHeader('post date'),
        description: findHeader('description'),
        amount: findHeader('amount'),
        type: findHeader('type') || findHeader('details'),
      };
    },
  },
  {
    id: 'revolut',
    name: 'Revolut Statement',
    description: 'Revolut multi-currency statement (Completed Date, Description, Amount, Fee, etc.)',
    matchesHeaders: (headers: string[]) => {
      const lower = headers.map(h => h.trim().toLowerCase());
      return (lower.includes('completed date') || lower.includes('started date')) && lower.includes('description') && lower.includes('amount') && lower.includes('fee');
    },
    getMapping: (headers: string[]): ColumnMapping => {
      const findHeader = (target: string) => headers.find(h => h.trim().toLowerCase() === target) || '';
      return {
        date: findHeader('completed date') || findHeader('started date'),
        description: findHeader('description'),
        amount: findHeader('amount'),
        type: findHeader('type'),
      };
    },
  },
  {
    id: 'generic_debit_credit',
    name: 'Generic Statement (Debit / Credit Columns)',
    description: 'Statement with separate Debit and Credit columns',
    matchesHeaders: (headers: string[]) => {
      const lower = headers.map(h => h.trim().toLowerCase());
      const hasDate = lower.some(h => h.includes('date'));
      const hasDesc = lower.some(h => h.includes('desc') || h.includes('payee') || h.includes('merchant') || h.includes('memo') || h.includes('details'));
      const hasDebit = lower.some(h => h.includes('debit') || h.includes('withdrawal') || h.includes('money out') || h.includes('expense'));
      const hasCredit = lower.some(h => h.includes('credit') || h.includes('deposit') || h.includes('money in') || h.includes('income'));
      return hasDate && hasDesc && hasDebit && hasCredit;
    },
    getMapping: (headers: string[]): ColumnMapping => {
      const lower = headers.map(h => h.trim().toLowerCase());
      const dateIdx = lower.findIndex(h => h.includes('date'));
      const descIdx = lower.findIndex(h => h.includes('desc') || h.includes('payee') || h.includes('merchant') || h.includes('memo') || h.includes('details'));
      const debitIdx = lower.findIndex(h => h.includes('debit') || h.includes('withdrawal') || h.includes('money out') || h.includes('expense'));
      const creditIdx = lower.findIndex(h => h.includes('credit') || h.includes('deposit') || h.includes('money in') || h.includes('income'));

      return {
        date: headers[dateIdx] || '',
        description: headers[descIdx] || '',
        debit: headers[debitIdx] || '',
        credit: headers[creditIdx] || '',
      };
    },
  },
  {
    id: 'generic_amount',
    name: 'Generic Statement (Single Amount Column)',
    description: 'Statement with single signed/unsigned Amount column',
    matchesHeaders: (headers: string[]) => {
      const lower = headers.map(h => h.trim().toLowerCase());
      const hasDate = lower.some(h => h.includes('date'));
      const hasDesc = lower.some(h => h.includes('desc') || h.includes('payee') || h.includes('merchant') || h.includes('memo') || h.includes('narrative') || h.includes('details'));
      const hasAmount = lower.some(h => h.includes('amount') || h.includes('value') || h.includes('total'));
      return hasDate && hasDesc && hasAmount;
    },
    getMapping: (headers: string[]): ColumnMapping => {
      const lower = headers.map(h => h.trim().toLowerCase());
      const dateIdx = lower.findIndex(h => h.includes('date'));
      const descIdx = lower.findIndex(h => h.includes('desc') || h.includes('payee') || h.includes('merchant') || h.includes('memo') || h.includes('narrative') || h.includes('details'));
      const amountIdx = lower.findIndex(h => h.includes('amount') || h.includes('value') || h.includes('total'));
      const typeIdx = lower.findIndex(h => h.includes('type') || h.includes('trans type'));

      return {
        date: headers[dateIdx] || '',
        description: headers[descIdx] || '',
        amount: headers[amountIdx] || '',
        type: typeIdx !== -1 ? headers[typeIdx] : undefined,
      };
    },
  }
];

/**
 * Tries to find the best matching preset based on header names.
 */
export function detectPreset(headers: string[]): BankPreset | null {
  for (const preset of BANK_PRESETS) {
    if (preset.matchesHeaders(headers)) {
      return preset;
    }
  }
  return null;
}

/**
 * Intelligent fallback column auto-detector if no exact preset matches.
 */
export function autoDetectColumns(headers: string[]): ColumnMapping {
  const lower = headers.map(h => h.trim().toLowerCase());

  // Date column candidates
  const dateCandidates = ['transaction date', 'posting date', 'post date', 'date', 'txn date', 'effective date'];
  let dateCol = '';
  for (const cand of dateCandidates) {
    const idx = lower.indexOf(cand);
    if (idx !== -1) { dateCol = headers[idx]; break; }
  }
  if (!dateCol) {
    const idx = lower.findIndex(h => h.includes('date'));
    if (idx !== -1) dateCol = headers[idx];
  }

  // Description column candidates
  const descCandidates = ['description', 'payee', 'merchant', 'narrative', 'details', 'name', 'memo', 'transaction description'];
  let descCol = '';
  for (const cand of descCandidates) {
    const idx = lower.indexOf(cand);
    if (idx !== -1) { descCol = headers[idx]; break; }
  }
  if (!descCol) {
    const idx = lower.findIndex(h => h.includes('desc') || h.includes('payee') || h.includes('narrative'));
    if (idx !== -1) descCol = headers[idx];
  }

  // Debit/Credit vs Amount
  const debitIdx = lower.findIndex(h => h.includes('debit') || h.includes('withdrawal') || h.includes('money out') || h.includes('spent'));
  const creditIdx = lower.findIndex(h => h.includes('credit') || h.includes('deposit') || h.includes('money in') || h.includes('received'));
  const amountIdx = lower.findIndex(h => h.includes('amount') || h.includes('sum') || h.includes('value') || h.includes('total'));
  const typeIdx = lower.findIndex(h => h.includes('type'));
  const categoryIdx = lower.findIndex(h => h.includes('category'));

  const mapping: ColumnMapping = {
    date: dateCol || headers[0] || '',
    description: descCol || (headers.length > 1 ? headers[1] : ''),
  };

  if (debitIdx !== -1 && creditIdx !== -1) {
    mapping.debit = headers[debitIdx];
    mapping.credit = headers[creditIdx];
  } else if (amountIdx !== -1) {
    mapping.amount = headers[amountIdx];
  } else if (headers.length > 2) {
    mapping.amount = headers[2];
  }

  if (typeIdx !== -1) mapping.type = headers[typeIdx];
  if (categoryIdx !== -1) mapping.category = headers[categoryIdx];

  return mapping;
}
