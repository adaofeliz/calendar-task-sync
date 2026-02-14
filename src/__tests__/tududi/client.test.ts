import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TududiClient } from '../../lib/tududi/client';
import type { TududiApiTask, TududiApiProject, TududiApiTag } from '../../lib/tududi/types';

describe('TududiClient', () => {
  let client: TududiClient;
  const mockBaseUrl = 'https://tududi.example.com';
  const mockApiKey = 'test-api-key-123';

  beforeEach(() => {
    client = new TududiClient(mockBaseUrl, mockApiKey);
    vi.clearAllMocks();
  });

  describe('getTasks', () => {
    it('should fetch tasks with correct headers and URL', async () => {
      const mockTasks: TududiApiTask[] = [
        {
          uid: 'task-1',
          name: 'Test Task',
          status: 'not_started',
          priority: 'high',
          due_date: '2026-02-15T10:00:00Z',
          tags: [],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTasks,
      });

      const result = await client.getTasks();

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/tasks`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockTasks);
    });

    it('should include filters in query parameters', async () => {
      const mockTasks: TududiApiTask[] = [];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTasks,
      });

      await client.getTasks({
        type: 'focus',
        status: 'in_progress',
        project_id: 'proj-123',
      });

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/tasks?type=focus&status=in_progress&project_id=proj-123`,
        expect.any(Object)
      );
    });
  });

  describe('getTask', () => {
    it('should fetch a single task by uid', async () => {
      const mockTask: TududiApiTask = {
        uid: 'task-1',
        name: 'Test Task',
        status: 'not_started',
        priority: 'medium',
        tags: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTask,
      });

      const result = await client.getTask('task-1');

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/task/task-1`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
          }),
        })
      );
      expect(result).toEqual(mockTask);
    });
  });

  describe('updateTask', () => {
    it('should send PATCH request with updates', async () => {
      const mockTask: TududiApiTask = {
        uid: 'task-1',
        name: 'Updated Task',
        status: 'done',
        priority: 'low',
        tags: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTask,
      });

      const updates = { status: 'done' as const, priority: 'low' as const };
      const result = await client.updateTask('task-1', updates);

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/task/task-1`,
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(updates),
        })
      );
      expect(result).toEqual(mockTask);
    });
  });

  describe('getProjects', () => {
    it('should fetch all projects', async () => {
      const mockProjects: TududiApiProject[] = [
        { uid: 'proj-1', name: 'Project 1' },
        { uid: 'proj-2', name: 'Project 2' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      });

      const result = await client.getProjects();

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/projects`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
          }),
        })
      );
      expect(result).toEqual(mockProjects);
    });
  });

  describe('getTags', () => {
    it('should fetch all tags', async () => {
      const mockTags: TududiApiTag[] = [
        { name: 'Type: Focus' },
        { name: 'Source: Email' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTags,
      });

      const result = await client.getTags();

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/tags`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
          }),
        })
      );
      expect(result).toEqual(mockTags);
    });
  });

  describe('retry logic', () => {
    it('should retry on 429 status code with exponential backoff', async () => {
      const mockTask: TududiApiTask = {
        uid: 'task-1',
        name: 'Test Task',
        status: 'not_started',
        priority: 'high',
        tags: [],
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests', text: async () => 'Rate limited' })
        .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests', text: async () => 'Rate limited' })
        .mockResolvedValueOnce({ ok: true, json: async () => mockTask });

      const result = await client.getTask('task-1');

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockTask);
    });

    it('should retry on 5xx status codes', async () => {
      const mockTasks: TududiApiTask[] = [];

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error', text: async () => 'Server error' })
        .mockResolvedValueOnce({ ok: true, json: async () => mockTasks });

      const result = await client.getTasks();

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockTasks);
    });

    it('should throw error after max retries', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      await expect(client.getTasks()).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 4xx errors (except 429)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Not found',
      });

      await expect(client.getTask('invalid-uid')).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should throw descriptive error on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid parameters',
      });

      await expect(client.getTasks()).rejects.toThrow(
        'Tududi API error: 400 Bad Request - Invalid parameters'
      );
    });
  });
});
