export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export type RecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  startDate: string | null;
  dueDate: string | null; // ISO date, e.g. "2026-07-15"
  estimatedMinutes: number | null;
  actualMinutes: number;
  recurrence: RecurrenceType;
  recurrenceEndDate: string | null;
  projectId: number | null;
  projectName: string | null;
  ownerId: number;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

/** Payload sent when creating or updating a task. */
export interface TaskRequest {
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  startDate?: string | null;
  dueDate: string | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  recurrence?: RecurrenceType;
  recurrenceEndDate?: string | null;
  projectId: number | null;
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

export const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const STATUS_OPTIONS: TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'COMPLETED',
  'CANCELLED',
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  REVIEW: 'In review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const RECURRENCE_OPTIONS: RecurrenceType[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'];

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  NONE: 'Does not repeat',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

/** Terminal statuses — a task in these states needs no further work. */
export const TERMINAL_STATUSES: readonly TaskStatus[] = ['COMPLETED', 'CANCELLED'];

// ---- Task detail sub-resources ----

export interface TaskCollaborator {
  userId: number;
  name: string;
  email: string;
  addedAt: string;
}

export interface Subtask {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface TaskDependencyEntry {
  taskId: number;
  title: string;
  status: TaskStatus;
}

export interface TaskDependencies {
  blockedBy: TaskDependencyEntry[];
  blocks: TaskDependencyEntry[];
}

export interface TaskComment {
  id: number;
  taskId: number;
  authorId: number;
  authorName: string;
  content: string;
  mentionedUserIds: number[];
  createdAt: string;
  updatedAt: string | null;
}

export interface TaskAttachment {
  id: number;
  taskId: number;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  sizeBytes: number;
  uploadedById: number;
  uploadedByName: string;
  createdAt: string;
}

export interface TaskHistoryEntry {
  id: number;
  summary: string;
  actorId: number;
  actorName: string;
  createdAt: string;
}

export interface TagRef {
  id: number;
  workspaceId: number;
  name: string;
  color: string | null;
}
