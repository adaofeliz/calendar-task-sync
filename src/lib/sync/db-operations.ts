import { getDb } from '@/db';
import { syncedTasks, calendarMappings, busyCalendars } from '@/db/schema';
import { eq, and, inArray, lt } from 'drizzle-orm';
import type { TududiApiTask } from '@/lib/tududi/types';

export interface SyncedTaskRecord {
  id: number;
  taskUid: string;
  cleanName: string;
  currentEmoji: string | null;
  calendarEventId: string | null;
  breakEventId: string | null;
  calendarId: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  status: 'pending' | 'scheduled' | 'completed' | 'rescheduled' | 'failed' | 'cancelled';
  rescheduleCount: number;
  tududiStatus: string | null;
  lastCheckedAt: Date | null;
}

export async function getSyncedTask(taskUid: string): Promise<SyncedTaskRecord | null> {
  const db = await getDb();
  const record = await db.query.syncedTasks.findFirst({
    where: eq(syncedTasks.taskUid, taskUid),
  });
  return record ?? null;
}

export async function recordTaskScheduled(
  task: { uid: string; name: string; status: string; priority: string; due_date?: string; note?: string; tags: Array<{ name: string }>; project?: { uid: string; name: string } },
  calendarEventId: string,
  breakEventId: string,
  calendarId: string,
  eventStart: Date,
  eventEnd: Date,
  cleanName: string
): Promise<void> {
  const db = await getDb();
  const existing = await getSyncedTask(task.uid);
  
  if (existing) {
    await db.update(syncedTasks)
      .set({
        calendarEventId,
        breakEventId,
        calendarId,
        scheduledStart: eventStart,
        scheduledEnd: eventEnd,
        status: 'scheduled',
        cleanName,
        currentEmoji: '📅',
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(syncedTasks.id, existing.id));
  } else {
    await db.insert(syncedTasks).values({
      taskUid: task.uid,
      cleanName,
      currentEmoji: '📅',
      calendarEventId,
      breakEventId,
      calendarId,
      scheduledStart: eventStart,
      scheduledEnd: eventEnd,
      status: 'scheduled',
      tududiStatus: task.status,
      lastCheckedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function markTaskCompleted(taskUid: string): Promise<void> {
  const db = await getDb();
  
  await db.update(syncedTasks)
    .set({
      status: 'completed',
      currentEmoji: null,
      lastCheckedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(syncedTasks.taskUid, taskUid));
}

export async function markTaskRescheduled(
  taskUid: string,
  newRescheduleCount: number
): Promise<void> {
  const db = await getDb();
  
  await db.update(syncedTasks)
    .set({
      status: 'rescheduled',
      rescheduleCount: newRescheduleCount,
      currentEmoji: '⚠️',
      calendarEventId: null,
      breakEventId: null,
      lastCheckedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(syncedTasks.taskUid, taskUid));
}

export async function getActiveSyncedTasks(): Promise<SyncedTaskRecord[]> {
  const db = await getDb();
  
  return db.query.syncedTasks.findMany({
    where: inArray(syncedTasks.status, ['scheduled', 'rescheduled']),
  });
}

export async function getOverdueTasks(timeoutHours: number): Promise<SyncedTaskRecord[]> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - timeoutHours * 60 * 60 * 1000);
  
  return db.query.syncedTasks.findMany({
    where: and(
      eq(syncedTasks.status, 'scheduled'),
      lt(syncedTasks.scheduledEnd, cutoff)
    ),
  });
}

export async function clearTaskEvents(taskUid: string): Promise<void> {
  const db = await getDb();
  
  await db.update(syncedTasks)
    .set({
      calendarEventId: null,
      breakEventId: null,
      updatedAt: new Date(),
    })
    .where(eq(syncedTasks.taskUid, taskUid));
}

export async function getCalendarMappings(): Promise<Array<{ projectUid: string; calendarId: string }>> {
  const db = await getDb();
  
  const mappings = await db.query.calendarMappings.findMany();
  return mappings.map(m => ({
    projectUid: m.projectUid,
    calendarId: m.calendarId,
  }));
}

export async function getDefaultCalendarId(): Promise<string | null> {
  const db = await getDb();
  
  const mapping = await db.query.calendarMappings.findFirst({
    where: eq(calendarMappings.isDefault, true),
  });
  
  return mapping?.calendarId ?? null;
}

export async function getBusyCalendarIds(): Promise<string[]> {
  const db = await getDb();
  
  const calendars = await db.query.busyCalendars.findMany({
    where: eq(busyCalendars.enabled, true),
  });
  
  return calendars.map(c => c.calendarId);
}
