import { TududiApiTask, TududiApiTag, TaskStatus } from './types';

const SCHEDULABLE_STATUSES: TaskStatus[] = [
  'not_started',
  'in_progress',
  'planned',
];

export function getSchedulableTasks(tasks: TududiApiTask[]): TududiApiTask[] {
  return tasks.filter(
    (task) => {
      const hasDateStr = task.due_date !== undefined && task.due_date !== null ? 'yes' : 'no';
      const statusMatch = SCHEDULABLE_STATUSES.includes(task.status);
      const eligible = hasDateStr === 'yes' && statusMatch;
      
      console.log('[Filters] Task eligibility:', {
        uid: task.uid,
        name: task.name,
        has_due_date: hasDateStr,
        status: task.status,
        status_match: statusMatch,
        eligible,
      });
      
      return eligible;
    }
  );
}

export function extractTaskType(
  tags: TududiApiTag[]
): 'focus' | 'noise' | 'unknown' {
  const typeTags = tags.filter((tag) => tag.name.toLowerCase().trim().startsWith('type: '));

  if (typeTags.some((tag) => tag.name.toLowerCase().trim() === 'type: focus')) {
    return 'focus';
  }

  if (typeTags.some((tag) => tag.name.toLowerCase().trim() === 'type: noise')) {
    return 'noise';
  }

  return 'unknown';
}

export function extractTaskSource(
  tags: TududiApiTag[]
): 'email' | 'calendar' | 'unknown' {
  const sourceTags = tags.filter((tag) => tag.name.toLowerCase().trim().startsWith('source: '));

  if (sourceTags.some((tag) => tag.name.toLowerCase().trim() === 'source: email')) {
    return 'email';
  }

  if (sourceTags.some((tag) => tag.name.toLowerCase().trim() === 'source: calendar')) {
    return 'calendar';
  }

  return 'unknown';
}
