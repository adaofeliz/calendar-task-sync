export async function register() {
  console.log('[Instrumentation] register() called, NEXT_RUNTIME:', process.env.NEXT_RUNTIME);
  
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Loading cron scheduler');
    const { startCronScheduler } = await import('@/lib/cron-scheduler');
    await startCronScheduler();
    console.log('[Instrumentation] Cron scheduler started');
  } else {
    console.log('[Instrumentation] Not nodejs runtime, skipping cron scheduler');
  }
}
