export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null; // ISO date, e.g. "2026-07-15"
  createdAt: string;
  updatedAt: string;
}

/** Payload sent when creating or updating a task. */
export interface TaskRequest {
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
}

/** Query options for listing tasks. */
export interface TaskQuery {
  search?: string;
  status?: TaskStatus | '';
  priority?: Priority | '';
  page?: number;
  size?: number;
  sortBy?: string;
  direction?: 'asc' | 'desc';
}

/** Matches the backend PageResponse envelope. */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];
export const STATUS_OPTIONS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};
