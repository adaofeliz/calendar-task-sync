import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { lastSync, nextSync, cronActive } from '@/lib/cron-scheduler';

export async function GET() {
  try {
    const db = await getDb();
    
    await db.query.config.findMany({ limit: 1 });
    
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      cronActive,
      lastSync: lastSync?.toISOString() ?? null,
      nextSync: nextSync?.toISOString() ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        cronActive,
        lastSync: lastSync?.toISOString() ?? null,
        nextSync: nextSync?.toISOString() ?? null,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
