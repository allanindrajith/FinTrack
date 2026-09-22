import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { AuthRequest, requireAuth } from './auth.js';
import { Category, CategoryRule } from '../types/index.js';
import { categorizeTransaction } from '../engine/categorizer.js';

const router = Router();

// GET /api/categories - List user & default categories
router.get('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const categories = db.prepare(`
    SELECT * FROM categories 
    WHERE user_id IS NULL OR user_id = ? 
    ORDER BY is_default DESC, name ASC
  `).all(userId);

  res.json({ categories });
});

// POST /api/categories - Create custom category
router.post('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { name, color = '#64748b', icon = 'Tag' } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Category name is required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO categories (user_id, name, color, icon, is_default)
    VALUES (?, ?, ?, ?, 0)
  `).run(userId, name.trim(), color, icon);

  const newCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ category: newCategory });
});

// GET /api/categories/rules - List rules
router.get('/rules', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const rules = db.prepare(`
    SELECT r.*, c.name as category_name, c.color as category_color
    FROM category_rules r
    JOIN categories c ON r.category_id = c.id
    WHERE r.user_id = ?
    ORDER BY r.priority DESC, r.created_at DESC
  `).all(userId);

  res.json({ rules });
});

// POST /api/categories/rules - Add new categorization rule and apply to existing matching transactions
router.post('/rules', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { categoryId, pattern, matchType = 'contains', priority = 20, applyRetroactive = true } = req.body;

  if (!categoryId || !pattern) {
    res.status(400).json({ error: 'Category ID and pattern are required' });
    return;
  }

  const insert = db.prepare(`
    INSERT INTO category_rules (user_id, category_id, pattern, match_type, priority)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, categoryId, pattern.trim(), matchType, priority);

  const ruleId = Number(insert.lastInsertRowid);
  let updatedCount = 0;

  if (applyRetroactive) {
    // Apply rule to existing transactions of this user
    const transactions = db.prepare('SELECT id, description, category_id FROM transactions WHERE user_id = ?').all(userId) as any[];
    const updateTx = db.prepare('UPDATE transactions SET category_id = ? WHERE id = ?');

    for (const tx of transactions) {
      const desc = (tx.description || '').toUpperCase();
      const pat = pattern.toUpperCase();
      let matched = false;

      if (matchType === 'exact') matched = desc === pat;
      else if (matchType === 'starts_with') matched = desc.startsWith(pat);
      else if (matchType === 'regex') {
        try { matched = new RegExp(pattern, 'i').test(desc); } catch {}
      } else {
        matched = desc.includes(pat);
      }

      if (matched && tx.category_id !== categoryId) {
        updateTx.run(categoryId, tx.id);
        updatedCount++;
      }
    }
  }

  const rule = db.prepare(`
    SELECT r.*, c.name as category_name, c.color as category_color
    FROM category_rules r
    JOIN categories c ON r.category_id = c.id
    WHERE r.id = ?
  `).get(ruleId);

  res.status(201).json({ rule, updatedTransactionsCount: updatedCount });
});

// DELETE /api/categories/rules/:id
router.delete('/rules/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { id } = req.params;

  db.prepare('DELETE FROM category_rules WHERE id = ? AND user_id = ?').run(id, userId);
  res.json({ success: true, message: 'Rule deleted' });
});

export default router;
