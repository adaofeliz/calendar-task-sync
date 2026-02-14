import { getDb } from '@/db';
import { syncState } from '@/db/schema';
import { eq } from 'drizzle-orm';

const MUTEX_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export async function acquireSyncLock(): Promise<boolean> {
  const db = await getDb();
  
  const state = await db.query.syncState.findFirst();
  
  if (!state) {
    // Initialize sync state
    await db.insert(syncState).values({
      syncInProgress: true,
      syncStartedAt: new Date(),
      syncIntervalMinutes: 15,
    });
    return true;
  }
  
  if (state.syncInProgress) {
    // Check if mutex has timed out
    const startedAt = state.syncStartedAt?.getTime() ?? 0;
    const elapsed = Date.now() - startedAt;
    
    if (elapsed < MUTEX_TIMEOUT_MS) {
      return false; // Still locked
    }
    
    // Mutex timed out, force release and acquire
    await releaseSyncLock();
  }
  
  // Acquire lock
  await db.update(syncState)
    .set({
      syncInProgress: true,
      syncStartedAt: new Date(),
    })
    .where(eq(syncState.id, state.id));
  
  return true;
}

export async function releaseSyncLock(): Promise<void> {
  const db = await getDb();
  
  const state = await db.query.syncState.findFirst();
  if (!state) return;
  
  await db.update(syncState)
    .set({
      syncInProgress: false,
      lastSyncAt: new Date(),
    })
    .where(eq(syncState.id, state.id));
}

export async function updateSyncToken(token: string): Promise<void> {
  const db = await getDb();
  
  const state = await db.query.syncState.findFirst();
  if (!state) return;
  
  await db.update(syncState)
    .set({ googleSyncToken: token })
    .where(eq(syncState.id, state.id));
}

export async function getSyncToken(): Promise<string | null> {
  const db = await getDb();
  
  const state = await db.query.syncState.findFirst();
  return state?.googleSyncToken ?? null;
}
