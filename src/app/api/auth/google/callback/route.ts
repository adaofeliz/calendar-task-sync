import { NextRequest, NextResponse } from 'next/server';
import { handleCallback } from '@/lib/google/oauth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings?error=no_code', request.url)
    );
  }

  try {
    const result = await handleCallback(code);

    if (!result.success) {
      return NextResponse.redirect(
        new URL('/settings?error=auth_failed', request.url)
      );
    }

    return NextResponse.redirect(
      new URL('/settings?success=connected', request.url)
    );
  } catch (err) {
    console.error('Callback handling error:', err);
    return NextResponse.redirect(
      new URL('/settings?error=callback_error', request.url)
    );
  }
}
