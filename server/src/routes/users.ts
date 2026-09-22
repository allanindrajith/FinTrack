import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { AuthRequest, requireAuth } from './auth.js';

const router = Router();
const SERVER_KEY = process.env.SERVER_ENCRYPTION_KEY || 'fintrack_server_secret_aes_32bytes!';

// Simple server-side AES-256-GCM helper for BYO keys stored at rest
function encryptServerSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(SERVER_KEY).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decryptServerSecret(ciphertext: string): string | null {
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const key = crypto.createHash('sha256').update(SERVER_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

// 1a. GET /api/users/me — alias for /profile (used by api.getProfile())
router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  try {
    const user = await db.queryOne(
      `SELECT id, email, name, currency_preference, avatar_url, encryption_salt,
              email_verified, data_retention_days, ai_consent, ai_provider,
              (ai_byo_key_encrypted IS NOT NULL) as has_byo_key,
              created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (err) {
    console.error('Fetch me error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// 1b. GET /api/users/profile — canonical profile endpoint
router.get('/profile', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  try {
    const user = await db.queryOne(
      `SELECT id, email, name, currency_preference, avatar_url, encryption_salt,
              email_verified, data_retention_days, ai_consent, ai_provider,
              (ai_byo_key_encrypted IS NOT NULL) as has_byo_key,
              created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// 2. PUT /api/users/profile
router.put('/profile', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { name, currencyPreference, avatarUrl } = req.body;

  try {
    const updates: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (name && typeof name === 'string' && name.trim().length >= 2) {
      updates.push(`name = $${pIdx++}`);
      params.push(name.trim());
    }

    if (currencyPreference && typeof currencyPreference === 'string') {
      const cleanCurrency = currencyPreference.toUpperCase().trim().slice(0, 5);
      updates.push(`currency_preference = $${pIdx++}`);
      params.push(cleanCurrency);
    }

    if (avatarUrl !== undefined) {
      updates.push(`avatar_url = $${pIdx++}`);
      params.push(typeof avatarUrl === 'string' ? avatarUrl.trim() : null);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields provided for update' });
      return;
    }

    updates.push(`updated_at = $${pIdx++}`);
    params.push(new Date().toISOString());

    params.push(userId);
    await db.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${pIdx}`,
      params
    );

    const updated = await db.queryOne(
      'SELECT id, email, name, currency_preference, avatar_url, encryption_salt FROM users WHERE id = $1',
      [userId]
    );

    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 3. PUT /api/users/password
router.put('/password', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long' });
    return;
  }

  try {
    const user = await db.queryOne('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.password_hash) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Current password is required' });
        return;
      }
      const match = await bcrypt.compare(String(currentPassword), user.password_hash);
      if (!match) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.execute('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [
      newHash,
      new Date().toISOString(),
      userId,
    ]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// 4. PUT /api/users/settings (Retention, AI Consent & BYO Key)
router.put('/settings', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { dataRetentionDays, aiConsent, aiProvider, byoApiKey } = req.body;

  try {
    const updates: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (dataRetentionDays !== undefined) {
      const days = dataRetentionDays === null || dataRetentionDays === '' ? null : Number(dataRetentionDays);
      updates.push(`data_retention_days = $${pIdx++}`);
      params.push(days);
    }

    if (aiConsent !== undefined) {
      const consentVal = Boolean(aiConsent);
      updates.push(`ai_consent = $${pIdx++}`);
      params.push(db.isPostgres ? consentVal : (consentVal ? 1 : 0));
    }

    if (aiProvider !== undefined) {
      const valid = ['gemini', 'openai', 'anthropic'].includes(aiProvider) ? aiProvider : 'gemini';
      updates.push(`ai_provider = $${pIdx++}`);
      params.push(valid);
    }

    if (byoApiKey !== undefined) {
      let encryptedKey: string | null = null;
      if (typeof byoApiKey === 'string' && byoApiKey.trim().length > 0) {
        encryptedKey = encryptServerSecret(byoApiKey.trim());
      }
      updates.push(`ai_byo_key_encrypted = $${pIdx++}`);
      params.push(encryptedKey);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = $${pIdx++}`);
      params.push(new Date().toISOString());

      params.push(userId);
      await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = $${pIdx}`, params);
    }

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// 5. POST /api/users/delete-data (Soft-delete with 48h hard purge schedule)
router.post('/delete-data', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    const nowIso = new Date().toISOString();
    // Soft-delete transactions immediately
    const result = await db.execute(
      'UPDATE transactions SET deleted_at = $1 WHERE user_id = $2 AND deleted_at IS NULL',
      [nowIso, userId]
    );

    // Audit log (zero financial content)
    await db.execute(
      'INSERT INTO audit_deletion_logs (user_id, event_type, records_deleted) VALUES ($1, $2, $3)',
      [userId, 'manual_soft_delete', result.rowCount]
    );

    res.json({
      success: true,
      recordsSoftDeleted: result.rowCount,
      message: `${result.rowCount} transactions removed from your active view. Permanent hard deletion will complete automatically within 24–48 hours.`,
    });
  } catch (err) {
    console.error('Delete data error:', err);
    res.status(500).json({ error: 'Failed to process data deletion' });
  }
});

// 6. DELETE /api/users/me & DELETE /api/users (Cascade-delete entire account)
const handleAccountDeletion = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    // 1. Audit log before deletion
    await db.execute(
      'INSERT INTO audit_deletion_logs (user_id, event_type, records_deleted) VALUES ($1, $2, $3)',
      [userId, 'account_cascade_delete', 1]
    );

    // 2. Cascade delete will remove accounts, categories, rules, transactions, budgets, conversations
    await db.execute('DELETE FROM users WHERE id = $1', [userId]);

    res.clearCookie('fintrack_session', { path: '/' });
    res.json({ success: true, message: 'Your account and all associated data have been permanently deleted.' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

router.delete('/me', requireAuth, handleAccountDeletion);
router.delete('/', requireAuth, handleAccountDeletion);

// 7. GET /api/users/audit-logs
router.get('/audit-logs', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  try {
    const logs = await db.query(
      'SELECT id, event_type, records_deleted, created_at FROM audit_deletion_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    res.json({ logs });
  } catch (err) {
    console.error('Fetch audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
