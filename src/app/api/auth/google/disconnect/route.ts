import { NextResponse } from 'next/server';
import { revokeAccess } from '@/lib/google/oauth';

export async function POST() {
  try {
    const success = await revokeAccess();

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to disconnect Google account' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google account' },
      { status: 500 }
    );
  }
}
