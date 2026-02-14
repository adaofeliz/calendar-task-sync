import { TududiApiTask, TududiApiTag, TaskStatus } from './types';

const SCHEDULABLE_STATUSES: TaskStatus[] = [
  'not_started',
  'in_progress',
  'planned',
];

export function getSchedulableTasks(tasks: TududiApiTask[]): TududiApiTask[] {
  return tasks.filter(
    (task) =>
      task.due_date !== undefined &&
      task.due_date !== null &&
      SCHEDULABLE_STATUSES.includes(task.status)
  );
}

export function extractTaskType(
  tags: TududiApiTag[]
): 'focus' | 'noise' | 'unknown' {
  const typeTags = tags.filter((tag) => tag.name.startsWith('Type: '));

  if (typeTags.some((tag) => tag.name === 'Type: Focus')) {
    return 'focus';
  }

  if (typeTags.some((tag) => tag.name === 'Type: Noise')) {
    return 'noise';
  }

  return 'unknown';
}

export function extractTaskSource(
  tags: TududiApiTag[]
): 'email' | 'calendar' | 'unknown' {
  const sourceTags = tags.filter((tag) => tag.name.startsWith('Source: '));

  if (sourceTags.some((tag) => tag.name === 'Source: Email')) {
    return 'email';
  }

  if (sourceTags.some((tag) => tag.name === 'Source: Calendar')) {
    return 'calendar';
  }

  return 'unknown';
}
