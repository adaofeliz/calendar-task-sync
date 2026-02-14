import { NextResponse } from 'next/server';
import { isAuthenticated, getUserEmail } from '@/lib/google/oauth';

export async function GET() {
  try {
    const connected = await isAuthenticated();

    if (!connected) {
      return NextResponse.json({ connected: false });
    }

    const email = await getUserEmail();

    return NextResponse.json({
      connected: true,
      email: email || undefined,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}
