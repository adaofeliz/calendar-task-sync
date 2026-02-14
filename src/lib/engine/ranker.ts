import type { TududiTask, TaskType, RankedTask, WeightsConfig } from './types';

const PRIORITY_SCORES: Record<string, number> = {
  high: 4,
  medium: 3,
  low: 2,
};

const TYPE_SCORES: Record<TaskType, number> = {
  focus: 3,
  unknown: 2,
  noise: 1,
};

const ENERGY_SCORES: Record<TaskType, number> = {
  focus: 3,
  unknown: 2,
  noise: 1,
};

export function extractTaskType(tags: Array<{ name: string }>): TaskType {
  const typeTag = tags.find(tag => 
    tag.name.toLowerCase().startsWith('type:')
  );
  
  if (!typeTag) return 'unknown';
  
  const typeValue = typeTag.name.toLowerCase().replace('type:', '').trim();
  
  if (typeValue === 'focus') return 'focus';
  if (typeValue === 'noise') return 'noise';
  
  return 'unknown';
}

export function calculateUrgency(due_date: string | undefined): number {
  if (!due_date) return 1;

  const due = new Date(due_date);
  const now = new Date();

  // Reset time components to compare dates only
  const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = dueDateOnly.getTime() - nowDateOnly.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 5; // Overdue
  if (diffDays <= 1) return 4; // Today or tomorrow
  if (diffDays <= 7) return 3; // This week
  if (diffDays <= 14) return 2; // Next week
  return 1; // Later
}

export function calculateTaskScore(
  task: TududiTask,
  weights: WeightsConfig,
  rescheduleCount: number = 0,
  projectImportance: number = 2
): { score: number; baseScore: number; boost: number } {
  const taskType = extractTaskType(task.tags);
  
  const priorityScore = PRIORITY_SCORES[task.priority] ?? 2;
  const typeScore = TYPE_SCORES[taskType];
  const energyScore = ENERGY_SCORES[taskType];
  const urgencyScore = calculateUrgency(task.due_date);
  
  const baseScore = 
    priorityScore * weights.priority +
    typeScore * weights.type +
    projectImportance * weights.project +
    urgencyScore * weights.urgency +
    energyScore * weights.energy;
  
  // Reschedule boost: 10% per reschedule, capped at 50%
  const boost = Math.min(rescheduleCount * 0.1, 0.5);
  const score = baseScore * (1 + boost);
  
  return { score, baseScore, boost };
}

export function rankTasks(
  tasks: TududiTask[],
  weights: WeightsConfig,
  rescheduleCounts: Record<string, number> = {},
  projectImportanceMap: Record<string, number> = {}
): RankedTask[] {
  const ranked = tasks.map(task => {
    const rescheduleCount = rescheduleCounts[task.uid] ?? 0;
    const projectImportance = task.project?.uid 
      ? (projectImportanceMap[task.project.uid] ?? 2)
      : 2;
    
    const { score, baseScore, boost } = calculateTaskScore(
      task,
      weights,
      rescheduleCount,
      projectImportance
    );
    
    const taskType = extractTaskType(task.tags);
    
    return {
      task,
      score,
      baseScore,
      rescheduleBoost: boost,
      taskType,
      estimatedDuration: 0, // Will be set later based on duration matrix
    };
  });
  
  // Sort by score descending
  return ranked.sort((a, b) => b.score - a.score);
}
