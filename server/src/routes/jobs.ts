import { Router, Request, Response } from 'express';
import { runRetentionCleanup } from '../jobs/retentionCleaner.js';

const router = Router();
const CRON_SECRET = process.env.CRON_SECRET || 'fintrack_cron_secret_2026';

router.post('/cleanup', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  const providedSecret = authHeader?.replace('Bearer ', '') || req.query.secret || req.headers['x-cron-secret'];

  if (providedSecret !== CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET' });
    return;
  }

  try {
    const result = await runRetentionCleanup();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to run retention cleanup', details: err.message });
  }
});

export default router;
