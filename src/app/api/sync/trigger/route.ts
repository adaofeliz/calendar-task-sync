import { NextResponse } from 'next/server';
import { runSyncCycle } from '@/lib/sync/orchestrator';

export async function POST() {
  try {
    const result = await runSyncCycle();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        tasksScheduled: result.tasksScheduled,
        tasksRescheduled: result.tasksRescheduled,
        tasksCompleted: result.tasksCompleted,
      });
    } else {
      return NextResponse.json({
        success: false,
        errors: result.errors,
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}
