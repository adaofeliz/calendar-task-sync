import type {
  TududiTask,
  RankedTask,
  FreeSlot,
  PlacementDecision,
  DurationMatrix,
  BreakRules,
  PeakHours,
  CalendarMapping,
  TaskType,
} from './types';

export function getTaskDuration(
  task: TududiTask,
  durationMatrix: DurationMatrix
): number {
  const priority = task.priority;
  
  // For now, assume all tasks are 'focus' type for duration estimation
  // This could be enhanced to detect task type from tags
  return durationMatrix.focus[priority] ?? 60;
}

export function getBreakDuration(
  taskDurationMinutes: number,
  breakRules: BreakRules
): number {
  if (taskDurationMinutes < breakRules.thresholdMinutes) {
    return breakRules.shortDuration;
  }
  return breakRules.longDuration;
}

export function isPeakHourSlot(slot: FreeSlot, peakHours: PeakHours): boolean {
  const slotHour = slot.start.getHours();
  return slotHour >= peakHours.start && slotHour < peakHours.end;
}

export function findBestSlot(
  rankedTask: RankedTask,
  freeSlots: FreeSlot[],
  peakHours: PeakHours
): { slot: FreeSlot; slotIndex: number } | null {
  const taskDuration = rankedTask.estimatedDuration;
  const breakDuration = getBreakDuration(taskDuration, {
    shortDuration: 15,
    longDuration: 30,
    thresholdMinutes: 60,
  });
  const totalDuration = taskDuration + breakDuration;
  
  // For focus tasks, prefer peak hour slots first
  if (rankedTask.taskType === 'focus') {
    const peakSlots = freeSlots
      .map((slot, slotIndex) => ({ slot, slotIndex }))
      .filter(({ slot }) => isPeakHourSlot(slot, peakHours) && slot.durationMinutes >= totalDuration);
    
    if (peakSlots.length > 0) {
      // Find the best fit (smallest gap that fits)
      return peakSlots.reduce((best, current) => 
        current.slot.durationMinutes < best.slot.durationMinutes ? current : best
      );
    }
  }
  
  // For noise tasks or if no peak slot available, find any slot that fits
  const fittingSlots = freeSlots
    .map((slot, slotIndex) => ({ slot, slotIndex }))
    .filter(({ slot }) => slot.durationMinutes >= totalDuration);
  
  if (fittingSlots.length === 0) return null;
  
  // Best fit: smallest gap that fits (minimize wasted time)
  return fittingSlots.reduce((best, current) => 
    current.slot.durationMinutes < best.slot.durationMinutes ? current : best
  );
}

export function scheduleTasks(
  rankedTasks: RankedTask[],
  freeSlots: FreeSlot[],
  calendarMappings: CalendarMapping[],
  defaultCalendarId: string,
  breakRules: BreakRules,
  peakHours: PeakHours
): PlacementDecision[] {
  const placements: PlacementDecision[] = [];
  const remainingSlots = [...freeSlots];
  
  for (const rankedTask of rankedTasks) {
    const bestSlotResult = findBestSlot(rankedTask, remainingSlots, peakHours);
    
    if (!bestSlotResult) {
      // Task cannot be scheduled
      continue;
    }
    
    const { slot, slotIndex } = bestSlotResult;
    const taskDuration = rankedTask.estimatedDuration;
    const breakDuration = getBreakDuration(taskDuration, breakRules);
    
    // Calculate event times
    const eventStart = new Date(slot.start);
    const eventEnd = new Date(eventStart.getTime() + taskDuration * 60 * 1000);
    const breakStart = new Date(eventEnd);
    const breakEnd = new Date(breakStart.getTime() + breakDuration * 60 * 1000);
    
    // Find calendar for this task
    const calendarId = rankedTask.task.project?.uid
      ? (calendarMappings.find(m => m.projectUid === rankedTask.task.project!.uid)?.calendarId ?? defaultCalendarId)
      : defaultCalendarId;
    
    placements.push({
      task: rankedTask.task,
      rankedTask,
      eventStart,
      eventEnd,
      breakStart,
      breakEnd,
      calendarId,
      isPeakSlot: isPeakHourSlot(slot, peakHours),
      breakDuration,
    });
    
    // Update the slot - either remove it or split it
    const slotEnd = new Date(slot.end);
    if (breakEnd.getTime() >= slotEnd.getTime()) {
      // Task + break consumes entire slot
      remainingSlots.splice(slotIndex, 1);
    } else {
      // Split slot - update remaining portion
      remainingSlots[slotIndex] = {
        start: breakEnd,
        end: slotEnd,
        durationMinutes: Math.floor((slotEnd.getTime() - breakEnd.getTime()) / (1000 * 60)),
      };
    }
  }
  
  return placements;
}
