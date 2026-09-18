import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiClientError } from '../../core/models/api-error';
import {
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  Priority,
  STATUS_LABELS,
  STATUS_OPTIONS,
  Task,
  TaskNode,
  TaskQuery,
  TaskRequest,
  TaskStatus,
} from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';
import { ToastService } from '../../core/services/toast.service';
import { NEW_ITEM_SHORTCUT } from '../../shared/shell/app-shell.component';
import { TaskCardGridComponent } from '../../shared/task-cards/task-card-grid.component';
import { TaskStatusGroupsComponent } from '../../shared/task-status-list/task-status-groups.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { TaskFormComponent } from '../dashboard/task-form.component';

type ViewMode = 'list' | 'cards';

/** Remembered across visits so the user doesn't have to re-pick their view every time. */
const VIEW_MODE_KEY = 'taskflow.tasks.viewMode';

/** Sort presets, so the control offers meaningful pairs rather than raw fields. */
const SORT_PRESETS = [
  { value: 'position-asc', label: 'Manual order' },
  { value: 'createdAt-desc', label: 'Newest first' },
  { value: 'createdAt-asc', label: 'Oldest first' },
  { value: 'dueDate-asc', label: 'Due soonest' },
  { value: 'dueDate-desc', label: 'Due latest' },
  { value: 'progress-desc', label: 'Most complete' },
  { value: 'progress-asc', label: 'Least complete' },
  { value: 'weight-desc', label: 'Heaviest first' },
  { value: 'title-asc', label: 'Title A–Z' },
] as const;

const DEBOUNCE_MS = 300;

@Component({
  selector: 'app-tasks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TaskStatusGroupsComponent,
    TaskCardGridComponent,
    TaskFormComponent,
    PaginationComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <h1>Tasks</h1>
          <p class="sub">
            {{ totalElements() }} top-level
            {{ totalElements() === 1 ? 'task' : 'tasks' }}
            @if (isFiltered()) {
              <span>· filtered</span>
            }
          </p>
        </div>
        <div class="head-actions">
          <div class="view-toggle" role="group" aria-label="View">
            <button
              type="button"
              class="view-btn"
              [class.active]="viewMode() === 'list'"
              (click)="setViewMode('list')"
            >
              ☰ List
            </button>
            <button
              type="button"
              class="view-btn"
              [class.active]="viewMode() === 'cards'"
              (click)="setViewMode('cards')"
            >
              ▦ Cards
            </button>
          </div>

          <button type="button" class="btn btn-primary" (click)="openCreate()">
            New task
            <kbd class="kbd">n</kbd>
          </button>
        </div>
      </header>

      <!-- Search + filters + sort. All three are applied server-side by the same
           query that pages, so they always agree with each other. -->
      <section class="toolbar card">
        <input
          class="input search"
          type="search"
          data-shortcut="search"
          placeholder="Search titles and descriptions…   /"
          [value]="search()"
          (input)="onSearchInput($any($event.target).value)"
        />

        <div class="filters">
          <select
            class="select"
            aria-label="Filter by status"
            [value]="statusFilter()"
            (change)="setStatus($any($event.target).value)"
          >
            <option value="">All statuses</option>
            @for (s of statuses; track s) {
              <option [value]="s">{{ statusLabel(s) }}</option>
            }
          </select>

          <select
            class="select"
            aria-label="Filter by priority"
            [value]="priorityFilter()"
            (change)="setPriority($any($event.target).value)"
          >
            <option value="">All priorities</option>
            @for (p of priorities; track p) {
              <option [value]="p">{{ priorityLabel(p) }}</option>
            }
          </select>

          <select
            class="select"
            aria-label="Sort order"
            [value]="sortValue()"
            (change)="setSort($any($event.target).value)"
          >
            @for (preset of sortPresets; track preset.value) {
              <option [value]="preset.value">{{ preset.label }}</option>
            }
          </select>

          <label class="toggle">
            <input
              type="checkbox"
              [checked]="overdueOnly()"
              (change)="setOverdueOnly($any($event.target).checked)"
            />
            Overdue only
          </label>

          @if (isFiltered()) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="clearFilters()">
              Clear
            </button>
          }
        </div>
      </section>

      @if (error()) {
        <div class="alert alert-error" role="alert">{{ error() }}</div>
      }

      <section class="card list" [class.cards-mode]="viewMode() === 'cards'">
        @if (loading() && nodes().length === 0) {
          <div class="list-body">
            <app-skeleton
              [variant]="viewMode() === 'cards' ? 'card' : 'row'"
              [repeat]="viewMode() === 'cards' ? 4 : 8"
              ariaLabel="Loading tasks"
            />
          </div>
        } @else if (nodes().length === 0) {
          @if (isFiltered()) {
            <app-empty-state
              glyph="⌕"
              title="No matching tasks"
              message="Nothing fits these filters. Try a broader search."
              actionLabel="Clear filters"
              (action)="clearFilters()"
            />
          } @else {
            <app-empty-state
              glyph="✎"
              title="No tasks yet"
              message="Create a task, then nest subtasks under it to any depth. Progress rolls up automatically from each subtask's weight."
              actionLabel="Create your first task"
              (action)="openCreate()"
            />
          }
        } @else if (viewMode() === 'cards') {
          <div class="list-body cards" [class.stale]="loading()">
            <app-task-card-grid
              [nodes]="nodes()"
              (changed)="reload()"
              (opened)="openTask($event)"
              (edit)="openEdit($event)"
            />
          </div>
        } @else {
          <div class="list-body" [class.stale]="loading()">
            <app-task-status-groups
              [nodes]="nodes()"
              (changed)="reload()"
              (opened)="openTask($event)"
              (edit)="openEdit($event)"
              (addToStatus)="openCreateWithStatus($event)"
            />
          </div>
        }

        @if (totalPages() > 0) {
          <app-pagination
            label="task"
            labelPlural="tasks"
            [page]="page()"
            [size]="size()"
            [totalElements]="totalElements()"
            [totalPages]="totalPages()"
            [loading]="loading()"
            (pageChange)="goToPage($event)"
            (sizeChange)="setSize($event)"
          />
        }
      </section>

      @if (viewMode() === 'list') {
        <p class="hint">
          Click a task's status to move it between groups. Expand a row's chevron
          to see its own subtasks, nested directly beneath it.
        </p>
      } @else {
        <p class="hint">
          Each card shows its direct subtasks inline — check them off, add more, or
          switch to List view to see everything grouped by status.
        </p>
      }
    </div>

    @if (showForm()) {
      <app-task-form
        [task]="editingTask()"
        [presetStatus]="createPresetStatus()"
        (saved)="onSaved($event)"
        (cancelled)="closeForm()"
      />
    }
  `,
  styles: [
    `
      .page {
        max-width: 1280px;
        margin: 0 auto;
        padding: 1.5rem 1.25rem 3rem;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }

      .page-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .page-head h1 {
        font-size: 1.4rem;
      }

      .sub {
        margin: 0.25rem 0 0;
        font-size: 0.85rem;
        color: var(--muted);
      }

      .head-actions {
        display: flex;
        gap: 0.45rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .view-toggle {
        display: inline-flex;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        overflow: hidden;
        margin-right: 0.2rem;
      }

      .view-btn {
        background: var(--surface);
        border: none;
        padding: 0.45rem 0.7rem;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--ink-2);
        cursor: pointer;
      }

      .view-btn + .view-btn {
        border-left: 1px solid var(--border-strong);
      }

      .view-btn:hover {
        background: var(--surface-2);
      }

      .view-btn.active {
        background: var(--brand);
        color: var(--brand-ink);
      }

      .btn-sm {
        padding: 0.45rem 0.7rem;
        font-size: 0.82rem;
      }

      .kbd {
        font-family: var(--font-body);
        font-size: 0.68rem;
        font-weight: 700;
        padding: 0.05rem 0.3rem;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.22);
        border: 1px solid rgba(255, 255, 255, 0.3);
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        padding: 0.7rem;
      }

      .search {
        flex: 1 1 260px;
        min-width: 0;
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }

      .filters .select {
        width: auto;
        min-width: 140px;
      }

      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.82rem;
        color: var(--ink-2);
        white-space: nowrap;
      }

      .toggle input {
        width: 15px;
        height: 15px;
        accent-color: var(--brand);
      }

      .list {
        display: flex;
        flex-direction: column;
        padding: 0 0.5rem 0.35rem;
        overflow: hidden;
      }

      /* Cards need room for the hover lift and the three-dot dropdown, both of
         which the row list's clipped container would cut off. */
      .list.cards-mode {
        overflow: visible;
        padding: 0.6rem;
      }

      .list-body {
        padding: 0.35rem 0;
        transition: opacity 0.15s ease;
      }

      .list-body.cards {
        padding: 0.35rem;
      }

      /* Keep the previous page visible but dimmed while the next one loads —
         far less jarring than collapsing to a spinner. */
      .list-body.stale {
        opacity: 0.55;
        pointer-events: none;
      }

      .hint {
        margin: 0;
        font-size: 0.76rem;
        color: var(--faint);
        line-height: 1.5;
      }


      @media (max-width: 620px) {
        .page {
          padding: 1.1rem 0.75rem 2.5rem;
        }
        .head-actions {
          width: 100%;
        }
        .head-actions .btn-primary {
          flex: 1 1 100%;
          order: -1;
        }
        .filters {
          width: 100%;
        }
        .filters .select {
          flex: 1 1 45%;
          min-width: 0;
        }
      }
    `,
  ],
})
export class TasksComponent implements OnInit, OnDestroy {
  private readonly taskService = inject(TaskService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly priorities = PRIORITY_OPTIONS;
  readonly statuses = STATUS_OPTIONS;
  readonly sortPresets = SORT_PRESETS;

  readonly nodes = signal<TaskNode[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly page = signal(0);
  readonly size = signal(25);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);

  readonly search = signal('');
  readonly statusFilter = signal<TaskStatus | ''>('');
  readonly priorityFilter = signal<Priority | ''>('');
  readonly overdueOnly = signal(false);
  readonly sortValue = signal<string>('position-asc');

  readonly showForm = signal(false);
  readonly editingTask = signal<Task | null>(null);
  /** Set by "+ Add" inside a status group, so the create form opens with that status pre-selected. */
  readonly createPresetStatus = signal<TaskStatus | null>(null);

  readonly viewMode = signal<ViewMode>(this.loadViewMode());

  readonly isFiltered = computed(
    () =>
      !!this.search() ||
      !!this.statusFilter() ||
      !!this.priorityFilter() ||
      this.overdueOnly()
  );

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.applyQueryParams();
    this.load();
    document.addEventListener(NEW_ITEM_SHORTCUT, this.onNewItemShortcut);
  }

  ngOnDestroy(): void {
    document.removeEventListener(NEW_ITEM_SHORTCUT, this.onNewItemShortcut);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  private readonly onNewItemShortcut = () => this.openCreate();

  /**
   * Lets the dashboard's KPI tiles deep-link into a pre-filtered list. Values are
   * validated against the known options rather than trusted, so a hand-edited URL
   * can't push a bogus filter into the query.
   */
  private applyQueryParams(): void {
    const params = this.route.snapshot.queryParamMap;

    const status = params.get('status');
    if (status && (STATUS_OPTIONS as readonly string[]).includes(status)) {
      this.statusFilter.set(status as TaskStatus);
    }

    const priority = params.get('priority');
    if (priority && (PRIORITY_OPTIONS as readonly string[]).includes(priority)) {
      this.priorityFilter.set(priority as Priority);
    }

    if (params.get('overdueOnly') === 'true') {
      this.overdueOnly.set(true);
    }
  }

  // ---- loading ----

  private query(): TaskQuery {
    const [sortBy, direction] = this.sortValue().split('-');
    return {
      search: this.search(),
      status: this.statusFilter(),
      priority: this.priorityFilter(),
      overdueOnly: this.overdueOnly(),
      page: this.page(),
      size: this.size(),
      sortBy,
      direction: direction as 'asc' | 'desc',
    };
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.taskService.tree(this.query()).subscribe({
      next: (result) => {
        this.nodes.set(result.content);
        this.totalElements.set(result.totalElements);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);

        // Deleting the last row on a page would otherwise leave the user
        // stranded on an empty page.
        if (result.content.length === 0 && this.page() > 0) {
          this.page.set(Math.max(0, result.totalPages - 1));
          this.load();
        }
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  /** Re-fetch after a mutation, keeping the current page, filters, and (since the
   *  status-groups component instance stays mounted across a reload) expanded/
   *  collapsed group state. */
  reload(): void {
    this.load();
  }

  // ---- filters ----

  onSearchInput(value: string): void {
    this.search.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    // Debounced so typing a word is one request, not one per keystroke.
    this.searchTimer = setTimeout(() => this.resetAndLoad(), DEBOUNCE_MS);
  }

  setStatus(value: string): void {
    this.statusFilter.set(value as TaskStatus | '');
    this.resetAndLoad();
  }

  setPriority(value: string): void {
    this.priorityFilter.set(value as Priority | '');
    this.resetAndLoad();
  }

  setOverdueOnly(value: boolean): void {
    this.overdueOnly.set(value);
    this.resetAndLoad();
  }

  setSort(value: string): void {
    this.sortValue.set(value);
    this.resetAndLoad();
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('');
    this.priorityFilter.set('');
    this.overdueOnly.set(false);
    this.sortValue.set('position-asc');
    this.resetAndLoad();
  }

  /** Any filter change invalidates the current page number. */
  private resetAndLoad(): void {
    this.page.set(0);
    this.load();
  }

  // ---- pagination ----

  goToPage(page: number): void {
    const clamped = Math.max(0, Math.min(page, Math.max(0, this.totalPages() - 1)));
    if (clamped !== this.page()) {
      this.page.set(clamped);
      this.load();
    }
  }

  setSize(size: number): void {
    this.size.set(size);
    this.resetAndLoad();
  }

  // ---- view mode ----

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // Private browsing / storage disabled — the toggle still works for this visit.
    }
    // Both views page the same TaskNode[] the same way now, so the already-loaded
    // page is reused as-is — no refetch needed just to switch how it's rendered.
  }

  private loadViewMode(): ViewMode {
    try {
      return localStorage.getItem(VIEW_MODE_KEY) === 'cards' ? 'cards' : 'list';
    } catch {
      return 'list';
    }
  }

  // ---- create / edit / navigate ----

  openCreate(): void {
    this.editingTask.set(null);
    this.createPresetStatus.set(null);
    this.showForm.set(true);
  }

  /** "+ Add" / "+ Add Task" inside a status group — same form, status pre-selected. */
  openCreateWithStatus(status: TaskStatus): void {
    this.editingTask.set(null);
    this.createPresetStatus.set(status);
    this.showForm.set(true);
  }

  /** The card grid only has a {@link TaskNode}; the edit form needs the full {@link Task}. */
  openEdit(node: TaskNode): void {
    this.taskService.get(node.id).subscribe({
      next: (task) => {
        this.editingTask.set(task);
        this.showForm.set(true);
      },
      error: (err: ApiClientError) => this.toast.error(err.message),
    });
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingTask.set(null);
    this.createPresetStatus.set(null);
  }

  onSaved(payload: TaskRequest): void {
    const editing = this.editingTask();
    const request$ = editing
      ? this.taskService.update(editing.id, payload)
      : this.taskService.create(payload);

    request$.subscribe({
      next: (task) => {
        this.closeForm();
        this.toast.success(editing ? `Saved "${task.title}".` : `Created "${task.title}".`);
        this.reload();
      },
      error: (err: ApiClientError) => {
        this.closeForm();
        this.toast.error(err.message);
      },
    });
  }

  openTask(node: TaskNode): void {
    void this.router.navigate(['/tasks', node.id]);
  }

  // ---- labels ----

  statusLabel(s: TaskStatus): string {
    return STATUS_LABELS[s];
  }

  priorityLabel(p: Priority): string {
    return PRIORITY_LABELS[p];
  }
}
