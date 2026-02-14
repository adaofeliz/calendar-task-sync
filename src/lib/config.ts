import { getDb } from '@/db';
import { config as configTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type SchedulingWindow = {
  enabled: boolean;
  start: number;
  end: number;
};

export type SchedulingWindows = {
  monday: SchedulingWindow;
  tuesday: SchedulingWindow;
  wednesday: SchedulingWindow;
  thursday: SchedulingWindow;
  friday: SchedulingWindow;
  saturday: SchedulingWindow;
  sunday: SchedulingWindow;
};

export type DurationMatrix = {
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
};

export type BreakRules = {
  short_duration: number;
  long_duration: number;
  threshold_minutes: number;
};

export type Weights = {
  priority: number;
  type: number;
  project: number;
  urgency: number;
  energy: number;
};

export type PeakHours = {
  start: number;
  end: number;
};

const DEFAULT_CONFIG = {
  timezone: 'UTC',
  sync_interval_minutes: 15,
  reschedule_timeout_hours: 12,
  scheduling_windows: {
    monday: { enabled: true, start: 9, end: 18 },
    tuesday: { enabled: true, start: 9, end: 18 },
    wednesday: { enabled: true, start: 9, end: 18 },
    thursday: { enabled: true, start: 9, end: 18 },
    friday: { enabled: true, start: 9, end: 18 },
    saturday: { enabled: false, start: 9, end: 18 },
    sunday: { enabled: false, start: 9, end: 18 },
  } as SchedulingWindows,
  peak_hours: {
    start: 9,
    end: 12,
  } as PeakHours,
  duration_matrix: {
    focus: { high: 120, medium: 60, low: 30 },
    noise: { high: 45, medium: 30, low: 15 },
  } as DurationMatrix,
  break_rules: {
    short_duration: 15,
    long_duration: 30,
    threshold_minutes: 60,
  } as BreakRules,
  weights: {
    priority: 0.35,
    type: 0.20,
    project: 0.20,
    urgency: 0.15,
    energy: 0.10,
  } as Weights,
};

async function seedDefaultConfig() {
  const db = await getDb();
  
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    const existing = await db.query.config.findFirst({
      where: eq(configTable.key, key),
    });
    
    if (!existing) {
      await db.insert(configTable).values({
        key,
        value: JSON.stringify(value),
        updatedAt: new Date(),
      });
    }
  }
}

export async function getConfig<T>(key: string): Promise<T | null> {
  const db = await getDb();
  
  const result = await db.query.config.findFirst({
    where: eq(configTable.key, key),
  });
  
  if (!result) {
    await seedDefaultConfig();
    
    const defaultValue = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG];
    return defaultValue as T;
  }
  
  return JSON.parse(result.value) as T;
}

export async function setConfig<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  
  const existing = await db.query.config.findFirst({
    where: eq(configTable.key, key),
  });
  
  if (existing) {
    await db
      .update(configTable)
      .set({ 
        value: JSON.stringify(value),
        updatedAt: new Date(),
      })
      .where(eq(configTable.key, key));
  } else {
    await db.insert(configTable).values({
      key,
      value: JSON.stringify(value),
      updatedAt: new Date(),
    });
  }
}

export async function getAllConfig(): Promise<Record<string, unknown>> {
  const db = await getDb();
  const results = await db.query.config.findMany();
  
  if (results.length === 0) {
    await seedDefaultConfig();
    return DEFAULT_CONFIG;
  }
  
  const configMap: Record<string, unknown> = {};
  for (const row of results) {
    configMap[row.key] = JSON.parse(row.value);
  }
  
  return configMap;
}
