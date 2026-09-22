import { db } from '../db/database.js';

export interface CleanupResult {
  retentionPurgedTotal: number;
  hardDeletedTotal: number;
  usersProcessed: number;
  timestamp: string;
}

export async function runRetentionCleanup(): Promise<CleanupResult> {
  console.log('🧹 Starting automated data retention & hard-delete cleaner...');
  let retentionPurgedTotal = 0;
  let hardDeletedTotal = 0;

  try {
    // 1. Purge data past user-configured retention policy
    const usersWithRetention = await db.query<{ id: number; data_retention_days: number }>(
      'SELECT id, data_retention_days FROM users WHERE data_retention_days IS NOT NULL AND data_retention_days > 0'
    );

    for (const u of usersWithRetention) {
      const days = u.data_retention_days;
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const cutoffStr = cutoffDate.toISOString().slice(0, 10); // YYYY-MM-DD

      // Delete transactions older than cutoff date
      const res = await db.execute(
        'DELETE FROM transactions WHERE user_id = $1 AND date < $2',
        [u.id, cutoffStr]
      );

      if (res.rowCount > 0) {
        retentionPurgedTotal += res.rowCount;
        await db.execute(
          'INSERT INTO audit_deletion_logs (user_id, event_type, records_deleted) VALUES ($1, $2, $3)',
          [u.id, 'data_retention_purge', res.rowCount]
        );
        console.log(`🗑️ User ${u.id}: Purged ${res.rowCount} transactions older than ${days} days (${cutoffStr})`);
      }
    }

    // 2. Permanently hard-delete soft-deleted records older than 48 hours
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const hardDeleteRes = await db.execute(
      'DELETE FROM transactions WHERE deleted_at IS NOT NULL AND deleted_at < $1',
      [fortyEightHoursAgo]
    );

    hardDeletedTotal = hardDeleteRes.rowCount;
    if (hardDeletedTotal > 0) {
      console.log(`🔥 Permanently hard-deleted ${hardDeletedTotal} soft-deleted transactions past 48h`);
    }

    console.log(`✅ Retention cleanup completed: ${retentionPurgedTotal} retention-purged, ${hardDeletedTotal} hard-deleted.`);

    return {
      retentionPurgedTotal,
      hardDeletedTotal,
      usersProcessed: usersWithRetention.length,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Retention cleanup error:', err);
    throw err;
  }
}

// Background scheduler timer: runs every 12 hours
let intervalHandle: NodeJS.Timeout | null = null;

export function startRetentionCron(intervalHours = 12): void {
  const ms = intervalHours * 60 * 60 * 1000;
  // Run once after 1 minute startup delay, then periodically
  setTimeout(() => {
    runRetentionCleanup().catch((err) => console.error('Initial cleanup failed:', err));
  }, 60 * 1000);

  intervalHandle = setInterval(() => {
    runRetentionCleanup().catch((err) => console.error('Periodic cleanup failed:', err));
  }, ms);
}

export function stopRetentionCron(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
