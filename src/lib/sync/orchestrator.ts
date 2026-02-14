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
  console.log('[Sync] Starting sync cycle');
  
  const result: SyncResult = {
    success: false,
    tasksScheduled: 0,
    tasksRescheduled: 0,
    tasksCompleted: 0,
    errors: [],
  };

  console.log('[Sync] Acquiring sync lock');
  const locked = await acquireSyncLock();
  if (!locked) {
    console.log('[Sync] Sync already in progress, exiting');
    result.errors.push('Sync already in progress');
    return result;
  }

  try {
    console.log('[Sync] Loading configuration');
    const config = await getAllConfig();
    const tududiUrl = process.env.TUDUDI_API_URL ?? '';
    const tududiKey = process.env.TUDUDI_API_KEY ?? '';
    
    console.log('[Sync] Tududi URL:', tududiUrl);
    
    if (!tududiUrl || !tududiKey) {
      throw new Error('Tududi API credentials not configured');
    }

    console.log('[Sync] Initializing clients');
    const tududi = new TududiClient(tududiUrl, tududiKey);
    const googleAuth = await getAuthenticatedClient();
    
    if (!googleAuth) {
      throw new Error('Google Calendar not authenticated');
    }

    console.log('[Sync] Fetching data from Tududi and Google Calendar');
    const [tududiTasks, calendarMappings, busyCalendarIds, defaultCalendarId] = await Promise.all([
      tududi.getTasks(),
      getCalendarMappings(),
      getBusyCalendarIds(),
      getDefaultCalendarId(),
    ]);
    
    console.log('[Sync] Fetched tasks:', tududiTasks.length, 'calendar mappings:', calendarMappings.length, 'busy calendars:', busyCalendarIds.length);

    console.log('[Sync] Filtering schedulable tasks');
    const schedulableTasks = getSchedulableTasks(tududiTasks);
    console.log('[Sync] Schedulable tasks:', schedulableTasks.length);
    
    console.log('[Sync] Checking for completed tasks');
    const activeSyncedTasks = await getActiveSyncedTasks();
    console.log('[Sync] Active synced tasks:', activeSyncedTasks.length);
    for (const syncedTask of activeSyncedTasks) {
      const tududiTask = tududiTasks.find(t => t.uid === syncedTask.taskUid);
      if (tududiTask && ['done', 'archived', 'cancelled'].includes(tududiTask.status)) {
        console.log('[Sync] Task completed, cleaning up:', syncedTask.taskUid);
        
        if (syncedTask.calendarEventId && syncedTask.calendarId) {
          await deleteEvent(syncedTask.calendarId, syncedTask.calendarEventId);
        }
        if (syncedTask.breakEventId && syncedTask.calendarId) {
          await deleteEvent(syncedTask.calendarId, syncedTask.breakEventId);
        }
        
        if (syncedTask.cleanName) {
          await tududi.updateTask(syncedTask.taskUid, { name: syncedTask.cleanName });
        }
        
        await markTaskCompleted(syncedTask.taskUid);
        result.tasksCompleted++;
      }
    }

    console.log('[Sync] Checking for overdue tasks to reschedule');
    const rescheduleTimeout = (config.reschedule_timeout_hours as number) ?? 12;
    const overdueTasks = await getOverdueTasks(rescheduleTimeout);
    console.log('[Sync] Overdue tasks:', overdueTasks.length);
    
    for (const overdue of overdueTasks) {
      const tududiTask = tududiTasks.find(t => t.uid === overdue.taskUid);
      if (tududiTask && !['done', 'archived', 'cancelled'].includes(tududiTask.status)) {
        console.log('[Sync] Rescheduling overdue task:', overdue.taskUid);
        
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

    console.log('[Sync] Filtering out already scheduled tasks');
    const scheduledUids = new Set(activeSyncedTasks.map(t => t.taskUid));
    const unscheduledTasks = schedulableTasks.filter(t => !scheduledUids.has(t.uid));
    console.log('[Sync] Unscheduled tasks:', unscheduledTasks.length);
    
    if (unscheduledTasks.length === 0) {
      console.log('[Sync] No unscheduled tasks, exiting');
      result.success = true;
      return result;
    }

    console.log('[Sync] Getting reschedule counts for ranking');
    const rescheduleCounts: Record<string, number> = {};
    for (const synced of activeSyncedTasks) {
      if (synced.status === 'rescheduled') {
        rescheduleCounts[synced.taskUid] = synced.rescheduleCount;
      }
    }

    console.log('[Sync] Ranking tasks');
    const weights = config.weights as { priority: number; type: number; project: number; urgency: number; energy: number };
    const rankedTasks = rankTasks(unscheduledTasks, weights, rescheduleCounts);
    console.log('[Sync] Ranked tasks:', rankedTasks.length);

    console.log('[Sync] Adding estimated durations');
    const durationMatrix = config.duration_matrix as { focus: Record<string, number>; noise: Record<string, number> };
    for (const rt of rankedTasks) {
      const taskType = extractTaskType(rt.task.tags);
      const typeKey = taskType === 'unknown' ? 'focus' : taskType;
      rt.estimatedDuration = durationMatrix[typeKey]?.[rt.task.priority] ?? 60;
    }

    console.log('[Sync] Fetching busy periods');
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const busyPeriods = await getFreeBusy(
      busyCalendarIds.length > 0 ? busyCalendarIds : ['primary'],
      now,
      endDate
    );
    console.log('[Sync] Busy periods:', busyPeriods.length);

    console.log('[Sync] Finding free slots');
    const schedulingWindows = config.scheduling_windows as { monday: DayWindow; tuesday: DayWindow; wednesday: DayWindow; thursday: DayWindow; friday: DayWindow; saturday: DayWindow; sunday: DayWindow };
    const minDuration = 30;
    const freeSlots = findFreeSlots(now, endDate, busyPeriods, schedulingWindows, minDuration);
    console.log('[Sync] Free slots:', freeSlots.length);

    console.log('[Sync] Mapping break_rules config from DB snake_case to camelCase');
    const breakConfig = config.break_rules as Record<string, unknown>;
    const breakRules = {
      shortDuration: (breakConfig?.short_duration ?? breakConfig?.shortDuration ?? 15) as number,
      longDuration: (breakConfig?.long_duration ?? breakConfig?.longDuration ?? 30) as number,
      thresholdMinutes: (breakConfig?.threshold_minutes ?? breakConfig?.thresholdMinutes ?? 60) as number,
    };
    console.log('[Sync] Break rules:', breakRules);
    
    const peakHours = config.peak_hours as { start: number; end: number };
    console.log('[Sync] Peak hours:', peakHours);
    
    console.log('[Sync] Scheduling tasks into free slots');
    const placements = scheduleTasks(
      rankedTasks,
      freeSlots,
      calendarMappings,
      defaultCalendarId ?? 'primary',
      breakRules,
      peakHours
    );
    console.log('[Sync] Task placements:', placements.length);

    console.log('[Sync] Creating calendar events and updating Tududi');
    const timezone = String(config.timezone ?? 'Europe/Lisbon').replace(/^"/,'').replace(/"$/,'');
    for (const placement of placements) {
      try {
        console.log('[Sync] Creating event for task:', placement.task.uid);
        
        const taskEvent = await createEvent(placement.calendarId, {
          summary: applyEmoji(placement.task.name, '📅'),
          description: placement.task.note || '',
          start: { dateTime: placement.eventStart.toISOString(), timeZone: timezone },
          end: { dateTime: placement.eventEnd.toISOString(), timeZone: timezone },
        });

        const breakEvent = await createEvent(placement.calendarId, {
          summary: 'Break',
          start: { dateTime: placement.breakStart.toISOString(), timeZone: timezone },
          end: { dateTime: placement.breakEnd.toISOString(), timeZone: timezone },
          colorId: '8',
          transparency: 'transparent',
        });

        await recordTaskScheduled(
          placement.task,
          taskEvent.id!,
          breakEvent.id!,
          placement.calendarId,
          placement.eventStart,
          placement.eventEnd,
          stripEmoji(placement.task.name)
        );

        await tududi.updateTask(placement.task.uid, {
          name: applyEmoji(placement.task.name, '📅'),
        });

        result.tasksScheduled++;
        console.log('[Sync] Successfully scheduled task:', placement.task.uid);
      } catch (error) {
        console.error('[Sync] Failed to schedule task:', placement.task.uid, error);
        result.errors.push(`Failed to schedule task ${placement.task.uid}: ${error}`);
      }
    }

    console.log('[Sync] Sync cycle complete', result);
    result.success = true;
    return result;
  } catch (error) {
    console.error('[Sync] Sync cycle failed:', error);
    result.errors.push(`Sync cycle failed: ${error}`);
    return result;
  } finally {
    console.log('[Sync] Releasing sync lock');
    await releaseSyncLock();
  }
}
