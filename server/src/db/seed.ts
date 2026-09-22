import { db } from './database.js';
import { generateTransactionHash } from '../parser/normalizer.js';

export async function seedDemoData() {
  const demoUser = await db.queryOne<{ id: number }>('SELECT id FROM users WHERE email = $1', ['demo@fintrack.app']);
  if (!demoUser) return;

  const userId = demoUser.id;
  const txCount = await db.queryOne<{ count: number | string }>('SELECT COUNT(*) as count FROM transactions WHERE user_id = $1', [userId]);
  if (Number(txCount?.count || 0) > 0) return; // Already seeded

  console.log('🌱 Seeding demo transactions, budgets, and rules...');

  // Get categories
  const categories = await db.query<{ id: number; name: string }>('SELECT id, name FROM categories');
  const getCatId = (name: string) => categories.find(c => c.name.toLowerCase().includes(name.toLowerCase()))?.id || null;

  const groceriesId = getCatId('Groceries');
  const diningId = getCatId('Dining');
  const transportId = getCatId('Transport');
  const subsId = getCatId('Subscriptions');
  const utilitiesId = getCatId('Utilities');
  const shoppingId = getCatId('Shopping');
  const incomeId = getCatId('Income');

  const demoTransactions = [
    // Income
    { acc: 'acc_checking', date: '2026-07-01', desc: 'TechCorp Payroll Direct Deposit', amt: 4850.00, type: 'credit', cat: incomeId },
    { acc: 'acc_checking', date: '2026-07-15', desc: 'TechCorp Payroll Direct Deposit', amt: 4850.00, type: 'credit', cat: incomeId },
    { acc: 'acc_checking', date: '2026-08-01', desc: 'TechCorp Payroll Direct Deposit', amt: 4850.00, type: 'credit', cat: incomeId },
    { acc: 'acc_checking', date: '2026-08-15', desc: 'TechCorp Payroll Direct Deposit', amt: 4850.00, type: 'credit', cat: incomeId },
    { acc: 'acc_checking', date: '2026-09-01', desc: 'TechCorp Payroll Direct Deposit', amt: 4850.00, type: 'credit', cat: incomeId },
    { acc: 'acc_checking', date: '2026-09-15', desc: 'TechCorp Payroll Direct Deposit', amt: 4850.00, type: 'credit', cat: incomeId },

    // Rent / Housing
    { acc: 'acc_checking', date: '2026-07-01', desc: 'Avalon Bay Communities Rent', amt: -2400.00, type: 'debit', cat: utilitiesId },
    { acc: 'acc_checking', date: '2026-08-01', desc: 'Avalon Bay Communities Rent', amt: -2400.00, type: 'debit', cat: utilitiesId },
    { acc: 'acc_checking', date: '2026-09-01', desc: 'Avalon Bay Communities Rent', amt: -2400.00, type: 'debit', cat: utilitiesId },

    // Recurring Subscriptions (consistent monthly cadence for detector)
    { acc: 'acc_chase_cc', date: '2026-07-12', desc: 'Netflix.com Subscription', amt: -19.99, type: 'debit', cat: subsId },
    { acc: 'acc_chase_cc', date: '2026-08-12', desc: 'Netflix.com Subscription', amt: -19.99, type: 'debit', cat: subsId },
    { acc: 'acc_chase_cc', date: '2026-09-12', desc: 'Netflix.com Subscription', amt: -19.99, type: 'debit', cat: subsId },

    { acc: 'acc_chase_cc', date: '2026-07-18', desc: 'Spotify Premium Family', amt: -16.99, type: 'debit', cat: subsId },
    { acc: 'acc_chase_cc', date: '2026-08-18', desc: 'Spotify Premium Family', amt: -16.99, type: 'debit', cat: subsId },
    { acc: 'acc_chase_cc', date: '2026-09-18', desc: 'Spotify Premium Family', amt: -16.99, type: 'debit', cat: subsId },

    { acc: 'acc_chase_cc', date: '2026-07-05', desc: 'Equinox Fitness Club', amt: -280.00, type: 'debit', cat: subsId },
    { acc: 'acc_chase_cc', date: '2026-08-05', desc: 'Equinox Fitness Club', amt: -280.00, type: 'debit', cat: subsId },
    { acc: 'acc_chase_cc', date: '2026-09-05', desc: 'Equinox Fitness Club', amt: -280.00, type: 'debit', cat: subsId },

    // Groceries (July, August, September)
    { acc: 'acc_chase_cc', date: '2026-07-03', desc: 'Whole Foods Market #1024', amt: -142.50, type: 'debit', cat: groceriesId },
    { acc: 'acc_chase_cc', date: '2026-07-11', desc: 'Trader Joe\'s Store 042', amt: -86.20, type: 'debit', cat: groceriesId },
    { acc: 'acc_chase_cc', date: '2026-07-22', desc: 'Safeway Supermarket', amt: -115.40, type: 'debit', cat: groceriesId },

    { acc: 'acc_chase_cc', date: '2026-08-04', desc: 'Whole Foods Market #1024', amt: -168.30, type: 'debit', cat: groceriesId },
    { acc: 'acc_chase_cc', date: '2026-08-14', desc: 'Trader Joe\'s Store 042', amt: -92.15, type: 'debit', cat: groceriesId },
    { acc: 'acc_chase_cc', date: '2026-08-25', desc: 'Safeway Supermarket', amt: -124.80, type: 'debit', cat: groceriesId },

    { acc: 'acc_chase_cc', date: '2026-09-03', desc: 'Whole Foods Market #1024', amt: -154.20, type: 'debit', cat: groceriesId },
    { acc: 'acc_chase_cc', date: '2026-09-10', desc: 'Trader Joe\'s Store 042', amt: -79.40, type: 'debit', cat: groceriesId },
    { acc: 'acc_chase_cc', date: '2026-09-17', desc: 'Safeway Supermarket', amt: -138.90, type: 'debit', cat: groceriesId },

    // Dining & Drinks
    { acc: 'acc_chase_cc', date: '2026-09-02', desc: 'Starbucks Coffee Reserve', amt: -7.85, type: 'debit', cat: diningId },
    { acc: 'acc_chase_cc', date: '2026-09-06', desc: 'Chipotle Mexican Grill', amt: -18.40, type: 'debit', cat: diningId },
    { acc: 'acc_chase_cc', date: '2026-09-09', desc: 'DoorDash - Sushi Zen', amt: -56.70, type: 'debit', cat: diningId },
    { acc: 'acc_chase_cc', date: '2026-09-14', desc: 'Blue Bottle Coffee', amt: -6.50, type: 'debit', cat: diningId },
    { acc: 'acc_chase_cc', date: '2026-09-19', desc: 'The Slanted Door Restaurant', amt: -145.00, type: 'debit', cat: diningId },

    // Transport
    { acc: 'acc_chase_cc', date: '2026-09-04', desc: 'Uber *Trip 9821 San Francisco', amt: -28.40, type: 'debit', cat: transportId },
    { acc: 'acc_chase_cc', date: '2026-09-08', desc: 'Chevron Gas Station 4821', amt: -54.20, type: 'debit', cat: transportId },
    { acc: 'acc_chase_cc', date: '2026-09-16', desc: 'Uber *Trip 3412 Airport', amt: -45.90, type: 'debit', cat: transportId },

    // Shopping
    { acc: 'acc_chase_cc', date: '2026-09-07', desc: 'Amazon.com Prime Order', amt: -89.99, type: 'debit', cat: shoppingId },
    { acc: 'acc_chase_cc', date: '2026-09-13', desc: 'Apple Store Retail Purchase', amt: -199.00, type: 'debit', cat: shoppingId },

    // Utilities
    { acc: 'acc_checking', date: '2026-09-10', desc: 'PG&E Electric & Gas Utility', amt: -128.40, type: 'debit', cat: utilitiesId },
    { acc: 'acc_checking', date: '2026-09-15', desc: 'Sonic Gigabit Fiber Internet', amt: -65.00, type: 'debit', cat: utilitiesId },
  ];

  for (const t of demoTransactions) {
    const hash = generateTransactionHash(t.acc, t.date, t.desc, t.amt);
    await db.execute(
      `INSERT INTO transactions (user_id, account_id, date, description, original_description, amount, type, category_id, hash, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [userId, t.acc, t.date, t.desc, t.desc, t.amt, t.type, t.cat, hash, JSON.stringify({ seeded: true })]
    );
  }

  // Seed Budgets for September 2026
  if (groceriesId) await db.execute('INSERT INTO budgets (user_id, category_id, amount, period) VALUES ($1, $2, $3, $4)', [userId, groceriesId, 500.00, '2026-09']);
  if (diningId) await db.execute('INSERT INTO budgets (user_id, category_id, amount, period) VALUES ($1, $2, $3, $4)', [userId, diningId, 350.00, '2026-09']);
  if (subsId) await db.execute('INSERT INTO budgets (user_id, category_id, amount, period) VALUES ($1, $2, $3, $4)', [userId, subsId, 350.00, '2026-09']);
  if (transportId) await db.execute('INSERT INTO budgets (user_id, category_id, amount, period) VALUES ($1, $2, $3, $4)', [userId, transportId, 200.00, '2026-09']);
  if (shoppingId) await db.execute('INSERT INTO budgets (user_id, category_id, amount, period) VALUES ($1, $2, $3, $4)', [userId, shoppingId, 400.00, '2026-09']);
  if (utilitiesId) await db.execute('INSERT INTO budgets (user_id, category_id, amount, period) VALUES ($1, $2, $3, $4)', [userId, utilitiesId, 2700.00, '2026-09']);

  console.log('✅ Demo data seeded successfully.');
}
