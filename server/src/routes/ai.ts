import { Router, Response } from 'express';
import { AuthRequest, requireAuth } from './auth.js';
import { aiService } from '../services/aiService.js';
import { db } from '../db/database.js';

const router = Router();

// 1. GET /api/ai/status - Check quota, consent status, and active provider
router.get('/status', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    const quota = await aiService.checkQuota(userId).catch((err) => ({
      allowed: false,
      isByoKey: false,
      provider: 'gemini',
      apiKey: '',
      remainingQueries: 0,
      errorMessage: err.message,
    }));

    res.json({
      active: quota.allowed,
      provider: quota.provider,
      isByoKey: quota.isByoKey,
      remainingQueries: quota.remainingQueries,
      errorMessage: (quota as any).errorMessage,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve AI status' });
  }
});

// 2. POST /api/ai/chat - Ask natural-language spending questions or request insights
router.post('/chat', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { prompt, contextSummary } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  try {
    const response = await aiService.generateResponse({
      userId,
      prompt: prompt.trim(),
      contextSummary: typeof contextSummary === 'string' ? contextSummary : undefined,
    });

    res.json(response);
  } catch (err: any) {
    console.error('AI chat error:', err);
    res.status(400).json({ error: err.message || 'Failed to process AI query' });
  }
});

// 2b. POST /api/ai/categorize - Auto-categorize uncategorized transactions with AI
router.post('/categorize', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { descriptions, categories } = req.body;

  if (!Array.isArray(descriptions) || descriptions.length === 0) {
    res.status(400).json({ error: 'Descriptions array is required' });
    return;
  }
  if (!Array.isArray(categories) || categories.length === 0) {
    res.status(400).json({ error: 'Categories array is required' });
    return;
  }

  try {
    const categorizations = await aiService.categorizeTransactions(
      userId,
      descriptions.slice(0, 50),
      categories
    );
    res.json({ categorizations });
  } catch (err: any) {
    console.error('AI categorization error:', err);
    res.status(400).json({ error: err.message || 'Failed to auto-categorize transactions' });
  }
});

// 3. GET /api/ai/conversations - Get user conversation history
router.get('/conversations', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  try {
    const rows = await db.query(
      'SELECT id, role, content, created_at FROM ai_conversations WHERE user_id = $1 ORDER BY created_at ASC LIMIT 50',
      [userId]
    );
    res.json({ conversations: rows });
  } catch (err) {
    console.error('Fetch AI conversations error:', err);
    res.status(500).json({ error: 'Failed to retrieve AI history' });
  }
});

// 4. GET /api/ai/history — alias for /conversations (used by api.getAiHistory())
router.get('/history', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  try {
    const rows = await db.query(
      'SELECT id, role, content, created_at FROM ai_conversations WHERE user_id = $1 ORDER BY created_at ASC LIMIT 50',
      [userId]
    );
    res.json({ conversations: rows, history: rows });
  } catch (err) {
    console.error('Fetch AI history error:', err);
    res.status(500).json({ error: 'Failed to retrieve AI history' });
  }
});

export default router;
