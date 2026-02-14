import { describe, it, expect, vi, beforeEach } from 'vitest';
import { google } from 'googleapis';
import type { TududiTask } from '@/lib/engine/types';

vi.mock('googleapis');
vi.mock('@/lib/google/oauth', () => ({
  getAuthenticatedClient: vi.fn(),
}));

const mockGetAuthenticatedClient = vi.mocked(
  (await import('@/lib/google/oauth')).getAuthenticatedClient
);

describe('Google Calendar Client', () => {
  const mockAuth = { credentials: { access_token: 'mock-token' } };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedClient.mockResolvedValue(mockAuth as any);
  });

  describe('getFreeBusy', () => {
    it('should fetch and merge busy periods from multiple calendars', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        data: {
          calendars: {
            'cal-1': {
              busy: [
                { start: '2026-02-14T09:00:00Z', end: '2026-02-14T10:00:00Z' },
                { start: '2026-02-14T11:00:00Z', end: '2026-02-14T12:00:00Z' },
              ],
            },
            'cal-2': {
              busy: [
                { start: '2026-02-14T09:30:00Z', end: '2026-02-14T10:30:00Z' },
              ],
            },
          },
        },
      });

      vi.mocked(google.calendar).mockReturnValue({
        freebusy: { query: mockQuery },
      } as any);

      const { getFreeBusy } = await import('@/lib/google/calendar');
      
      const timeMin = new Date('2026-02-14T08:00:00Z');
      const timeMax = new Date('2026-02-14T18:00:00Z');
      const busyPeriods = await getFreeBusy(['cal-1', 'cal-2'], timeMin, timeMax);

      expect(mockQuery).toHaveBeenCalledWith({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: 'cal-1' }, { id: 'cal-2' }],
        },
      });

      expect(busyPeriods).toHaveLength(2);
      expect(busyPeriods[0]).toEqual({
        start: new Date('2026-02-14T09:00:00Z'),
        end: new Date('2026-02-14T10:30:00Z'),
      });
      expect(busyPeriods[1]).toEqual({
        start: new Date('2026-02-14T11:00:00Z'),
        end: new Date('2026-02-14T12:00:00Z'),
      });
    });

    it('should handle empty calendars', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        data: {
          calendars: {
            'cal-1': { busy: [] },
          },
        },
      });

      vi.mocked(google.calendar).mockReturnValue({
        freebusy: { query: mockQuery },
      } as any);

      const { getFreeBusy } = await import('@/lib/google/calendar');
      
      const busyPeriods = await getFreeBusy(
        ['cal-1'],
        new Date('2026-02-14T08:00:00Z'),
        new Date('2026-02-14T18:00:00Z')
      );

      expect(busyPeriods).toHaveLength(0);
    });

    it('should retry on 429 error with exponential backoff', async () => {
      const mockQuery = vi
        .fn()
        .mockRejectedValueOnce({ response: { status: 429 } })
        .mockResolvedValueOnce({
          data: {
            calendars: {
              'cal-1': {
                busy: [{ start: '2026-02-14T09:00:00Z', end: '2026-02-14T10:00:00Z' }],
              },
            },
          },
        });

      vi.mocked(google.calendar).mockReturnValue({
        freebusy: { query: mockQuery },
      } as any);

      const { getFreeBusy } = await import('@/lib/google/calendar');
      
      const busyPeriods = await getFreeBusy(
        ['cal-1'],
        new Date('2026-02-14T08:00:00Z'),
        new Date('2026-02-14T18:00:00Z')
      );

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(busyPeriods).toHaveLength(1);
    });

    it('should throw error when not authenticated', async () => {
      mockGetAuthenticatedClient.mockResolvedValue(null);

      const { getFreeBusy } = await import('@/lib/google/calendar');

      await expect(
        getFreeBusy(['cal-1'], new Date(), new Date())
      ).rejects.toThrow('Not authenticated');
    });
  });

  describe('generateEventId', () => {
    it('should generate deterministic event ID from task UID', async () => {
      const { generateEventId } = await import('@/lib/google/calendar');
      
      const eventId = generateEventId('task-123-abc', 0);
      
      expect(eventId).toBe('ctstask123abc0');
      expect(eventId).toMatch(/^[a-v0-9]+$/);
    });

    it('should handle attempt numbers', async () => {
      const { generateEventId } = await import('@/lib/google/calendar');
      
      const eventId1 = generateEventId('task-abc', 0);
      const eventId2 = generateEventId('task-abc', 1);
      
      expect(eventId1).toBe('ctstaskabc0');
      expect(eventId2).toBe('ctstaskabc1');
      expect(eventId1).not.toBe(eventId2);
    });

    it('should ensure minimum length of 5 characters', async () => {
      const { generateEventId } = await import('@/lib/google/calendar');
      
      const eventId = generateEventId('a', 0);
      
      expect(eventId.length).toBeGreaterThanOrEqual(5);
      expect(eventId).toBe('ctsa0');
    });

    it('should sanitize special characters', async () => {
      const { generateEventId } = await import('@/lib/google/calendar');
      
      const eventId = generateEventId('Task@#$%123', 0);
      
      expect(eventId).toMatch(/^[a-v0-9]+$/);
    });
  });

  describe('buildTaskEvent', () => {
    it('should build task event with all required fields', async () => {
      const { buildTaskEvent } = await import('@/lib/google/calendar');
      
      const task: TududiTask = {
        uid: 'task-123',
        name: 'Test Task',
        note: 'Task description',
        priority: 'high',
        tags: [],
        status: 'not_started',
      };

      const slot = {
        start: new Date('2026-02-14T09:00:00Z'),
        end: new Date('2026-02-14T10:00:00Z'),
      };

      const event = buildTaskEvent(task, slot, 'America/Los_Angeles', 0);

      expect(event.id).toBe('ctstask1230');
      expect(event.summary).toBe('Test Task');
      expect(event.description).toContain('Task description');
      expect(event.description).toContain('https://tududi.app/tasks/task-123');
      expect(event.start?.dateTime).toBe('2026-02-14T09:00:00.000Z');
      expect(event.start?.timeZone).toBe('America/Los_Angeles');
      expect(event.end?.dateTime).toBe('2026-02-14T10:00:00.000Z');
      expect(event.source?.url).toBe('https://tududi.app/tasks/task-123');
    });

    it('should handle task without note', async () => {
      const { buildTaskEvent } = await import('@/lib/google/calendar');
      
      const task: TududiTask = {
        uid: 'task-456',
        name: 'Task without note',
        priority: 'medium',
        tags: [],
        status: 'not_started',
      };

      const slot = {
        start: new Date('2026-02-14T09:00:00Z'),
        end: new Date('2026-02-14T10:00:00Z'),
      };

      const event = buildTaskEvent(task, slot, 'UTC', 0);

      expect(event.description).toBe('🔗 https://tududi.app/tasks/task-456');
    });
  });

  describe('buildBreakEvent', () => {
    it('should build break event with correct timing', async () => {
      const { buildBreakEvent } = await import('@/lib/google/calendar');
      
      const task: TududiTask = {
        uid: 'task-123',
        name: 'Test Task',
        priority: 'high',
        tags: [],
        status: 'not_started',
      };

      const taskEndTime = new Date('2026-02-14T10:00:00Z');
      const breakDuration = 15;

      const event = buildBreakEvent(task, breakDuration, taskEndTime, 'UTC');

      expect(event.summary).toBe('Break');
      expect(event.description).toBe('Break after: Test Task');
      expect(event.start?.dateTime).toBe('2026-02-14T10:00:00.000Z');
      expect(event.end?.dateTime).toBe('2026-02-14T10:15:00.000Z');
      expect(event.colorId).toBe('11');
      expect(event.transparency).toBe('transparent');
    });
  });

  describe('createEvent', () => {
    it('should create event in calendar', async () => {
      const mockInsert = vi.fn().mockResolvedValue({
        data: {
          id: 'event-123',
          summary: 'Test Event',
          start: { dateTime: '2026-02-14T09:00:00Z' },
          end: { dateTime: '2026-02-14T10:00:00Z' },
        },
      });

      vi.mocked(google.calendar).mockReturnValue({
        events: { insert: mockInsert },
      } as any);

      const { createEvent } = await import('@/lib/google/calendar');
      
      const event = {
        summary: 'Test Event',
        start: { dateTime: '2026-02-14T09:00:00Z' },
        end: { dateTime: '2026-02-14T10:00:00Z' },
      };

      const result = await createEvent('cal-1', event);

      expect(mockInsert).toHaveBeenCalledWith({
        calendarId: 'cal-1',
        requestBody: event,
      });
      expect(result.id).toBe('event-123');
    });

    it('should retry on 500 error', async () => {
      const mockInsert = vi
        .fn()
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({
          data: { id: 'event-123', summary: 'Test Event' },
        });

      vi.mocked(google.calendar).mockReturnValue({
        events: { insert: mockInsert },
      } as any);

      const { createEvent } = await import('@/lib/google/calendar');
      
      const result = await createEvent('cal-1', { summary: 'Test Event' });

      expect(mockInsert).toHaveBeenCalledTimes(2);
      expect(result.id).toBe('event-123');
    });
  });

  describe('updateEvent', () => {
    it('should update existing event', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        data: {
          id: 'event-123',
          summary: 'Updated Event',
        },
      });

      vi.mocked(google.calendar).mockReturnValue({
        events: { update: mockUpdate },
      } as any);

      const { updateEvent } = await import('@/lib/google/calendar');
      
      const updates = { summary: 'Updated Event' };
      const result = await updateEvent('cal-1', 'event-123', updates);

      expect(mockUpdate).toHaveBeenCalledWith({
        calendarId: 'cal-1',
        eventId: 'event-123',
        requestBody: updates,
      });
      expect(result.summary).toBe('Updated Event');
    });
  });

  describe('deleteEvent', () => {
    it('should delete event from calendar', async () => {
      const mockDelete = vi.fn().mockResolvedValue({});

      vi.mocked(google.calendar).mockReturnValue({
        events: { delete: mockDelete },
      } as any);

      const { deleteEvent } = await import('@/lib/google/calendar');
      
      await deleteEvent('cal-1', 'event-123');

      expect(mockDelete).toHaveBeenCalledWith({
        calendarId: 'cal-1',
        eventId: 'event-123',
      });
    });
  });

  describe('getEvent', () => {
    it('should fetch single event', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          id: 'event-123',
          summary: 'Test Event',
        },
      });

      vi.mocked(google.calendar).mockReturnValue({
        events: { get: mockGet },
      } as any);

      const { getEvent } = await import('@/lib/google/calendar');
      
      const event = await getEvent('cal-1', 'event-123');

      expect(mockGet).toHaveBeenCalledWith({
        calendarId: 'cal-1',
        eventId: 'event-123',
      });
      expect(event?.id).toBe('event-123');
    });

    it('should return null for 404 error', async () => {
      const mockGet = vi.fn().mockRejectedValue({
        response: { status: 404 },
      });

      vi.mocked(google.calendar).mockReturnValue({
        events: { get: mockGet },
      } as any);

      const { getEvent } = await import('@/lib/google/calendar');
      
      const event = await getEvent('cal-1', 'non-existent');

      expect(event).toBeNull();
    });

    it('should throw error for non-retryable errors', async () => {
      const mockGet = vi.fn().mockRejectedValue({
        response: { status: 403 },
      });

      vi.mocked(google.calendar).mockReturnValue({
        events: { get: mockGet },
      } as any);

      const { getEvent } = await import('@/lib/google/calendar');

      await expect(getEvent('cal-1', 'event-123')).rejects.toMatchObject({
        response: { status: 403 },
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('listEvents', () => {
    it('should list events with time range', async () => {
      const mockList = vi.fn().mockResolvedValue({
        data: {
          items: [
            { id: 'event-1', summary: 'Event 1' },
            { id: 'event-2', summary: 'Event 2' },
          ],
          nextSyncToken: 'sync-token-123',
        },
      });

      vi.mocked(google.calendar).mockReturnValue({
        events: { list: mockList },
      } as any);

      const { listEvents } = await import('@/lib/google/calendar');
      
      const timeMin = new Date('2026-02-14T00:00:00Z');
      const timeMax = new Date('2026-02-14T23:59:59Z');
      
      const result = await listEvents('cal-1', { timeMin, timeMax });

      expect(mockList).toHaveBeenCalledWith({
        calendarId: 'cal-1',
        maxResults: 250,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      });
      expect(result.events).toHaveLength(2);
      expect(result.nextSyncToken).toBe('sync-token-123');
    });

    it('should support incremental sync with syncToken', async () => {
      const mockList = vi.fn().mockResolvedValue({
        data: {
          items: [{ id: 'event-3', summary: 'Event 3' }],
          nextSyncToken: 'sync-token-456',
        },
      });

      vi.mocked(google.calendar).mockReturnValue({
        events: { list: mockList },
      } as any);

      const { listEvents } = await import('@/lib/google/calendar');
      
      const result = await listEvents('cal-1', { syncToken: 'sync-token-123' });

      expect(mockList).toHaveBeenCalledWith({
        calendarId: 'cal-1',
        maxResults: 250,
        syncToken: 'sync-token-123',
      });
      expect(result.events).toHaveLength(1);
      expect(result.nextSyncToken).toBe('sync-token-456');
    });

    it('should handle empty results', async () => {
      const mockList = vi.fn().mockResolvedValue({
        data: {
          items: [],
        },
      });

      vi.mocked(google.calendar).mockReturnValue({
        events: { list: mockList },
      } as any);

      const { listEvents } = await import('@/lib/google/calendar');
      
      const result = await listEvents('cal-1');

      expect(result.events).toHaveLength(0);
      expect(result.nextSyncToken).toBeUndefined();
    });
  });
});
