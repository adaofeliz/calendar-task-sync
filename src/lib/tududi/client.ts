import {
  TududiApiTask,
  TududiApiProject,
  TududiApiTag,
  TaskFilters,
  TaskUpdate,
} from './types';

// Map numeric priority to string
function normalizePriority(priority: number): 'low' | 'medium' | 'high' {
  switch (priority) {
    case 0: return 'low';
    case 1: return 'medium';
    case 2: return 'high';
    default: return 'medium';
  }
}

// Map numeric status to string
function normalizeStatus(status: number): 'not_started' | 'in_progress' | 'done' | 'archived' | 'waiting' | 'cancelled' | 'planned' {
  switch (status) {
    case 0: return 'not_started';
    case 1: return 'in_progress';
    case 2: return 'done';
    case 3: return 'archived';
    case 4: return 'waiting';
    case 5: return 'cancelled';
    case 6: return 'planned';
    default: return 'not_started';
  }
}

// Normalize task fields
function normalizeTask(task: any): TududiApiTask {
  const normalized: TududiApiTask = {
    ...task,
    priority: typeof task.priority === 'number' ? normalizePriority(task.priority) : task.priority,
    status: typeof task.status === 'number' ? normalizeStatus(task.status) : task.status,
    // Handle both 'tags' and 'Tags' fields
    tags: task.tags || task.Tags || [],
  };
  
  console.log('[TududiClient] Normalized task:', {
    uid: normalized.uid,
    name: normalized.name,
    priority: normalized.priority,
    status: normalized.status,
    tags: normalized.tags,
  });
  
  return normalized;
}

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
    const url = `${this.baseUrl}/tasks${queryString ? `?${queryString}` : ''}`;
    
    console.log('[TududiClient] getTasks URL:', url);

    const response = await this.fetchWithRetry<any>(url);
    
    console.log('[TududiClient] getTasks response type:', typeof response, 'keys:', Object.keys(response || {}));
    
    // API returns { tasks: [...] } not bare array
    const tasksArray = response.tasks || response;
    
    console.log('[TududiClient] getTasks count:', Array.isArray(tasksArray) ? tasksArray.length : 'not an array');
    
    if (!Array.isArray(tasksArray)) {
      console.error('[TududiClient] getTasks expected array, got:', tasksArray);
      return [];
    }
    
    return tasksArray.map(normalizeTask);
  }

  async getTask(uid: string): Promise<TududiApiTask> {
    const url = `${this.baseUrl}/task/${uid}`;
    
    console.log('[TududiClient] getTask URL:', url);
    
    const response = await this.fetchWithRetry<any>(url);
    
    console.log('[TududiClient] getTask response:', response);
    
    return normalizeTask(response);
  }

  async updateTask(uid: string, updates: TaskUpdate): Promise<TududiApiTask> {
    const url = `${this.baseUrl}/task/${uid}`;
    
    console.log('[TududiClient] updateTask URL:', url, 'updates:', updates);
    
    const response = await this.fetchWithRetry<any>(url, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    
    console.log('[TududiClient] updateTask response:', response);
    
    return normalizeTask(response);
  }

  async getProjects(): Promise<TududiApiProject[]> {
    const url = `${this.baseUrl}/projects`;
    
    console.log('[TududiClient] getProjects URL:', url);
    
    const response = await this.fetchWithRetry<TududiApiProject[]>(url);
    
    console.log('[TududiClient] getProjects count:', response.length);
    
    return response;
  }

  async getTags(): Promise<TududiApiTag[]> {
    const url = `${this.baseUrl}/tags`;
    
    console.log('[TududiClient] getTags URL:', url);
    
    const response = await this.fetchWithRetry<TududiApiTag[]>(url);
    
    console.log('[TududiClient] getTags count:', response.length);
    
    return response;
  }
}
