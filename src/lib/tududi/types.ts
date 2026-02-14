/**
 * Tududi API type definitions
 */

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'done'
  | 'archived'
  | 'waiting'
  | 'cancelled'
  | 'planned';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface TududiApiTag {
  name: string;
}

export interface TududiApiTask {
  uid: string;
  name: string;
  note?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string; // ISO 8601 date string
  project_id?: string;
  tags: TududiApiTag[];
}

export interface TududiApiProject {
  uid: string;
  name: string;
  description?: string;
}

export interface TaskFilters {
  type?: string;
  status?: TaskStatus;
  project_id?: string;
}

export interface TaskUpdate {
  name?: string;
  note?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  project_id?: string;
  tags?: TududiApiTag[];
}
