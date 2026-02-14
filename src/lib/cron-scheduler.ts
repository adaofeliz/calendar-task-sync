import * as cron from 'node-cron';
import { runSyncCycle } from '@/lib/sync/orchestrator';
import { getConfig } from '@/lib/config';

let cronJob: cron.ScheduledTask | null = null;
export let lastSync: Date | null = null;
export let nextSync: Date | null = null;
export let cronActive = false;

export async function startCronScheduler() {
  try {
    const syncIntervalMinutes = await getConfig<number>('sync_interval_minutes');
    const interval = syncIntervalMinutes ?? 15;

    // Convert minutes to cron expression: */N * * * *
    const cronExpression = `*/${interval} * * * *`;

    console.log(`[Cron] Starting scheduler with interval: ${interval} minutes`);
    console.log(`[Cron] Cron expression: ${cronExpression}`);

    cronJob = cron.schedule(cronExpression, async () => {
      try {
        console.log(`[Cron] Sync cycle started at ${new Date().toISOString()}`);
        const result = await runSyncCycle();
        
        lastSync = new Date();
        // Calculate next sync time
        nextSync = new Date(lastSync.getTime() + interval * 60 * 1000);

        if (result.success) {
          console.log(`[Cron] Sync completed successfully. Scheduled: ${result.tasksScheduled}, Rescheduled: ${result.tasksRescheduled}, Completed: ${result.tasksCompleted}`);
        } else {
          console.warn(`[Cron] Sync completed with errors: ${result.errors.join(', ')}`);
        }
      } catch (error) {
        console.error(`[Cron] Sync cycle failed:`, error);
      }
    });

    cronActive = true;
    console.log('[Cron] Scheduler started successfully');
  } catch (error) {
    console.error('[Cron] Failed to start scheduler:', error);
    cronActive = false;
  }
}

export function stopCronScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronActive = false;
    console.log('[Cron] Scheduler stopped');
  }
}
