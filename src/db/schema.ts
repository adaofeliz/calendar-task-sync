import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Synced tasks from Tududi with Google Calendar events
export const syncedTasks = sqliteTable('synced_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskUid: text('task_uid').notNull().unique(),
  cleanName: text('clean_name').notNull(),
  currentEmoji: text('current_emoji'),
  calendarEventId: text('calendar_event_id'),
  breakEventId: text('break_event_id'),
  calendarId: text('calendar_id'),
  scheduledStart: integer('scheduled_start', { mode: 'timestamp' }),
  scheduledEnd: integer('scheduled_end', { mode: 'timestamp' }),
  status: text('status', { 
    enum: ['pending', 'scheduled', 'completed', 'rescheduled', 'failed', 'cancelled'] 
  }).notNull().default('pending'),
  rescheduleCount: integer('reschedule_count').notNull().default(0),
  tududiStatus: text('tududi_status'),
  lastCheckedAt: integer('last_checked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Global sync state tracking
export const syncState = sqliteTable('sync_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  syncInProgress: integer('sync_in_progress', { mode: 'boolean' }).notNull().default(false),
  syncStartedAt: integer('sync_started_at', { mode: 'timestamp' }),
  googleSyncToken: text('google_sync_token'),
  syncIntervalMinutes: integer('sync_interval_minutes').notNull().default(15),
});

// Key-value config store (JSON values for complex objects)
export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// OAuth tokens for Google Calendar API
export const oauthTokens = sqliteTable('oauth_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull().default('google'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiryDate: integer('expiry_date'),
  scope: text('scope').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Project to calendar mappings
export const calendarMappings = sqliteTable('calendar_mappings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectUid: text('project_uid').notNull(),
  projectName: text('project_name').notNull(),
  calendarId: text('calendar_id').notNull(),
  calendarName: text('calendar_name').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Calendars to check for busy/free time
export const busyCalendars = sqliteTable('busy_calendars', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  calendarId: text('calendar_id').notNull().unique(),
  calendarName: text('calendar_name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
