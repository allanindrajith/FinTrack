import { Router, Response } from 'express';
import multer from 'multer';
import { db } from '../db/database.js';
import { AuthRequest, requireAuth } from './auth.js';
import { parseBankCsv } from '../parser/csvParser.js';
import { autoCategorizeTransactions } from '../engine/categorizer.js';
import { Category, CategoryRule, ColumnMapping } from '../types/index.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

// POST /api/transactions/preview - Preview CSV before importing (inspect columns & detect preset)
router.post('/preview', requireAuth, upload.single('file'), (req: AuthRequest, res: Response): void => {
  let csvContent = '';

  if (req.file) {
    csvContent = req.file.buffer.toString('utf-8');
  } else if (req.body.csvText) {
    csvContent = req.body.csvText;
  } else {
    res.status(400).json({ error: 'No CSV file or text provided' });
    return;
  }

  const accountId = req.body.accountId || 'preview';
  const customMapping = req.body.customMapping ? JSON.parse(req.body.customMapping) : undefined;
  const dateFormatPreference = req.body.dateFormatPreference;

  const result = parseBankCsv(csvContent, {
    accountId,
    customMapping,
    dateFormatPreference,
  });

  res.json({
    headers: result.headers,
    previewRows: result.previewRows,
    detectedPreset: result.detectedPreset,
    detectedPresetName: result.detectedPresetName,
    confidence: result.confidence,
    totalRows: result.totalRows,
    sampleParsed: result.parsedTransactions.slice(0, 5),
  });
});

// POST /api/transactions/upload - Process and save CSV transactions to DB with deduplication and auto-categorization
router.post('/upload', requireAuth, upload.single('file'), (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  let csvContent = '';

  if (req.file) {
    csvContent = req.file.buffer.toString('utf-8');
  } else if (req.body.csvText) {
    csvContent = req.body.csvText;
  } else {
    res.status(400).json({ error: 'No CSV file or text provided' });
    return;
  }

  const accountId = req.body.accountId;
  if (!accountId) {
    res.status(400).json({ error: 'Account ID is required' });
    return;
  }

  // Ensure account belongs to user
  const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  let customMapping: ColumnMapping | undefined;
  if (req.body.customMapping) {
    try {
      customMapping = typeof req.body.customMapping === 'string' ? JSON.parse(req.body.customMapping) : req.body.customMapping;
    } catch {}
  }

  const dateFormatPreference = req.body.dateFormatPreference || 'AUTO';
  const invertAmountSign = req.body.invertAmountSign === 'true' || req.body.invertAmountSign === true;

  // 1. Fetch existing hashes for this user and account
  const existingRows = db.prepare('SELECT hash FROM transactions WHERE user_id = ? AND account_id = ?').all(userId, accountId) as { hash: string }[];
  const existingHashes = new Set<string>(existingRows.map(r => r.hash));

  // 2. Parse CSV
  const parseResult = parseBankCsv(csvContent, {
    accountId,
    customMapping,
    dateFormatPreference,
    invertAmountSign,
    existingHashes,
  });

  // 3. Fetch categories and user rules for auto-categorization
  const categories = db.prepare('SELECT * FROM categories WHERE user_id IS NULL OR user_id = ?').all(userId) as unknown as Category[];
  const userRules = db.prepare('SELECT * FROM category_rules WHERE user_id = ? ORDER BY priority DESC').all(userId) as unknown as CategoryRule[];

  // 4. Auto-categorize new transactions
  const categorized = autoCategorizeTransactions(parseResult.newTransactions, userRules, categories);

  // 5. Batch insert into database
  const insertTx = db.prepare(`
    INSERT INTO transactions (user_id, account_id, date, description, original_description, amount, type, category_id, hash, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const tx of categorized) {
      insertTx.run(
        userId,
        tx.accountId,
        tx.date,
        tx.description,
        tx.originalDescription,
        tx.amount,
        tx.type,
        tx.categoryId || null,
        tx.hash,
        JSON.stringify(tx.rawData || {})
      );
    }
    db.exec('COMMIT;');
  } catch (err: any) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: `Database insert failed: ${err.message}` });
    return;
  }

  res.json({
    totalRows: parseResult.totalRows,
    importedCount: categorized.length,
    duplicatesSkipped: parseResult.duplicatesSkipped,
    detectedPreset: parseResult.detectedPreset,
    detectedPresetName: parseResult.detectedPresetName,
    confidence: parseResult.confidence,
  });
});

// GET /api/transactions - Filterable, sortable, paginated transaction list
router.get('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const {
    accountId,
    categoryId,
    search,
    startDate,
    endDate,
    type,
    limit = '50',
    offset = '0',
    sortBy = 'date',
    sortOrder = 'DESC',
  } = req.query;

  let query = `
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon, a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.user_id = ?
  `;
  const params: any[] = [userId];

  if (accountId) {
    query += ' AND t.account_id = ?';
    params.push(accountId);
  }
  if (categoryId) {
    query += ' AND t.category_id = ?';
    params.push(categoryId);
  }
  if (type) {
    query += ' AND t.type = ?';
    params.push(type);
  }
  if (startDate) {
    query += ' AND t.date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND t.date <= ?';
    params.push(endDate);
  }
  if (search) {
    query += ' AND (t.description LIKE ? OR t.original_description LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term);
  }

  // Count total matching
  const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
  const countResult = db.prepare(countQuery).get(...params) as { total: number };

  // Apply sorting and pagination
  const allowedSorts = ['date', 'amount', 'description'];
  const sortCol = allowedSorts.includes(sortBy as string) ? (sortBy as string) : 'date';
  const sortDir = (sortOrder as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  query += ` ORDER BY t.${sortCol} ${sortDir}, t.id DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

  const transactions = db.prepare(query).all(...params);

  res.json({
    transactions,
    total: countResult.total,
    limit: parseInt(limit as string, 10),
    offset: parseInt(offset as string, 10),
  });
});

// PUT /api/transactions/:id - Update transaction
router.put('/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { description, categoryId, date, amount } = req.body;

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
  if (!tx) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  db.prepare(`
    UPDATE transactions 
    SET description = COALESCE(?, description),
        category_id = ?,
        date = COALESCE(?, date),
        amount = COALESCE(?, amount),
        type = CASE WHEN ? < 0 THEN 'debit' ELSE 'credit' END
    WHERE id = ? AND user_id = ?
  `).run(
    description || null,
    categoryId !== undefined ? categoryId : null,
    date || null,
    amount !== undefined ? amount : null,
    amount !== undefined ? amount : (tx as any).amount,
    id,
    userId
  );

  const updated = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon, a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ?
  `).get(id);

  res.json({ transaction: updated });
});

// POST /api/transactions/:id/recategorize - Recategorize & remember rule for future imports
router.post('/:id/recategorize', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { categoryId, createRule = false, rulePattern } = req.body;

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId) as any;
  if (!tx) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  // Update current transaction
  db.prepare('UPDATE transactions SET category_id = ? WHERE id = ? AND user_id = ?').run(categoryId, id, userId);

  let ruleCreated = false;
  let otherUpdatedCount = 0;

  if (createRule && categoryId) {
    // Pattern to remember: user-specified or extracted keyword
    const pattern = (rulePattern || tx.description).trim().toUpperCase();
    if (pattern) {
      // Save rule
      db.prepare(`
        INSERT INTO category_rules (user_id, category_id, pattern, match_type, priority)
        VALUES (?, ?, ?, 'contains', 25)
      `).run(userId, categoryId, pattern);
      ruleCreated = true;

      // Retroactively update all other transactions matching this pattern
      const updateOthers = db.prepare(`
        UPDATE transactions 
        SET category_id = ? 
        WHERE user_id = ? AND UPPER(description) LIKE ? AND id != ?
      `).run(categoryId, userId, `%${pattern}%`, id);
      otherUpdatedCount = Number(updateOthers.changes);
    }
  }

  const updated = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon, a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ?
  `).get(id);

  res.json({
    transaction: updated,
    ruleCreated,
    otherTransactionsUpdated: otherUpdatedCount,
  });
});

// DELETE /api/transactions/:id
router.delete('/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { id } = req.params;

  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, userId);
  res.json({ success: true, message: 'Transaction deleted' });
});

// DELETE /api/transactions/bulk - Clear transactions for account
router.delete('/bulk/account/:accountId', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { accountId } = req.params;

  const result = db.prepare('DELETE FROM transactions WHERE account_id = ? AND user_id = ?').run(accountId, userId);
  res.json({ success: true, deletedCount: Number(result.changes) });
});

export default router;
