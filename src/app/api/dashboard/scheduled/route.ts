import { NextResponse } from 'next/server';
import { fetchScheduledTasks } from '@/lib/dashboard-data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    const data = await fetchScheduledTasks(limit);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching scheduled tasks:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
