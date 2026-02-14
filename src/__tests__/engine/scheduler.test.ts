import { describe, it, expect } from 'vitest';
import {
  getBreakDuration,
  isPeakHourSlot,
  findBestSlot,
  scheduleTasks,
} from '@/lib/engine/scheduler';
import type {
  RankedTask,
  FreeSlot,
  SchedulingWindows,
  BreakRules,
  PeakHours,
} from '@/lib/engine/types';

const breakRules: BreakRules = {
  shortDuration: 15,
  longDuration: 30,
  thresholdMinutes: 60,
};

const peakHours: PeakHours = {
  start: 9,
  end: 12,
};

describe('getBreakDuration', () => {
  it('should return short break for tasks under threshold', () => {
    expect(getBreakDuration(30, breakRules)).toBe(15);
    expect(getBreakDuration(59, breakRules)).toBe(15);
  });

  it('should return long break for tasks at or over threshold', () => {
    expect(getBreakDuration(60, breakRules)).toBe(30);
    expect(getBreakDuration(120, breakRules)).toBe(30);
  });
});

describe('isPeakHourSlot', () => {
  it('should identify peak hour slots', () => {
    const slot: FreeSlot = {
      start: new Date('2025-01-15T10:00:00'),
      end: new Date('2025-01-15T11:00:00'),
      durationMinutes: 60,
    };
    expect(isPeakHourSlot(slot, peakHours)).toBe(true);
  });

  it('should identify non-peak hour slots', () => {
    const slot: FreeSlot = {
      start: new Date('2025-01-15T14:00:00'),
      end: new Date('2025-01-15T15:00:00'),
      durationMinutes: 60,
    };
    expect(isPeakHourSlot(slot, peakHours)).toBe(false);
  });
});

describe('scheduleTasks', () => {
  it('should schedule tasks in available slots', () => {
    const rankedTasks: RankedTask[] = [
      {
        task: {
          uid: '1',
          name: 'Task 1',
          priority: 'high',
          tags: [],
          status: 'not_started',
        },
        score: 10,
        baseScore: 10,
        rescheduleBoost: 0,
        taskType: 'focus',
        estimatedDuration: 60,
      },
    ];

    const freeSlots: FreeSlot[] = [
      {
        start: new Date('2025-01-15T09:00:00'),
        end: new Date('2025-01-15T17:00:00'),
        durationMinutes: 8 * 60,
      },
    ];

    const placements = scheduleTasks(
      rankedTasks,
      freeSlots,
      [],
      'primary',
      breakRules,
      peakHours
    );

    expect(placements).toHaveLength(1);
    expect(placements[0].eventStart.getHours()).toBe(9);
    expect(placements[0].breakDuration).toBe(30);
  });

  it('should skip tasks that do not fit', () => {
    const rankedTasks: RankedTask[] = [
      {
        task: {
          uid: '1',
          name: 'Long Task',
          priority: 'high',
          tags: [],
          status: 'not_started',
        },
        score: 10,
        baseScore: 10,
        rescheduleBoost: 0,
        taskType: 'focus',
        estimatedDuration: 240, // 4 hours
      },
    ];

    const freeSlots: FreeSlot[] = [
      {
        start: new Date('2025-01-15T09:00:00'),
        end: new Date('2025-01-15T10:00:00'),
        durationMinutes: 60,
      },
    ];

    const placements = scheduleTasks(
      rankedTasks,
      freeSlots,
      [],
      'primary',
      breakRules,
      peakHours
    );

    expect(placements).toHaveLength(0);
  });
});
