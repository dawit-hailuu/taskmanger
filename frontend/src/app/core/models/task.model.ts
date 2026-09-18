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
  /** Parent task, or null for a top-level task. */
  parentId: number | null;
  /** This task's share of its parent's effort. */
  weight: number;
  /** Weighted completion 0..100 — derived from weights, never from a count. */
  progress: number;
  /** Distance from the root; drives indentation in the tree view. */
  depth: number;
  /** Ordering among siblings. */
  position: number;
  /** Direct children, or null when the server wasn't asked to count them. */
  childCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One node of the task tree. Recursive by construction, which is what allows
 * unlimited nesting — there is no fixed "subtask" level anywhere.
 */
export interface TaskNode {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  startDate: string | null;
  dueDate: string | null;
  parentId: number | null;
  weight: number;
  progress: number;
  depth: number;
  position: number;
  /** How much of this node's weight its children already claim. */
  allocatedChildWeight: number;
  /** How much is still free for a new child. */
  availableChildWeight: number;
  projectId: number | null;
  projectName: string | null;
  ownerId: number;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  children: TaskNode[];
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
  /** Nest the new task under this parent. Omit for a top-level task. */
  parentId?: number | null;
  /** Omit to let the server allocate whatever the parent has left. */
  weight?: number | null;
}

/** Payload for adding a child at any depth in the tree. */
export interface CreateChildTaskRequest {
  title: string;
  description?: string | null;
  weight?: number | null;
  priority?: Priority | null;
  dueDate?: string | null;
}

/** Payload for drag & drop: re-parent and/or reorder. */
export interface MoveTaskRequest {
  parentId: number | null;
  position?: number | null;
}

/** Query options for listing tasks. Combines with pagination server-side. */
export interface TaskQuery {
  search?: string;
  status?: TaskStatus | '';
  priority?: Priority | '';
  projectId?: number | null;
  parentId?: number | null;
  /** Only top-level tasks — the default for the board and tree views. */
  rootsOnly?: boolean;
  dueFrom?: string | null;
  dueTo?: string | null;
  overdueOnly?: boolean;
  page?: number;
  size?: number;
  sortBy?: string;
  direction?: 'asc' | 'desc';
}

/** Headline dashboard numbers, all computed server-side. */
export interface TaskStats {
  total: number;
  rootTotal: number;
  byStatus: Record<TaskStatus, number>;
  openByPriority: Record<Priority, number>;
  open: number;
  completed: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  completionRate: number;
  averageProgress: number;
}

export interface CompletionPoint {
  date: string;
  completed: number;
}

export interface ActivityEntry {
  id: number;
  taskId: number;
  taskTitle: string;
  summary: string;
  actorName: string;
  createdAt: string;
}

/** The whole dashboard in one payload — one request instead of a dozen. */
export interface DashboardSummary {
  stats: TaskStats;
  dueToday: Task[];
  upcoming: Task[];
  overdue: Task[];
  recent: Task[];
  completionTrend: CompletionPoint[];
  activity: ActivityEntry[];
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

/**
 * Legacy flat checklist item. Subtasks are now ordinary child tasks (see
 * {@link TaskNode}); this shape is only what the older
 * `/tasks/{id}/subtasks` endpoints still return.
 */
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
