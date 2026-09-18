import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateChildTaskRequest,
  DashboardSummary,
  MoveTaskRequest,
  Page,
  Task,
  TaskHistoryEntry,
  TaskNode,
  TaskQuery,
  TaskRequest,
  TaskStats,
  TaskStatus,
} from '../models/task.model';

/** How long a cached dashboard payload stays fresh, in milliseconds. */
const DASHBOARD_TTL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/tasks`;

  /**
   * Short-lived dashboard cache. Navigating away and back within the TTL — a
   * very common pattern — then costs no request at all. Any mutation clears it,
   * so it can never serve stale numbers after an edit.
   */
  private dashboardCache: { at: number; value: DashboardSummary } | null = null;

  // ---- list / paging ----

  list(query: TaskQuery): Observable<Page<Task>> {
    return this.http.get<Page<Task>>(this.baseUrl, { params: this.toParams(query) });
  }

  /** Paged root tasks, each with its full subtree nested inside. */
  tree(query: TaskQuery): Observable<Page<TaskNode>> {
    const params = this.toParams({
      ...query,
      sortBy: query.sortBy ?? 'position',
      direction: query.direction ?? 'asc',
    });
    return this.http.get<Page<TaskNode>>(`${this.baseUrl}/tree`, { params });
  }

  get(id: number): Observable<Task> {
    return this.http.get<Task>(`${this.baseUrl}/${id}`);
  }

  // ---- dashboard ----

  stats(): Observable<TaskStats> {
    return this.http.get<TaskStats>(`${this.baseUrl}/stats`);
  }

  /**
   * The whole dashboard in one request. Pass `force` after a mutation, or just
   * rely on {@link invalidateDashboard} being called by the write methods below.
   */
  dashboard(force = false): Observable<DashboardSummary> {
    const cached = this.dashboardCache;
    if (!force && cached && Date.now() - cached.at < DASHBOARD_TTL_MS) {
      return of(cached.value);
    }
    return this.http
      .get<DashboardSummary>(`${this.baseUrl}/dashboard`)
      .pipe(tap((value) => (this.dashboardCache = { at: Date.now(), value })));
  }

  invalidateDashboard(): void {
    this.dashboardCache = null;
  }

  // ---- mutations ----

  create(payload: TaskRequest): Observable<Task> {
    return this.http.post<Task>(this.baseUrl, payload).pipe(tap(() => this.invalidateDashboard()));
  }

  update(id: number, payload: TaskRequest): Observable<Task> {
    return this.http
      .put<Task>(`${this.baseUrl}/${id}`, payload)
      .pipe(tap(() => this.invalidateDashboard()));
  }

  /**
   * Changes only the status. Preferred over {@link update} for a completion
   * toggle: a full-replace PUT would need every field echoed back and would wipe
   * any the caller doesn't happen to hold (time estimates, recurrence, …).
   */
  setStatus(id: number, status: TaskStatus): Observable<Task> {
    return this.http
      .patch<Task>(`${this.baseUrl}/${id}/status`, { status })
      .pipe(tap(() => this.invalidateDashboard()));
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(tap(() => this.invalidateDashboard()));
  }

  // ---- tree operations ----

  /** Direct children only — for lazily expanding a large tree. */
  children(id: number): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/${id}/children`);
  }

  /** One task with every descendant nested. */
  subtree(id: number): Observable<TaskNode> {
    return this.http.get<TaskNode>(`${this.baseUrl}/${id}/tree`);
  }

  /** Adds a subtask under any task, at any depth. */
  addChild(parentId: number, payload: CreateChildTaskRequest): Observable<Task> {
    return this.http
      .post<Task>(`${this.baseUrl}/${parentId}/children`, payload)
      .pipe(tap(() => this.invalidateDashboard()));
  }

  /** Re-parent and/or reorder — the drag & drop call. */
  move(id: number, payload: MoveTaskRequest): Observable<Task> {
    return this.http
      .patch<Task>(`${this.baseUrl}/${id}/move`, payload)
      .pipe(tap(() => this.invalidateDashboard()));
  }

  /** Changes a task's weight; rejected server-side if siblings would overflow. */
  setWeight(id: number, weight: number): Observable<Task> {
    return this.http
      .patch<Task>(`${this.baseUrl}/${id}/weight`, { weight })
      .pipe(tap(() => this.invalidateDashboard()));
  }

  history(id: number, page = 0, size = 20): Observable<Page<TaskHistoryEntry>> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<Page<TaskHistoryEntry>>(`${this.baseUrl}/${id}/history`, { params });
  }

  // ---- helpers ----

  /**
   * Builds the query string, omitting empty filters so the backend applies its
   * own defaults rather than receiving blank values.
   */
  private toParams(query: TaskQuery): HttpParams {
    let params = new HttpParams();

    if (query.search) {
      params = params.set('search', query.search);
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.priority) {
      params = params.set('priority', query.priority);
    }
    if (query.projectId != null) {
      params = params.set('projectId', String(query.projectId));
    }
    if (query.parentId != null) {
      params = params.set('parentId', String(query.parentId));
    }
    if (query.rootsOnly) {
      params = params.set('rootsOnly', 'true');
    }
    if (query.dueFrom) {
      params = params.set('dueFrom', query.dueFrom);
    }
    if (query.dueTo) {
      params = params.set('dueTo', query.dueTo);
    }
    if (query.overdueOnly) {
      params = params.set('overdueOnly', 'true');
    }

    return params
      .set('page', String(query.page ?? 0))
      .set('size', String(query.size ?? 10))
      .set('sortBy', query.sortBy ?? 'createdAt')
      .set('direction', query.direction ?? 'desc');
  }
}
