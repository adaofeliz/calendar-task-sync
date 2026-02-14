import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getDb } from '@/db';
import { oauthTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Initialize OAuth2Client with credentials from environment
 */
function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing required OAuth credentials in environment variables');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate authorization URL for OAuth flow
 */
export function getAuthUrl(): string {
  const oauth2Client = createOAuth2Client();

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  return authUrl;
}

/**
 * Handle OAuth callback - exchange code for tokens and store in database
 */
export async function handleCallback(code: string): Promise<{ success: boolean; email?: string }> {
  const oauth2Client = createOAuth2Client();

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to obtain access token or refresh token');
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const db = await getDb();

    const existingTokens = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google'))
      .limit(1);

    const tokenData = {
      provider: 'google',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date || null,
      scope: tokens.scope || '',
      updatedAt: new Date(),
    };

    if (existingTokens.length > 0) {
      await db
        .update(oauthTokens)
        .set(tokenData)
        .where(eq(oauthTokens.id, existingTokens[0].id));
    } else {
      await db.insert(oauthTokens).values({
        ...tokenData,
        createdAt: new Date(),
      });
    }

    return { success: true, email: data.email || undefined };
  } catch (error) {
    console.error('OAuth callback error:', error);
    return { success: false };
  }
}

/**
 * Get authenticated OAuth2Client with stored tokens from database
 */
export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const oauth2Client = createOAuth2Client();

  try {
    const db = await getDb();
    const tokens = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google'))
      .limit(1);

    if (tokens.length === 0) {
      return null;
    }

    const token = tokens[0];

    oauth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expiry_date: token.expiryDate || undefined,
      scope: token.scope,
    });

    oauth2Client.on('tokens', async (newTokens) => {
      try {
        const db = await getDb();
        await db
          .update(oauthTokens)
          .set({
            accessToken: newTokens.access_token || token.accessToken,
            refreshToken: newTokens.refresh_token || token.refreshToken,
            expiryDate: newTokens.expiry_date || token.expiryDate,
            updatedAt: new Date(),
          })
          .where(eq(oauthTokens.id, token.id));
      } catch (error) {
        console.error('Failed to persist refreshed tokens:', error);
      }
    });

    return oauth2Client;
  } catch (error) {
    console.error('Failed to get authenticated client:', error);
    return null;
  }
}

/**
 * Fetch user's calendar list for mapping UI
 */
export async function getCalendarList(): Promise<
  Array<{ id: string; summary: string; primary?: boolean }>
> {
  const oauth2Client = await getAuthenticatedClient();

  if (!oauth2Client) {
    throw new Error('Not authenticated');
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.calendarList.list();

    return (
      response.data.items?.map((cal) => ({
        id: cal.id || '',
        summary: cal.summary || '',
        primary: cal.primary || false,
      })) || []
    );
  } catch (error) {
    console.error('Failed to fetch calendar list:', error);
    throw error;
  }
}

/**
 * Revoke OAuth tokens and delete from database
 */
export async function revokeAccess(): Promise<boolean> {
  const oauth2Client = await getAuthenticatedClient();

  if (!oauth2Client) {
    return false;
  }

  try {
    await oauth2Client.revokeCredentials();

    const db = await getDb();
    await db.delete(oauthTokens).where(eq(oauthTokens.provider, 'google'));

    return true;
  } catch (error) {
    console.error('Failed to revoke access:', error);
    return false;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const db = await getDb();
  const tokens = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.provider, 'google'))
    .limit(1);

  return tokens.length > 0;
}

/**
 * Get user email from stored credentials
 */
export async function getUserEmail(): Promise<string | null> {
  const oauth2Client = await getAuthenticatedClient();

  if (!oauth2Client) {
    return null;
  }

  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    return data.email || null;
  } catch (error) {
    console.error('Failed to get user email:', error);
    return null;
  }
}
