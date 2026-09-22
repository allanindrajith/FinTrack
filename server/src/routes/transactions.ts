import { Router, Response } from 'express';
import multer from 'multer';
import { db } from '../db/database.js';
import { AuthRequest, requireAuth } from './auth.js';
import { parseBankCsv } from '../parser/csvParser.js';
import { ColumnMapping } from '../types/index.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().split('.').pop() || '';
    const allowedExts = ['csv', 'tsv', 'txt'];
    const allowedMimes = [
      'text/csv',
      'text/plain',
      'text/tab-separated-values',
      'application/vnd.ms-excel',
      'application/csv',
      'text/x-csv',
    ];
    if (allowedExts.includes(ext) || allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Please upload a valid CSV, TSV, or plain text bank statement.'));
    }
  },
});
const router = Router();

// 1. POST /api/transactions/preview - Parse CSV structure for column mapping preview
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
  const customMapping = req.body.customMapping
    ? typeof req.body.customMapping === 'string'
      ? JSON.parse(req.body.customMapping)
      : req.body.customMapping
    : undefined;
  const dateFormatPreference = req.body.dateFormatPreference;
  const isFullParse = req.body.fullParse === 'true' || req.body.fullParse === true;

  try {
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
      sampleParsed: isFullParse ? result.parsedTransactions : result.parsedTransactions.slice(0, 10),
    });
  } catch (err: any) {
    console.error('Preview error:', err);
    res.status(400).json({ error: err.message || 'Failed to parse CSV file' });
  }
});

// 2. POST /api/transactions/upload-encrypted - Ingest client-encrypted transactions with blind deduplication
router.post('/upload-encrypted', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const txList = req.body.transactions || req.body.encryptedRecords;
  const accountId = req.body.accountId;

  if (!accountId || !Array.isArray(txList)) {
    res.status(400).json({ error: 'Invalid request: accountId and transactions/encryptedRecords array are required' });
    return;
  }

  try {
    // Verify account ownership
    const account = await db.queryOne('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [
      accountId,
      userId,
    ]);
    if (!account) {
      res.status(404).json({ error: 'Account not found or unauthorized' });
      return;
    }

    // Fetch existing blind hashes for this user and account to deduplicate
    const existingRows = await db.query<{ hash: string }>(
      'SELECT hash FROM transactions WHERE user_id = $1 AND account_id = $2 AND deleted_at IS NULL',
      [userId, accountId]
    );
    const existingHashes = new Set(existingRows.map((r) => r.hash));

    let importedCount = 0;
    let duplicatesSkipped = 0;

    for (const tx of txList) {
      const blob = tx.encryptedBlob || tx.encrypted_blob;
      if (!tx.date || !blob || !tx.hash) {
        continue;
      }

      if (existingHashes.has(tx.hash)) {
        duplicatesSkipped++;
        continue;
      }

      await db.execute(
        `INSERT INTO transactions (
          user_id, account_id, date, encrypted_blob, hash, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          accountId,
          tx.date,
          tx.encryptedBlob,
          tx.hash,
          tx.rawData || null,
        ]
      );

      existingHashes.add(tx.hash);
      importedCount++;
    }

    res.json({
      success: true,
      totalRows: txList.length,
      importedCount,
      duplicatesSkipped,
    });
  } catch (err: any) {
    console.error('Encrypted upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to save encrypted transactions' });
  }
});

// 2b. GET /api/transactions/encrypted — alias for GET / (used by api.getEncryptedTransactions())
// Returns the same encrypted blobs; explicit path makes the zero-knowledge contract clear.
router.get('/encrypted', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { accountId, limit = 500, offset = 0 } = req.query;

  try {
    const conditions: string[] = ['t.user_id = $1', 't.deleted_at IS NULL'];
    const params: any[] = [userId];
    let pIdx = 2;

    if (accountId) {
      conditions.push(`t.account_id = $${pIdx++}`);
      params.push(accountId);
    }

    const whereClause = conditions.join(' AND ');
    const limitNum = Math.min(Number(limit) || 500, 2000);
    const offsetNum = Number(offset) || 0;

    params.push(limitNum, offsetNum);

    const rows = await db.query(
      `SELECT t.id, t.user_id, t.account_id, t.date, t.encrypted_blob, t.hash, t.created_at,
              a.name as account_name, a.currency as account_currency
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE ${whereClause}
       ORDER BY t.date DESC, t.id DESC
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      params
    );

    res.json({ records: rows, transactions: rows });
  } catch (err: any) {
    console.error('Fetch encrypted transactions error:', err);
    res.status(500).json({ error: 'Failed to retrieve encrypted transactions' });
  }
});

// 3. GET /api/transactions - Retrieve encrypted transaction records for client-side decryption
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { accountId, startDate, endDate, limit = 500, offset = 0 } = req.query;

  try {
    const conditions: string[] = ['t.user_id = $1', 't.deleted_at IS NULL'];
    const params: any[] = [userId];
    let pIdx = 2;

    if (accountId) {
      conditions.push(`t.account_id = $${pIdx++}`);
      params.push(accountId);
    }

    if (startDate) {
      conditions.push(`t.date >= $${pIdx++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`t.date <= $${pIdx++}`);
      params.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countRes = await db.queryOne<{ count: number | string }>(
      `SELECT COUNT(*) as count FROM transactions t WHERE ${whereClause}`,
      params
    );
    const total = Number(countRes?.count || 0);

    // Records
    const limitNum = Math.min(Number(limit) || 500, 2000);
    const offsetNum = Number(offset) || 0;

    params.push(limitNum);
    params.push(offsetNum);

    const rows = await db.query(
      `SELECT t.id, t.user_id, t.account_id, t.date, t.encrypted_blob, t.hash, t.created_at,
              a.name as account_name, a.currency as account_currency
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE ${whereClause}
       ORDER BY t.date DESC, t.id DESC
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      params
    );

    res.json({
      transactions: rows,
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (err: any) {
    console.error('Fetch transactions error:', err);
    res.status(500).json({ error: 'Failed to retrieve transactions' });
  }
});

// 4. PUT /api/transactions/:id - Update re-encrypted blob (e.g. recategorization)
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  const { encryptedBlob, date } = req.body;

  if (!encryptedBlob) {
    res.status(400).json({ error: 'encryptedBlob is required' });
    return;
  }

  try {
    const existing = await db.queryOne('SELECT id FROM transactions WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);
    if (!existing) {
      res.status(404).json({ error: 'Transaction not found or unauthorized' });
      return;
    }

    if (date) {
      await db.execute(
        'UPDATE transactions SET encrypted_blob = $1, date = $2 WHERE id = $3 AND user_id = $4',
        [encryptedBlob, date, id, userId]
      );
    } else {
      await db.execute(
        'UPDATE transactions SET encrypted_blob = $1 WHERE id = $2 AND user_id = $3',
        [encryptedBlob, id, userId]
      );
    }

    res.json({ success: true, message: 'Transaction updated successfully' });
  } catch (err: any) {
    console.error('Update transaction error:', err);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// 5. DELETE /api/transactions/:id - Soft-delete a transaction
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  try {
    const existing = await db.queryOne('SELECT id FROM transactions WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);
    if (!existing) {
      res.status(404).json({ error: 'Transaction not found or unauthorized' });
      return;
    }

    await db.execute(
      'UPDATE transactions SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({ success: true, message: 'Transaction removed' });
  } catch (err: any) {
    console.error('Delete transaction error:', err);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

export default router;
