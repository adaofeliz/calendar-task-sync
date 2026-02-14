import { NextResponse } from 'next/server';
import { fetchRecentActivity } from '@/lib/dashboard-data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    
    const data = await fetchRecentActivity(limit);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
