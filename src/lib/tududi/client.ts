import {
  TududiApiTask,
  TududiApiProject,
  TududiApiTag,
  TaskFilters,
  TaskUpdate,
} from './types';

export class TududiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retries = 3
  ): Promise<T> {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 429 || response.status >= 500) {
          if (attempt < retries - 1) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Tududi API error: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        return await response.json();
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Tududi API error:')) {
          throw error;
        }
        
        if (attempt === retries - 1) {
          throw error;
        }
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Failed to fetch after retries');
  }

  async getTasks(filters?: TaskFilters): Promise<TududiApiTask[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.project_id) params.append('project_id', filters.project_id);

    const queryString = params.toString();
    const url = `${this.baseUrl}/api/v1/tasks${queryString ? `?${queryString}` : ''}`;

    return this.fetchWithRetry<TududiApiTask[]>(url);
  }

  async getTask(uid: string): Promise<TududiApiTask> {
    const url = `${this.baseUrl}/api/v1/task/${uid}`;
    return this.fetchWithRetry<TududiApiTask>(url);
  }

  async updateTask(uid: string, updates: TaskUpdate): Promise<TududiApiTask> {
    const url = `${this.baseUrl}/api/v1/task/${uid}`;
    return this.fetchWithRetry<TududiApiTask>(url, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async getProjects(): Promise<TududiApiProject[]> {
    const url = `${this.baseUrl}/api/v1/projects`;
    return this.fetchWithRetry<TududiApiProject[]>(url);
  }

  async getTags(): Promise<TududiApiTag[]> {
    const url = `${this.baseUrl}/api/v1/tags`;
    return this.fetchWithRetry<TududiApiTag[]>(url);
  }
}
