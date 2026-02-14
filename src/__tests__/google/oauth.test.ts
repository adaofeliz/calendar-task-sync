import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { google } from 'googleapis';

vi.mock('googleapis');
vi.mock('@/db', () => ({
  getDb: vi.fn(),
}));

const mockGetDb = vi.mocked((await import('@/db')).getDb);

describe('Google OAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  describe('getAuthUrl', () => {
    it('should generate authorization URL with correct scopes', async () => {
      const mockGenerateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth');
      
      vi.mocked(google.auth.OAuth2).mockImplementation(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        on: vi.fn(),
        setCredentials: vi.fn(),
        getToken: vi.fn(),
        revokeCredentials: vi.fn(),
      }) as any);

      const { getAuthUrl } = await import('@/lib/google/oauth');
      const url = getAuthUrl();

      expect(url).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
        prompt: 'consent',
      });
    });

    it('should throw error when environment variables are missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID;

      const { getAuthUrl } = await import('@/lib/google/oauth');
      
      expect(() => getAuthUrl()).toThrow('Missing required OAuth credentials');
    });
  });

  describe('handleCallback', () => {
    it('should exchange code for tokens and store in database', async () => {
      const mockGetToken = vi.fn().mockResolvedValue({
        tokens: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expiry_date: Date.now() + 3600000,
          scope: 'calendar',
        },
      });

      const mockUserinfoGet = vi.fn().mockResolvedValue({
        data: { email: 'test@example.com' },
      });

      vi.mocked(google.auth.OAuth2).mockImplementation(() => ({
        getToken: mockGetToken,
        setCredentials: vi.fn(),
        on: vi.fn(),
        generateAuthUrl: vi.fn(),
        revokeCredentials: vi.fn(),
      }) as any);

      vi.mocked(google.oauth2).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      } as any);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockResolvedValue(undefined);

      mockGetDb.mockResolvedValue({
        select: mockSelect,
        insert: mockInsert,
      } as any);

      mockSelect.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        where: mockWhere,
      });

      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      mockInsert.mockReturnValue({
        values: mockValues,
      });

      const { handleCallback } = await import('@/lib/google/oauth');
      const result = await handleCallback('test-code');

      expect(result.success).toBe(true);
      expect(result.email).toBe('test@example.com');
      expect(mockGetToken).toHaveBeenCalledWith('test-code');
    });

    it('should return failure when tokens are missing', async () => {
      const mockGetToken = vi.fn().mockResolvedValue({
        tokens: {
          access_token: 'mock-access-token',
        },
      });

      vi.mocked(google.auth.OAuth2).mockImplementation(() => ({
        getToken: mockGetToken,
        setCredentials: vi.fn(),
        on: vi.fn(),
        generateAuthUrl: vi.fn(),
        revokeCredentials: vi.fn(),
      }) as any);

      const { handleCallback } = await import('@/lib/google/oauth');
      const result = await handleCallback('test-code');

      expect(result.success).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when tokens exist', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{ id: 1 }]);

      mockGetDb.mockResolvedValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        where: mockWhere,
      });

      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const { isAuthenticated } = await import('@/lib/google/oauth');
      const result = await isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false when no tokens exist', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      mockGetDb.mockResolvedValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        where: mockWhere,
      });

      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const { isAuthenticated } = await import('@/lib/google/oauth');
      const result = await isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('getCalendarList', () => {
    it('should fetch calendar list from Google API', async () => {
      const mockCalendarListList = vi.fn().mockResolvedValue({
        data: {
          items: [
            { id: 'cal-1', summary: 'Primary Calendar', primary: true },
            { id: 'cal-2', summary: 'Work Calendar', primary: false },
          ],
        },
      });

      vi.mocked(google.calendar).mockReturnValue({
        calendarList: { list: mockCalendarListList },
      } as any);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([
        {
          id: 1,
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
          expiryDate: null,
          scope: 'calendar',
        },
      ]);

      mockGetDb.mockResolvedValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        where: mockWhere,
      });

      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      vi.mocked(google.auth.OAuth2).mockImplementation(() => ({
        setCredentials: vi.fn(),
        on: vi.fn(),
        getToken: vi.fn(),
        generateAuthUrl: vi.fn(),
        revokeCredentials: vi.fn(),
      }) as any);

      const { getCalendarList } = await import('@/lib/google/oauth');
      const calendars = await getCalendarList();

      expect(calendars).toHaveLength(2);
      expect(calendars[0]).toEqual({
        id: 'cal-1',
        summary: 'Primary Calendar',
        primary: true,
      });
    });

    it('should throw error when not authenticated', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      mockGetDb.mockResolvedValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        where: mockWhere,
      });

      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const { getCalendarList } = await import('@/lib/google/oauth');

      await expect(getCalendarList()).rejects.toThrow('Not authenticated');
    });
  });
});
