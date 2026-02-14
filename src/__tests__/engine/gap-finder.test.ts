import { describe, it, expect } from 'vitest';
import {
  mergeBusyPeriods,
  findFreeSlotsForDay,
  findFreeSlots,
} from '@/lib/engine/gap-finder';
import type { BusyPeriod, SchedulingWindows } from '@/lib/engine/types';

describe('mergeBusyPeriods', () => {
  it('should return empty array for empty input', () => {
    expect(mergeBusyPeriods([])).toEqual([]);
  });

  it('should return single period unchanged', () => {
    const periods: BusyPeriod[] = [
      { start: new Date('2025-01-15T09:00:00'), end: new Date('2025-01-15T10:00:00') },
    ];
    expect(mergeBusyPeriods(periods)).toEqual(periods);
  });

  it('should merge overlapping periods', () => {
    const periods: BusyPeriod[] = [
      { start: new Date('2025-01-15T09:00:00'), end: new Date('2025-01-15T10:30:00') },
      { start: new Date('2025-01-15T10:00:00'), end: new Date('2025-01-15T11:00:00') },
    ];
    const merged = mergeBusyPeriods(periods);
    expect(merged).toHaveLength(1);
    expect(merged[0].start.getTime()).toBe(periods[0].start.getTime());
    expect(merged[0].end.getTime()).toBe(periods[1].end.getTime());
  });

  it('should merge adjacent periods (within 1 minute)', () => {
    const periods: BusyPeriod[] = [
      { start: new Date('2025-01-15T09:00:00'), end: new Date('2025-01-15T10:00:00') },
      { start: new Date('2025-01-15T10:00:30'), end: new Date('2025-01-15T11:00:00') },
    ];
    const merged = mergeBusyPeriods(periods);
    expect(merged).toHaveLength(1);
  });

  it('should not merge non-overlapping periods', () => {
    const periods: BusyPeriod[] = [
      { start: new Date('2025-01-15T09:00:00'), end: new Date('2025-01-15T10:00:00') },
      { start: new Date('2025-01-15T11:00:00'), end: new Date('2025-01-15T12:00:00') },
    ];
    const merged = mergeBusyPeriods(periods);
    expect(merged).toHaveLength(2);
  });
});

describe('findFreeSlotsForDay', () => {
  const dayWindow = { enabled: true, start: 9, end: 17 };

  it('should return empty array for disabled day', () => {
    const disabledWindow = { enabled: false, start: 9, end: 17 };
    const slots = findFreeSlotsForDay(
      new Date('2025-01-15'),
      disabledWindow,
      [],
      60
    );
    expect(slots).toEqual([]);
  });

  it('should find free slot when no busy periods', () => {
    const slots = findFreeSlotsForDay(
      new Date('2025-01-15'),
      dayWindow,
      [],
      60
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].durationMinutes).toBe(8 * 60); // 9am to 5pm = 8 hours
  });

  it('should find gaps between busy periods', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2025-01-15T10:00:00'), end: new Date('2025-01-15T11:00:00') },
      { start: new Date('2025-01-15T14:00:00'), end: new Date('2025-01-15T15:00:00') },
    ];
    const slots = findFreeSlotsForDay(
      new Date('2025-01-15'),
      dayWindow,
      busyPeriods,
      60
    );
    expect(slots).toHaveLength(3);
    // 9-10am, 11am-2pm, 3-5pm
    expect(slots[0].durationMinutes).toBe(60);
    expect(slots[1].durationMinutes).toBe(3 * 60);
    expect(slots[2].durationMinutes).toBe(2 * 60);
  });

  it('should filter slots smaller than minimum duration', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2025-01-15T09:00:00'), end: new Date('2025-01-15T16:00:00') },
    ];
    const slots = findFreeSlotsForDay(
      new Date('2025-01-15'),
      dayWindow,
      busyPeriods,
      120 // Need at least 2 hours
    );
    // 4-5pm slot is only 60 minutes, which is less than 120 min minimum
    expect(slots).toHaveLength(0);
  });
});

describe('findFreeSlots', () => {
  const schedulingWindows: SchedulingWindows = {
    monday: { enabled: true, start: 9, end: 17 },
    tuesday: { enabled: true, start: 9, end: 17 },
    wednesday: { enabled: true, start: 9, end: 17 },
    thursday: { enabled: true, start: 9, end: 17 },
    friday: { enabled: true, start: 9, end: 17 },
    saturday: { enabled: false, start: 9, end: 17 },
    sunday: { enabled: false, start: 9, end: 17 },
  };

  it('should find slots across multiple days', () => {
    const startDate = new Date('2025-01-13'); // Monday
    const endDate = new Date('2025-01-15'); // Wednesday
    
    const slots = findFreeSlots(startDate, endDate, [], schedulingWindows, 60);
    expect(slots.length).toBeGreaterThanOrEqual(3); // At least one per weekday
  });

  it('should skip disabled days', () => {
    const startDate = new Date('2025-01-18'); // Saturday
    const endDate = new Date('2025-01-19'); // Sunday
    
    const slots = findFreeSlots(startDate, endDate, [], schedulingWindows, 60);
    expect(slots).toHaveLength(0); // Weekend disabled
  });
});
