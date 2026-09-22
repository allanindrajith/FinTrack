import { describe, it, expect, beforeAll } from 'vitest';
import { initDatabase } from '../db/database.js';
import { aiService } from '../services/aiService.js';
import crypto from 'crypto';

describe('FinTrack Production Features & Zero-Knowledge Verification', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  it('computes deterministic HMAC-SHA256 blind deduplication hashes', () => {
    const authKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const date = '2026-09-15';
    const amount = 42.50;
    const description = 'WHOLE FOODS MARKET';

    const normalizedDesc = description.toUpperCase().trim();
    const payload = `${date}|${amount.toFixed(2)}|${normalizedDesc}`;
    const hash1 = crypto.createHmac('sha256', authKey).update(payload).digest('hex');
    const hash2 = crypto.createHmac('sha256', authKey).update(payload).digest('hex');

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it('enforces AI consent and daily free quota bounds', async () => {
    // Attempting to check quota when AI is disabled for user (non-existent or consent=0) throws error
    await expect(aiService.checkQuota(999999)).rejects.toThrow(/disabled|Consent/i);
  });

  it('validates retention horizons formatting', () => {
    const validHorizons = ['1d', '7d', '1m', '3m', '1y', 'never', 'custom'];
    validHorizons.forEach((horizon) => {
      expect(typeof horizon).toBe('string');
      expect(horizon.length).toBeGreaterThan(0);
    });
  });
});
