import { TududiClient } from '@/lib/tududi/client';
import { getAuthenticatedClient, getCalendarList } from '@/lib/google/oauth';
import { getFreeBusy, createEvent, deleteEvent, listEvents } from '@/lib/google/calendar';
import { rankTasks, findFreeSlots, scheduleTasks, stripEmoji, applyEmoji } from '@/lib/engine';
import { getConfig, getAllConfig } from '@/lib/config';
import { getSchedulableTasks, extractTaskType } from '@/lib/tududi/filters';
import { acquireSyncLock, releaseSyncLock, updateSyncToken, getSyncToken } from './mutex';
import {
  getActiveSyncedTasks,
  getOverdueTasks,
  recordTaskScheduled,
  markTaskCompleted,
  markTaskRescheduled,
  clearTaskEvents,
  getCalendarMappings,
  getDefaultCalendarId,
  getBusyCalendarIds,
} from './db-operations';
import type { TududiApiTask } from '@/lib/tududi/types';
import type { RankedTask, DayWindow } from '@/lib/engine/types';

export interface SyncResult {
  success: boolean;
  tasksScheduled: number;
  tasksRescheduled: number;
  tasksCompleted: number;
  errors: string[];
}

export async function runSyncCycle(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    tasksScheduled: 0,
    tasksRescheduled: 0,
    tasksCompleted: 0,
    errors: [],
  };

  // Acquire mutex
  const locked = await acquireSyncLock();
  if (!locked) {
    result.errors.push('Sync already in progress');
    return result;
  }

  try {
    // Load config
    const config = await getAllConfig();
    const tududiUrl = process.env.TUDUDI_API_URL ?? '';
    const tududiKey = process.env.TUDUDI_API_KEY ?? '';
    
    if (!tududiUrl || !tududiKey) {
      throw new Error('Tududi API credentials not configured');
    }

    // Initialize clients
    const tududi = new TududiClient(tududiUrl, tududiKey);
    const googleAuth = await getAuthenticatedClient();
    
    if (!googleAuth) {
      throw new Error('Google Calendar not authenticated');
    }

    // Fetch data
    const [tududiTasks, calendarMappings, busyCalendarIds, defaultCalendarId] = await Promise.all([
      tududi.getTasks(),
      getCalendarMappings(),
      getBusyCalendarIds(),
      getDefaultCalendarId(),
    ]);

    // Filter schedulable tasks
    const schedulableTasks = getSchedulableTasks(tududiTasks);
    
    // Check for completed tasks
    const activeSyncedTasks = await getActiveSyncedTasks();
    for (const syncedTask of activeSyncedTasks) {
      const tududiTask = tududiTasks.find(t => t.uid === syncedTask.taskUid);
      if (tududiTask && ['done', 'archived', 'cancelled'].includes(tududiTask.status)) {
        // Task completed - clean up
        if (syncedTask.calendarEventId && syncedTask.calendarId) {
          await deleteEvent(syncedTask.calendarId, syncedTask.calendarEventId);
        }
        if (syncedTask.breakEventId && syncedTask.calendarId) {
          await deleteEvent(syncedTask.calendarId, syncedTask.breakEventId);
        }
        
        // Strip emoji from Tududi
        if (syncedTask.cleanName) {
          await tududi.updateTask(syncedTask.taskUid, { name: syncedTask.cleanName });
        }
        
        await markTaskCompleted(syncedTask.taskUid);
        result.tasksCompleted++;
      }
    }

    // Check for overdue tasks to reschedule
    const rescheduleTimeout = (config.reschedule_timeout_hours as number) ?? 12;
    const overdueTasks = await getOverdueTasks(rescheduleTimeout);
    
    for (const overdue of overdueTasks) {
      const tududiTask = tududiTasks.find(t => t.uid === overdue.taskUid);
      if (tududiTask && !['done', 'archived', 'cancelled'].includes(tududiTask.status)) {
        // Delete old events
        if (overdue.calendarEventId && overdue.calendarId) {
          await deleteEvent(overdue.calendarId, overdue.calendarEventId);
        }
        if (overdue.breakEventId && overdue.calendarId) {
          await deleteEvent(overdue.calendarId, overdue.breakEventId);
        }
        
        await markTaskRescheduled(overdue.taskUid, overdue.rescheduleCount + 1);
        result.tasksRescheduled++;
      }
    }

    // Get already scheduled task UIDs
    const scheduledUids = new Set(activeSyncedTasks.map(t => t.taskUid));
    
    // Filter to unscheduled tasks only
    const unscheduledTasks = schedulableTasks.filter(t => !scheduledUids.has(t.uid));
    
    if (unscheduledTasks.length === 0) {
      result.success = true;
      return result;
    }

    // Get reschedule counts for ranking
    const rescheduleCounts: Record<string, number> = {};
    for (const synced of activeSyncedTasks) {
      if (synced.status === 'rescheduled') {
        rescheduleCounts[synced.taskUid] = synced.rescheduleCount;
      }
    }

    // Rank tasks
    const weights = config.weights as { priority: number; type: number; project: number; urgency: number; energy: number };
    const rankedTasks = rankTasks(unscheduledTasks, weights, rescheduleCounts);

    // Add estimated durations
    const durationMatrix = config.duration_matrix as { focus: Record<string, number>; noise: Record<string, number> };
    for (const rt of rankedTasks) {
      const taskType = extractTaskType(rt.task.tags);
      const typeKey = taskType === 'unknown' ? 'focus' : taskType;
      rt.estimatedDuration = durationMatrix[typeKey]?.[rt.task.priority] ?? 60;
    }

    // Fetch busy periods
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week ahead
    
    const busyPeriods = await getFreeBusy(
      busyCalendarIds.length > 0 ? busyCalendarIds : ['primary'],
      now,
      endDate
    );

    // Find free slots
    const schedulingWindows = config.scheduling_windows as { monday: DayWindow; tuesday: DayWindow; wednesday: DayWindow; thursday: DayWindow; friday: DayWindow; saturday: DayWindow; sunday: DayWindow };
    const minDuration = 30;
    const freeSlots = findFreeSlots(now, endDate, busyPeriods, schedulingWindows, minDuration);

    // Schedule tasks
    const breakRules = config.break_rules as { shortDuration: number; longDuration: number; thresholdMinutes: number };
    const peakHours = config.peak_hours as { start: number; end: number };
    
    const placements = scheduleTasks(
      rankedTasks,
      freeSlots,
      calendarMappings,
      defaultCalendarId ?? 'primary',
      breakRules,
      peakHours
    );

    // Create calendar events and update Tududi
    for (const placement of placements) {
      try {
        // Create task event
        const taskEvent = await createEvent(placement.calendarId, {
          summary: applyEmoji(placement.task.name, '📅'),
          description: placement.task.note || '',
          start: { dateTime: placement.eventStart.toISOString() },
          end: { dateTime: placement.eventEnd.toISOString() },
        });

        // Create break event
        const breakEvent = await createEvent(placement.calendarId, {
          summary: 'Break',
          start: { dateTime: placement.breakStart.toISOString() },
          end: { dateTime: placement.breakEnd.toISOString() },
          colorId: '8', // Gray color
          transparency: 'transparent',
        });

        // Record in database
        await recordTaskScheduled(
          placement.task,
          taskEvent.id!,
          breakEvent.id!,
          placement.calendarId,
          placement.eventStart,
          placement.eventEnd,
          stripEmoji(placement.task.name)
        );

        // Update Tududi with emoji
        await tududi.updateTask(placement.task.uid, {
          name: applyEmoji(placement.task.name, '📅'),
        });

        result.tasksScheduled++;
      } catch (error) {
        result.errors.push(`Failed to schedule task ${placement.task.uid}: ${error}`);
      }
    }

    result.success = true;
    return result;
  } catch (error) {
    result.errors.push(`Sync cycle failed: ${error}`);
    return result;
  } finally {
    await releaseSyncLock();
  }
}
