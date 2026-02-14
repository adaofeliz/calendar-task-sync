import { describe, it, expect } from 'vitest';
import {
  extractTaskType,
  calculateUrgency,
  calculateTaskScore,
  rankTasks,
} from '@/lib/engine/ranker';
import type { TududiTask, WeightsConfig } from '@/lib/engine/types';

const defaultWeights: WeightsConfig = {
  priority: 0.35,
  type: 0.20,
  project: 0.20,
  urgency: 0.15,
  energy: 0.10,
};

describe('extractTaskType', () => {
  it('should identify focus tasks', () => {
    const task: TududiTask = {
      uid: '1',
      name: 'Test',
      priority: 'high',
      tags: [{ name: 'Type: Focus' }],
      status: 'not_started',
    };
    expect(extractTaskType(task.tags)).toBe('focus');
  });

  it('should identify noise tasks', () => {
    const task: TududiTask = {
      uid: '1',
      name: 'Test',
      priority: 'high',
      tags: [{ name: 'Type: Noise' }],
      status: 'not_started',
    };
    expect(extractTaskType(task.tags)).toBe('noise');
  });

  it('should return unknown for tasks without type tag', () => {
    const task: TududiTask = {
      uid: '1',
      name: 'Test',
      priority: 'high',
      tags: [{ name: 'Source: Email' }],
      status: 'not_started',
    };
    expect(extractTaskType(task.tags)).toBe('unknown');
  });

  it('should handle case insensitivity', () => {
    const task: TududiTask = {
      uid: '1',
      name: 'Test',
      priority: 'high',
      tags: [{ name: 'type: focus' }],
      status: 'not_started',
    };
    expect(extractTaskType(task.tags)).toBe('focus');
  });
});

describe('calculateUrgency', () => {
  it('should return 5 for overdue tasks', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(calculateUrgency(yesterday.toISOString())).toBe(5);
  });

  it('should return 4 for today/tomorrow', () => {
    const today = new Date();
    expect(calculateUrgency(today.toISOString())).toBe(4);
  });

  it('should return 3 for this week', () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 3);
    expect(calculateUrgency(nextWeek.toISOString())).toBe(3);
  });

  it('should return 2 for next week', () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 10);
    expect(calculateUrgency(nextWeek.toISOString())).toBe(2);
  });

  it('should return 1 for tasks without due date', () => {
    expect(calculateUrgency(undefined)).toBe(1);
  });
});

describe('calculateTaskScore', () => {
  it('should calculate base score correctly', () => {
    const task: TududiTask = {
      uid: '1',
      name: 'Test',
      priority: 'high',
      tags: [{ name: 'Type: Focus' }],
      due_date: new Date().toISOString(),
      status: 'not_started',
    };
    
    const result = calculateTaskScore(task, defaultWeights, 0, 3);
    expect(result.score).toBeGreaterThan(0);
    expect(result.baseScore).toBeGreaterThan(0);
    expect(result.boost).toBe(0);
  });

  it('should apply reschedule boost', () => {
    const task: TududiTask = {
      uid: '1',
      name: 'Test',
      priority: 'high',
      tags: [{ name: 'Type: Focus' }],
      status: 'not_started',
    };
    
    const result = calculateTaskScore(task, defaultWeights, 2, 2);
    expect(result.boost).toBe(0.2);
    expect(result.score).toBe(result.baseScore * 1.2);
  });

  it('should cap boost at 50%', () => {
    const task: TududiTask = {
      uid: '1',
      name: 'Test',
      priority: 'high',
      tags: [{ name: 'Type: Focus' }],
      status: 'not_started',
    };
    
    const result = calculateTaskScore(task, defaultWeights, 10, 2);
    expect(result.boost).toBe(0.5);
    expect(result.score).toBe(result.baseScore * 1.5);
  });
});

describe('rankTasks', () => {
  it('should sort tasks by score descending', () => {
    const tasks: TududiTask[] = [
      {
        uid: '1',
        name: 'Low priority',
        priority: 'low',
        tags: [{ name: 'Type: Noise' }],
        status: 'not_started',
      },
      {
        uid: '2',
        name: 'High priority',
        priority: 'high',
        tags: [{ name: 'Type: Focus' }],
      due_date: new Date().toISOString(),
        status: 'not_started',
      },
    ];
    
    const ranked = rankTasks(tasks, defaultWeights);
    expect(ranked[0].task.uid).toBe('2');
    expect(ranked[1].task.uid).toBe('1');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('should boost rescheduled tasks', () => {
    const tasks: TududiTask[] = [
      {
        uid: '1',
        name: 'High priority rescheduled',
        priority: 'high',
        tags: [{ name: 'Type: Focus' }],
        status: 'not_started',
      },
      {
        uid: '2',
        name: 'High priority new',
        priority: 'high',
        tags: [{ name: 'Type: Focus' }],
        status: 'not_started',
      },
    ];
    
    const rescheduleCounts = { '1': 5 };
    const ranked = rankTasks(tasks, defaultWeights, rescheduleCounts);
    
    expect(ranked[0].rescheduleBoost).toBe(0.5);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});
