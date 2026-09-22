import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { DEFAULT_CATEGORIES } from '../engine/categorizer.js';

const { Pool } = pg;

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  lastInsertId?: number | string;
}

class DatabaseAdapter {
  private pgPool: pg.Pool | null = null;
  private sqliteDb: DatabaseSync | null = null;
  public isPostgres = false;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
      this.isPostgres = true;
      this.pgPool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.DB_SSL === 'false' ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined),
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      console.log('📦 Database initialized: PostgreSQL connection pool active');
    } else {
      this.isPostgres = false;
      const DB_DIR = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'fintrack.db');
      this.sqliteDb = new DatabaseSync(DB_PATH);
      this.sqliteDb.exec('PRAGMA journal_mode = WAL;');
      this.sqliteDb.exec('PRAGMA foreign_keys = ON;');
      console.log(`📦 Database initialized: SQLite active (${DB_PATH})`);
    }
  }

  /**
   * Normalize SQL placeholders:
   * Translates $1, $2 to ? for SQLite, or ? to $1, $2 for Postgres
   */
  private formatQuery(sql: string): string {
    if (this.isPostgres) {
      if (sql.includes('?')) {
        let index = 1;
        return sql.replace(/\?/g, () => `$${index++}`);
      }
      return sql;
    } else {
      return sql.replace(/\$[0-9]+/g, '?');
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const formatted = this.formatQuery(sql);
    if (this.isPostgres && this.pgPool) {
      const res = await this.pgPool.query(formatted, params);
      return res.rows as T[];
    } else if (this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(formatted);
      return stmt.all(...params) as T[];
    }
    return [];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params: any[] = []): Promise<{ lastInsertId?: number | string; rowCount: number }> {
    const formatted = this.formatQuery(sql);
    if (this.isPostgres && this.pgPool) {
      // If INSERT without RETURNING, try to capture id if available
      let querySql = formatted;
      if (querySql.trim().toUpperCase().startsWith('INSERT INTO') && !querySql.toUpperCase().includes('RETURNING')) {
        querySql = `${querySql} RETURNING id`;
      }
      const res = await this.pgPool.query(querySql, params);
      const lastInsertId = res.rows.length > 0 && res.rows[0].id !== undefined ? res.rows[0].id : undefined;
      return { lastInsertId, rowCount: res.rowCount || 0 };
    } else if (this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(formatted);
      const result = stmt.run(...params);
      return {
        lastInsertId: Number(result.lastInsertRowid),
        rowCount: Number(result.changes),
      };
    }
    return { rowCount: 0 };
  }

  async initSchema(): Promise<void> {
    if (this.isPostgres && this.pgPool) {
      await this.pgPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash TEXT,
          name VARCHAR(255) NOT NULL,
          currency_preference VARCHAR(10) DEFAULT 'USD',
          avatar_url TEXT,
          email_verified BOOLEAN DEFAULT FALSE,
          verification_token TEXT,
          verification_expires TIMESTAMP WITH TIME ZONE,
          password_reset_token TEXT,
          password_reset_expires TIMESTAMP WITH TIME ZONE,
          encryption_salt VARCHAR(64) NOT NULL,
          data_retention_days INTEGER,
          ai_consent BOOLEAN DEFAULT FALSE,
          ai_provider VARCHAR(50) DEFAULT 'gemini',
          ai_byo_key_encrypted TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS accounts (
          id VARCHAR(64) PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          institution VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          color VARCHAR(50) NOT NULL,
          icon VARCHAR(50) NOT NULL,
          is_default INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS category_rules (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          match_type VARCHAR(50) NOT NULL,
          pattern VARCHAR(255) NOT NULL,
          priority INTEGER DEFAULT 10,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          date VARCHAR(30) NOT NULL,
          encrypted_blob TEXT NOT NULL,
          hash VARCHAR(128) NOT NULL,
          raw_data TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP WITH TIME ZONE
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_user_hash ON transactions(user_id, hash);
        CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);
        CREATE INDEX IF NOT EXISTS idx_tx_deleted_at ON transactions(deleted_at);

        CREATE TABLE IF NOT EXISTS budgets (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          amount NUMERIC(14, 2) NOT NULL,
          period VARCHAR(20) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, category_id, period)
        );

        CREATE TABLE IF NOT EXISTS ai_conversations (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(20) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_deletion_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          records_deleted INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else if (this.sqliteDb) {
      this.sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          name TEXT NOT NULL,
          currency_preference TEXT DEFAULT 'USD',
          avatar_url TEXT,
          email_verified INTEGER DEFAULT 0,
          verification_token TEXT,
          verification_expires DATETIME,
          password_reset_token TEXT,
          password_reset_expires DATETIME,
          encryption_salt TEXT NOT NULL,
          data_retention_days INTEGER,
          ai_consent INTEGER DEFAULT 0,
          ai_provider TEXT DEFAULT 'gemini',
          ai_byo_key_encrypted TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
          is_default INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
          encrypted_blob TEXT,
          hash TEXT NOT NULL,
          raw_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          deleted_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
        );

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

        CREATE TABLE IF NOT EXISTS ai_conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS audit_deletion_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          records_deleted INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // SQLite Migration Check for pre-existing tables
      try {
        const userCols = (this.sqliteDb as any).prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
        const userColNames = new Set(userCols.map(c => c.name));
        if (userColNames.size > 0) {
          if (!userColNames.has('currency_preference')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN currency_preference TEXT DEFAULT "USD"');
          if (!userColNames.has('avatar_url')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
          if (!userColNames.has('encryption_salt')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN encryption_salt TEXT DEFAULT ""');
          if (!userColNames.has('email_verified')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
          if (!userColNames.has('verification_token')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN verification_token TEXT');
          if (!userColNames.has('verification_expires')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN verification_expires DATETIME');
          if (!userColNames.has('password_reset_token')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN password_reset_token TEXT');
          if (!userColNames.has('password_reset_expires')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN password_reset_expires DATETIME');
          if (!userColNames.has('data_retention_days')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN data_retention_days INTEGER');
          if (!userColNames.has('ai_consent')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN ai_consent INTEGER DEFAULT 0');
          if (!userColNames.has('ai_provider')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN ai_provider TEXT DEFAULT "gemini"');
          if (!userColNames.has('ai_byo_key_encrypted')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN ai_byo_key_encrypted TEXT');
          if (!userColNames.has('updated_at')) this.sqliteDb.exec('ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT NULL');

          // Ensure any users with empty salt receive a valid salt
          this.sqliteDb.exec(`UPDATE users SET encryption_salt = 'a1b2c3d4e5f60718' WHERE encryption_salt IS NULL OR encryption_salt = ''`);
        }

        const catCols = (this.sqliteDb as any).prepare('PRAGMA table_info(categories)').all() as Array<{ name: string }>;
        const catColNames = new Set(catCols.map(c => c.name));
        if (catColNames.size > 0 && !catColNames.has('created_at')) {
          this.sqliteDb.exec('ALTER TABLE categories ADD COLUMN created_at DATETIME DEFAULT NULL');
        }

        const txCols = (this.sqliteDb as any).prepare('PRAGMA table_info(transactions)').all() as Array<{ name: string }>;
        const txColNames = new Set(txCols.map(c => c.name));
        if (txColNames.size > 0) {
          if (!txColNames.has('encrypted_blob')) this.sqliteDb.exec('ALTER TABLE transactions ADD COLUMN encrypted_blob TEXT');
          if (!txColNames.has('hash')) this.sqliteDb.exec('ALTER TABLE transactions ADD COLUMN hash TEXT');
          if (!txColNames.has('deleted_at')) this.sqliteDb.exec('ALTER TABLE transactions ADD COLUMN deleted_at DATETIME');
        }

        this.sqliteDb.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_user_hash ON transactions(user_id, hash);
          CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);
          CREATE INDEX IF NOT EXISTS idx_tx_deleted_at ON transactions(deleted_at);
        `);
      } catch (e) {
        console.warn('SQLite migration warning:', e);
      }
    }

    // Seed default categories
    const catRows = await this.query('SELECT COUNT(*) as count FROM categories WHERE is_default = 1');
    const count = Number(catRows[0]?.count || 0);
    if (count === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await this.execute(
          'INSERT INTO categories (name, color, icon, is_default) VALUES ($1, $2, $3, 1)',
          [cat.name, cat.color, cat.icon]
        );
      }
    }

    // Seed demo user with valid salt and demo password
    const demoUser = await this.queryOne('SELECT id FROM users WHERE email = $1', ['demo@fintrack.app']);
    if (!demoUser) {
      const demoHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // 'password123'
      const salt = crypto.randomBytes(16).toString('hex');
      const res = await this.execute(
        'INSERT INTO users (email, password_hash, name, encryption_salt, email_verified) VALUES ($1, $2, $3, $4, $5)',
        ['demo@fintrack.app', demoHash, 'Demo User', salt, this.isPostgres ? true : 1]
      );
      const userId = Number(res.lastInsertId);

      await this.execute(
        'INSERT INTO accounts (id, user_id, name, type, currency, institution) VALUES ($1, $2, $3, $4, $5, $6)',
        ['acc_chase_cc', userId, 'Chase Sapphire Preferred', 'credit', 'USD', 'Chase']
      );
      await this.execute(
        'INSERT INTO accounts (id, user_id, name, type, currency, institution) VALUES ($1, $2, $3, $4, $5, $6)',
        ['acc_checking', userId, 'Primary Checking', 'checking', 'USD', 'Chase']
      );
      await this.execute(
        'INSERT INTO accounts (id, user_id, name, type, currency, institution) VALUES ($1, $2, $3, $4, $5, $6)',
        ['acc_revolut', userId, 'Revolut Travel Account', 'checking', 'EUR', 'Revolut']
      );
    }
  }
}

export const db = new DatabaseAdapter();
export async function initDatabase(): Promise<void> {
  await db.initSchema();
}
