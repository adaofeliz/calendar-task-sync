import { NextResponse } from 'next/server';
import { fetchDashboardStats } from '@/lib/dashboard-data';

export async function GET() {
  try {
    const data = await fetchDashboardStats();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
