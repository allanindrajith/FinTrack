import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from '../engine/categorizer.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'fintrack.db');
export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for performance and data integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      currency TEXT DEFAULT 'USD',
      institution TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      match_type TEXT NOT NULL,
      pattern TEXT NOT NULL,
      priority INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      original_description TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category_id INTEGER,
      hash TEXT NOT NULL,
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_user_hash ON transactions(user_id, hash);
    CREATE INDEX IF NOT EXISTS idx_tx_account_date ON transactions(account_id, date);
    CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      period TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(user_id, category_id, period)
    );
  `);

  // Seed default categories if none exist
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories WHERE is_default = 1').get() as { count: number };
  if (catCount.count === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, color, icon, is_default) VALUES (?, ?, ?, 1)');
    for (const cat of DEFAULT_CATEGORIES) {
      insertCat.run(cat.name, cat.color, cat.icon);
    }
  }

  // Pre-seed demo user if not exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?').get('demo@fintrack.app') as { count: number };
  if (userCount.count === 0) {
    // demo password: "password123"
    // precomputed bcrypt hash for "password123":
    const demoHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
    const res = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(
      'demo@fintrack.app',
      demoHash,
      'Demo User'
    );
    const userId = Number(res.lastInsertRowid);

    // Create default accounts for demo user
    const insertAcc = db.prepare('INSERT INTO accounts (id, user_id, name, type, currency, institution) VALUES (?, ?, ?, ?, ?, ?)');
    insertAcc.run('acc_chase_cc', userId, 'Chase Sapphire Preferred', 'credit', 'USD', 'Chase');
    insertAcc.run('acc_checking', userId, 'Primary Checking', 'checking', 'USD', 'Chase');
    insertAcc.run('acc_revolut', userId, 'Revolut Travel Account', 'checking', 'EUR', 'Revolut');
  }
}
