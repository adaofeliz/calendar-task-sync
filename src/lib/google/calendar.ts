import { google, calendar_v3 } from 'googleapis';
import { getAuthenticatedClient } from './oauth';
import { TududiTask } from '@/lib/engine/types';

/**
 * Retry configuration
 */
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Retry with exponential backoff for 429 and 5xx errors
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  attempt = 0
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const statusCode = error?.response?.status || error?.code;
    const isRetryable = statusCode === 429 || (statusCode >= 500 && statusCode < 600);

    if (isRetryable && attempt < MAX_RETRIES) {
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return withRetry(fn, attempt + 1);
    }

    throw error;
  }
}

/**
 * Get authenticated Google Calendar client
 */
async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  const auth = await getAuthenticatedClient();
  
  if (!auth) {
    throw new Error('Not authenticated. Please authenticate with Google first.');
  }

  return google.calendar({ version: 'v3', auth });
}

/**
 * Get free/busy information for multiple calendars
 * Merges busy periods from all calendars
 */
export async function getFreeBusy(
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<Array<{ start: Date; end: Date }>> {
  const calendar = await getCalendarClient();

  const response = await withRetry(() =>
    calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: calendarIds.map(id => ({ id })),
      },
    })
  );

  const busyPeriods: Array<{ start: Date; end: Date }> = [];

  if (response.data.calendars) {
    for (const calendarId of calendarIds) {
      const calendarData = response.data.calendars[calendarId];
      if (calendarData?.busy) {
        for (const period of calendarData.busy) {
          if (period.start && period.end) {
            busyPeriods.push({
              start: new Date(period.start),
              end: new Date(period.end),
            });
          }
        }
      }
    }
  }

  // Sort by start time and merge overlapping periods
  busyPeriods.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: Array<{ start: Date; end: Date }> = [];
  for (const period of busyPeriods) {
    if (merged.length === 0) {
      merged.push(period);
    } else {
      const last = merged[merged.length - 1];
      if (period.start <= last.end) {
        // Overlapping - merge
        last.end = new Date(Math.max(last.end.getTime(), period.end.getTime()));
      } else {
        merged.push(period);
      }
    }
  }

  return merged;
}

/**
 * Generate deterministic event ID from task UID
 * Format: "cts" + sanitized task UID + attempt number
 * Google requires IDs: [a-v0-9]{5,1024}
 */
export function generateEventId(taskUid: string, attempt = 0): string {
  const sanitized = taskUid.toLowerCase().replace(/[^a-v0-9]/g, '');
  const id = `cts${sanitized}${attempt}`;
  
  // Ensure minimum length of 5 characters
  if (id.length < 5) {
    return id.padEnd(5, '0');
  }
  
  return id;
}

/**
 * Build task event object
 */
export function buildTaskEvent(
  task: TududiTask,
  scheduledSlot: { start: Date; end: Date },
  timezone: string,
  attempt = 0
): calendar_v3.Schema$Event {
  const tududiLink = `https://tududi.app/tasks/${task.uid}`;
  const description = task.note 
    ? `${task.note}\n\n🔗 ${tududiLink}`
    : `🔗 ${tududiLink}`;

  return {
    id: generateEventId(task.uid, attempt),
    summary: task.name,
    description,
    start: {
      dateTime: scheduledSlot.start.toISOString(),
      timeZone: timezone,
    },
    end: {
      dateTime: scheduledSlot.end.toISOString(),
      timeZone: timezone,
    },
    source: {
      title: 'Calendar-Task Sync',
      url: tududiLink,
    },
  };
}

/**
 * Build break event object
 */
export function buildBreakEvent(
  afterTask: TududiTask,
  breakDuration: number,
  taskEndTime: Date,
  timezone: string
): calendar_v3.Schema$Event {
  const breakEnd = new Date(taskEndTime.getTime() + breakDuration * 60000);
  
  return {
    summary: 'Break',
    description: `Break after: ${afterTask.name}`,
    start: {
      dateTime: taskEndTime.toISOString(),
      timeZone: timezone,
    },
    end: {
      dateTime: breakEnd.toISOString(),
      timeZone: timezone,
    },
    colorId: '11', // Gray color for breaks
    transparency: 'transparent', // Don't block time in free/busy
  };
}

/**
 * Create a new calendar event with deterministic ID
 */
export async function createEvent(
  calendarId: string,
  event: calendar_v3.Schema$Event
): Promise<calendar_v3.Schema$Event> {
  const calendar = await getCalendarClient();

  const response = await withRetry(() =>
    calendar.events.insert({
      calendarId,
      requestBody: event,
    })
  );

  return response.data;
}

/**
 * Update an existing calendar event
 */
export async function updateEvent(
  calendarId: string,
  eventId: string,
  updates: Partial<calendar_v3.Schema$Event>
): Promise<calendar_v3.Schema$Event> {
  const calendar = await getCalendarClient();

  const response = await withRetry(() =>
    calendar.events.update({
      calendarId,
      eventId,
      requestBody: updates,
    })
  );

  return response.data;
}

/**
 * Delete a calendar event
 */
export async function deleteEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  const calendar = await getCalendarClient();

  await withRetry(() =>
    calendar.events.delete({
      calendarId,
      eventId,
    })
  );
}

/**
 * Get a single calendar event
 */
export async function getEvent(
  calendarId: string,
  eventId: string
): Promise<calendar_v3.Schema$Event | null> {
  const calendar = await getCalendarClient();

  try {
    const response = await withRetry(() =>
      calendar.events.get({
        calendarId,
        eventId,
      })
    );

    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * List events from a calendar
 * Supports incremental sync with syncToken
 */
export async function listEvents(
  calendarId: string,
  options?: {
    syncToken?: string;
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
  }
): Promise<{
  events: calendar_v3.Schema$Event[];
  nextSyncToken?: string;
  nextPageToken?: string;
}> {
  const calendar = await getCalendarClient();

  const requestParams: calendar_v3.Params$Resource$Events$List = {
    calendarId,
    maxResults: options?.maxResults || 250,
  };

  if (options?.syncToken) {
    requestParams.syncToken = options.syncToken;
  } else {
    if (options?.timeMin) {
      requestParams.timeMin = options.timeMin.toISOString();
    }
    if (options?.timeMax) {
      requestParams.timeMax = options.timeMax.toISOString();
    }
  }

  const response = await withRetry(() =>
    calendar.events.list(requestParams)
  );

  return {
    events: response.data.items || [],
    nextSyncToken: response.data.nextSyncToken ?? undefined,
    nextPageToken: response.data.nextPageToken ?? undefined,
  };
}
