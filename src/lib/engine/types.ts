// Task types from Tududi
export interface TududiTask {
  uid: string;
  name: string;
  note?: string;
  priority: 'low' | 'medium' | 'high';
  tags: Array<{ name: string }>;
  project?: {
    uid: string;
    name: string;
    importance?: number;
  };
  due_date?: string; // ISO date string
  status: string;
}

// Task type extracted from tags
export type TaskType = 'focus' | 'noise' | 'unknown';

// Emoji types
export type Emoji = '📅' | '⚠️' | '❌';
export const EMOJIS = {
  SCHEDULED: '📅' as Emoji,
  PROBLEM: '⚠️' as Emoji,
  PAST_DUE: '❌' as Emoji,
};

// Weighted scoring configuration
export interface WeightsConfig {
  priority: number;
  type: number;
  project: number;
  urgency: number;
  energy: number;
}

// Duration matrix for task estimation
export interface DurationMatrix {
  focus: {
    high: number;
    medium: number;
    low: number;
  };
  noise: {
    high: number;
    medium: number;
    low: number;
  };
}

// Break rules configuration
export interface BreakRules {
  shortDuration: number; // 15 minutes
  longDuration: number; // 30 minutes
  thresholdMinutes: number; // 60 minutes threshold
}

// Scheduling window for a day
export interface DayWindow {
  enabled: boolean;
  start: number; // hour (0-23)
  end: number; // hour (0-23)
}

// Weekly scheduling windows
export interface SchedulingWindows {
  monday: DayWindow;
  tuesday: DayWindow;
  wednesday: DayWindow;
  thursday: DayWindow;
  friday: DayWindow;
  saturday: DayWindow;
  sunday: DayWindow;
}

// Peak hours for focus tasks
export interface PeakHours {
  start: number; // hour
  end: number; // hour
}

// Busy period from Google Calendar
export interface BusyPeriod {
  start: Date;
  end: Date;
}

// Free slot for scheduling
export interface FreeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

// Task with computed score
export interface RankedTask {
  task: TududiTask;
  score: number;
  baseScore: number;
  rescheduleBoost: number;
  taskType: TaskType;
  estimatedDuration: number;
}

// Calendar mapping
export interface CalendarMapping {
  projectUid: string;
  calendarId: string;
}

// Task placement decision
export interface PlacementDecision {
  task: TududiTask;
  rankedTask: RankedTask;
  eventStart: Date;
  eventEnd: Date;
  breakStart: Date;
  breakEnd: Date;
  calendarId: string;
  isPeakSlot: boolean;
  breakDuration: number;
}

// Scheduling config bundle
export interface SchedulingConfig {
  weights: WeightsConfig;
  durationMatrix: DurationMatrix;
  breakRules: BreakRules;
  schedulingWindows: SchedulingWindows;
  peakHours: PeakHours;
  timezone: string;
}

// Input to scheduler
export interface SchedulerInput {
  tasks: RankedTask[];
  freeSlots: FreeSlot[];
  calendarMappings: CalendarMapping[];
  defaultCalendarId: string;
  breakRules: BreakRules;
  peakHours: PeakHours;
}
