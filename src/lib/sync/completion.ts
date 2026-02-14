import { getDb } from '@/db';
import { syncedTasks } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getActiveSyncedTasks() {
  const db = await getDb();
  return db.query.syncedTasks.findMany({
    where: eq(syncedTasks.status, 'scheduled'),
  });
}

export async function updateTaskStatus(taskUid: string, status: 'pending' | 'scheduled' | 'completed' | 'rescheduled' | 'failed' | 'cancelled') {
  const db = await getDb();
  await db.update(syncedTasks)
    .set({ status, updatedAt: new Date() })
    .where(eq(syncedTasks.taskUid, taskUid));
}
