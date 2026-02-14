import type { BusyPeriod, FreeSlot, DayWindow, SchedulingWindows } from './types';

export function mergeBusyPeriods(periods: BusyPeriod[]): BusyPeriod[] {
  if (periods.length <= 1) return periods;
  
  // Sort by start time
  const sorted = [...periods].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: BusyPeriod[] = [];
  
  let current = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    
    // Check if overlapping or adjacent (within 1 minute)
    if (next.start.getTime() <= current.end.getTime() + 60000) {
      // Merge: extend current end if next ends later
      if (next.end.getTime() > current.end.getTime()) {
        current = {
          start: current.start,
          end: next.end,
        };
      }
    } else {
      // No overlap, push current and start new
      merged.push(current);
      current = next;
    }
  }
  
  merged.push(current);
  return merged;
}

export function getDayOfWeek(date: Date): keyof SchedulingWindows {
  const days: (keyof SchedulingWindows)[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];
  return days[date.getDay()];
}

export function findFreeSlotsForDay(
  date: Date,
  dayWindow: DayWindow,
  busyPeriods: BusyPeriod[],
  minDurationMinutes: number
): FreeSlot[] {
  if (!dayWindow.enabled) return [];
  
  const slots: FreeSlot[] = [];
  
  // Create window boundaries for this day
  const windowStart = new Date(date);
  windowStart.setHours(dayWindow.start, 0, 0, 0);
  
  const windowEnd = new Date(date);
  windowEnd.setHours(dayWindow.end, 0, 0, 0);
  
  // Filter busy periods to those within this window
  const relevantBusy = busyPeriods.filter(bp => 
    bp.end > windowStart && bp.start < windowEnd
  );
  
  // Merge overlapping busy periods
  const mergedBusy = mergeBusyPeriods(relevantBusy);
  
  let currentStart = new Date(windowStart);
  
  for (const busy of mergedBusy) {
    // Gap before this busy period
    if (busy.start > currentStart) {
      const gapDuration = (busy.start.getTime() - currentStart.getTime()) / (1000 * 60);
      
      if (gapDuration >= minDurationMinutes) {
        slots.push({
          start: new Date(currentStart),
          end: new Date(busy.start),
          durationMinutes: Math.floor(gapDuration),
        });
      }
    }
    
    // Move current start to end of busy period
    if (busy.end > currentStart) {
      currentStart = new Date(busy.end);
    }
  }
  
  // Gap after last busy period
  if (currentStart < windowEnd) {
    const gapDuration = (windowEnd.getTime() - currentStart.getTime()) / (1000 * 60);
    
    if (gapDuration >= minDurationMinutes) {
      slots.push({
        start: new Date(currentStart),
        end: new Date(windowEnd),
        durationMinutes: Math.floor(gapDuration),
      });
    }
  }
  
  return slots;
}

export function findFreeSlots(
  startDate: Date,
  endDate: Date,
  busyPeriods: BusyPeriod[],
  schedulingWindows: SchedulingWindows,
  minDurationMinutes: number
): FreeSlot[] {
  const allSlots: FreeSlot[] = [];
  
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  while (current <= end) {
    const dayOfWeek = getDayOfWeek(current);
    const dayWindow = schedulingWindows[dayOfWeek];
    
    const daySlots = findFreeSlotsForDay(
      new Date(current),
      dayWindow,
      busyPeriods,
      minDurationMinutes
    );
    
    allSlots.push(...daySlots);
    
    // Move to next day
    current.setDate(current.getDate() + 1);
  }
  
  return allSlots;
}
