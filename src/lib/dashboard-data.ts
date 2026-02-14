import { getDb } from '@/db';
import { syncedTasks, syncState } from '@/db/schema';
import { desc, eq, sql, and, gte, lt } from 'drizzle-orm';

export async function fetchDashboardStats() {
  const db = await getDb();
  
  const state = await db.select().from(syncState).limit(1);
  const currentSyncState = state[0] || null;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const [
    scheduledToday,
    pending,
    rescheduled,
    completed
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(syncedTasks)
      .where(
        and(
          gte(syncedTasks.scheduledStart, startOfDay),
          lt(syncedTasks.scheduledStart, endOfDay)
        )
      ),
    db.select({ count: sql<number>`count(*)` })
      .from(syncedTasks)
      .where(eq(syncedTasks.status, 'pending')),
    db.select({ count: sql<number>`count(*)` })
      .from(syncedTasks)
      .where(
        sql`${syncedTasks.rescheduleCount} > 0 OR ${syncedTasks.status} = 'rescheduled'`
      ),
    db.select({ count: sql<number>`count(*)` })
      .from(syncedTasks)
      .where(eq(syncedTasks.status, 'completed'))
  ]);

  return {
    syncState: currentSyncState,
    stats: {
      scheduledToday: scheduledToday[0]?.count || 0,
      pending: pending[0]?.count || 0,
      rescheduled: rescheduled[0]?.count || 0,
      completed: completed[0]?.count || 0
    }
  };
}

export async function fetchScheduledTasks(limit: number = 20) {
  const db = await getDb();
  const now = new Date();

  return await db.select()
    .from(syncedTasks)
    .where(
      and(
        gte(syncedTasks.scheduledStart, now),
        eq(syncedTasks.status, 'scheduled')
      )
    )
    .orderBy(syncedTasks.scheduledStart)
    .limit(limit);
}

export async function fetchRecentActivity(limit: number = 10) {
  const db = await getDb();
  
  return await db.select()
    .from(syncedTasks)
    .orderBy(desc(syncedTasks.updatedAt))
    .limit(limit);
}
