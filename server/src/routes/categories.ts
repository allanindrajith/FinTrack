import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { AuthRequest, requireAuth } from './auth.js';

const router = Router();

// GET /api/categories - List user & default categories
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  try {
    const categories = await db.query(
      `SELECT * FROM categories 
       WHERE user_id IS NULL OR user_id = $1 
       ORDER BY is_default DESC, name ASC`,
      [userId]
    );

    res.json({ categories });
  } catch (err) {
    console.error('Fetch categories error:', err);
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
});

// POST /api/categories - Create custom category
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { name, color = '#64748b', icon = 'Tag' } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Category name is required' });
    return;
  }

  try {
    const result = await db.execute(
      `INSERT INTO categories (user_id, name, color, icon, is_default)
       VALUES ($1, $2, $3, $4, 0)`,
      [userId, name.trim(), color, icon]
    );

    const newCategory = await db.queryOne('SELECT * FROM categories WHERE id = $1', [result.lastInsertId]);
    res.status(201).json({ category: newCategory });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// GET /api/categories/rules - List rules
router.get('/rules', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  try {
    const rules = await db.query(
      `SELECT r.*, c.name as category_name, c.color as category_color
       FROM category_rules r
       JOIN categories c ON r.category_id = c.id
       WHERE r.user_id = $1
       ORDER BY r.priority DESC, r.created_at DESC`,
      [userId]
    );

    res.json({ rules });
  } catch (err) {
    console.error('Fetch rules error:', err);
    res.status(500).json({ error: 'Failed to retrieve category rules' });
  }
});

// POST /api/categories/rules - Add new categorization rule
router.post('/rules', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { categoryId, pattern, matchType = 'contains', priority = 20 } = req.body;

  if (!categoryId || !pattern) {
    res.status(400).json({ error: 'Category ID and pattern are required' });
    return;
  }

  try {
    // IDOR Check: Ensure category exists and belongs to user or is default
    const validCat = await db.queryOne(
      'SELECT id FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
      [categoryId, userId]
    );
    if (!validCat) {
      res.status(400).json({ error: 'Invalid or inaccessible category ID' });
      return;
    }

    const validTypes = ['contains', 'exact', 'starts_with', 'regex'];
    if (!validTypes.includes(matchType)) {
      res.status(400).json({ error: 'Invalid matchType. Must be one of: contains, exact, starts_with, regex' });
      return;
    }

    // ReDoS Prevention: restrict pattern length and reject dangerous nested quantifiers
    const cleanPattern = String(pattern).trim();
    if (matchType === 'regex') {
      if (cleanPattern.length > 100) {
        res.status(400).json({ error: 'Regular expression cannot exceed 100 characters' });
        return;
      }
      if (/(\+|\*|\{[\d,]+\})\s*\)(\+|\*|\{[\d,]+\})/.test(cleanPattern)) {
        res.status(400).json({ error: 'Potentially vulnerable regular expression pattern (nested quantifiers disallowed)' });
        return;
      }
      try {
        new RegExp(cleanPattern, 'i');
      } catch {
        res.status(400).json({ error: 'Invalid regular expression syntax' });
        return;
      }
    }

    const insert = await db.execute(
      `INSERT INTO category_rules (user_id, category_id, pattern, match_type, priority)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, categoryId, cleanPattern, matchType, priority]
    );

    const rule = await db.queryOne(
      `SELECT r.*, c.name as category_name, c.color as category_color
       FROM category_rules r
       JOIN categories c ON r.category_id = c.id
       WHERE r.id = $1`,
      [insert.lastInsertId]
    );

    res.status(201).json({ rule, updatedTransactionsCount: 0 });
  } catch (err) {
    console.error('Create rule error:', err);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// DELETE /api/categories/rules/:id
router.delete('/rules/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    await db.execute('DELETE FROM category_rules WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ success: true, message: 'Rule deleted' });
  } catch (err) {
    console.error('Delete rule error:', err);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

export default router;
