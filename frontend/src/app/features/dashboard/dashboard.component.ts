import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import {
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  Priority,
  STATUS_LABELS,
  STATUS_OPTIONS,
  Task,
  TaskRequest,
  TaskStatus,
  TERMINAL_STATUSES,
} from '../../core/models/task.model';
import { TaskFormComponent } from './task-form.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgClass, RouterLink, TaskFormComponent],
  template: `
    <main class="container page">
      <section class="page-head">
        <div>
          <h1>Your tasks</h1>
          <p class="count">
            {{ totalElements() }}
            {{ totalElements() === 1 ? 'task' : 'tasks' }}
            @if (isFiltered()) { <span>· filtered</span> }
          </p>
        </div>
        <button type="button" class="btn btn-primary" (click)="openCreate()">
          + New task
        </button>
      </section>

      <section class="toolbar card">
        <input
          class="input search"
          type="search"
          placeholder="Search by title or description…"
          [value]="search()"
          (input)="onSearchInput($any($event.target).value)"
        />
        <div class="filters">
          <select
            class="select"
            [value]="statusFilter()"
            (change)="onStatusChange($any($event.target).value)"
          >
            <option value="">All statuses</option>
            @for (s of statuses; track s) {
              <option [value]="s">{{ statusLabel(s) }}</option>
            }
          </select>

          <select
            class="select"
            [value]="priorityFilter()"
            (change)="onPriorityChange($any($event.target).value)"
          >
            <option value="">All priorities</option>
            @for (p of priorities; track p) {
              <option [value]="p">{{ priorityLabel(p) }}</option>
            }
          </select>

          <select
            class="select"
            [value]="sortValue()"
            (change)="onSortChange($any($event.target).value)"
          >
            <option value="createdAt-desc">Newest first</option>
            <option value="createdAt-asc">Oldest first</option>
            <option value="dueDate-asc">Due date: soonest</option>
            <option value="dueDate-desc">Due date: latest</option>
            <option value="title-asc">Title: A–Z</option>
          </select>

          @if (isFiltered()) {
            <button type="button" class="btn btn-ghost" (click)="clearFilters()">
              Clear
            </button>
          }
        </div>
      </section>

      @if (error()) {
        <div class="alert" role="alert">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="state">Loading your tasks…</div>
      } @else if (!hasTasks()) {
        <div class="state empty card">
          @if (isFiltered()) {
            <h3>No matching tasks</h3>
            <p>Nothing fits these filters. Try a broader search.</p>
            <button type="button" class="btn btn-ghost" (click)="clearFilters()">
              Clear filters
            </button>
          } @else {
            <h3>Nothing here yet</h3>
            <p>Create your first task and it'll show up right here.</p>
            <button type="button" class="btn btn-primary" (click)="openCreate()">
              + New task
            </button>
          }
        </div>
      } @else {
        <section class="grid">
          @for (task of tasks(); track task.id) {
            <article class="task card" [ngClass]="spineClass(task.priority)">
              <div class="task-top">
                <span class="badge" [ngClass]="priorityBadgeClass(task.priority)">
                  <span class="dot"></span>{{ priorityLabel(task.priority) }}
                </span>
                <span class="badge" [ngClass]="statusBadgeClass(task.status)">
                  {{ statusLabel(task.status) }}
                </span>
              </div>

              <h3 class="task-title">
                <a [routerLink]="['/tasks', task.id]">{{ task.title }}</a>
              </h3>

              @if (task.description) {
                <p class="task-desc">{{ task.description }}</p>
              }

              <div class="task-foot">
                <span class="due" [class.overdue]="isOverdue(task)">
                  @if (task.dueDate) {
                    {{ isOverdue(task) ? 'Overdue · ' : 'Due ' }}{{ formatDate(task.dueDate) }}
                  } @else {
                    No due date
                  }
                </span>
                <div class="actions">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="openEdit(task)">
                    Edit
                  </button>
                  <button type="button" class="btn btn-danger btn-sm" (click)="deleteTask(task)">
                    Delete
                  </button>
                </div>
              </div>
            </article>
          }
        </section>

        @if (totalPages() > 1) {
          <nav class="pager">
            <button
              type="button"
              class="btn btn-ghost"
              (click)="prev()"
              [disabled]="page() === 0"
            >
              Previous
            </button>
            <span class="pager-info">
              Page {{ page() + 1 }} of {{ totalPages() }}
            </span>
            <button
              type="button"
              class="btn btn-ghost"
              (click)="next()"
              [disabled]="page() >= totalPages() - 1"
            >
              Next
            </button>
          </nav>
        }
      }

      @if (showForm()) {
        <app-task-form
          [task]="editingTask()"
          (saved)="onSaved($event)"
          (cancelled)="closeForm()"
        />
      }
    </main>
  `,
  styles: [
    `
      .page {
        padding-top: 2rem;
        padding-bottom: 4rem;
      }

      .page-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.4rem;
      }

      .page-head h1 {
        font-size: 1.7rem;
      }

      .count {
        color: var(--muted);
        margin: 0.3rem 0 0;
        font-size: 0.9rem;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding: 0.85rem;
        margin-bottom: 1.4rem;
      }

      .search {
        flex: 1 1 240px;
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }

      .filters .select {
        width: auto;
        min-width: 150px;
      }

      .alert {
        background: var(--high-tint);
        color: var(--high);
        border: 1px solid var(--high);
        border-radius: var(--radius-sm);
        padding: 0.75rem 0.9rem;
        font-size: 0.88rem;
        margin-bottom: 1.2rem;
      }

      .state {
        text-align: center;
        color: var(--muted);
        padding: 3rem 1rem;
        font-size: 0.95rem;
      }

      .empty {
        padding: 3.5rem 1.5rem;
      }

      .empty h3 {
        font-size: 1.2rem;
        margin-bottom: 0.5rem;
      }

      .empty p {
        color: var(--muted);
        margin: 0 0 1.3rem;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1rem;
      }

      /* Task card + priority spine (the signature) */
      .task {
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
        padding: 1.05rem 1.15rem;
        border-left-width: 4px;
        border-left-style: solid;
        border-left-color: var(--border);
        transition: box-shadow 0.15s ease, transform 0.1s ease;
      }

      .task:hover {
        box-shadow: var(--shadow);
        transform: translateY(-2px);
      }

      .spine-low { border-left-color: var(--low); }
      .spine-med { border-left-color: var(--med); }
      .spine-high { border-left-color: var(--high); }
      .spine-urgent { border-left-color: var(--urgent); border-left-width: 5px; }

      .task-top {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .task-title {
        font-size: 1.05rem;
        line-height: 1.35;
      }

      .task-title a {
        color: inherit;
        text-decoration: none;
      }

      .task-title a:hover {
        text-decoration: underline;
      }

      .task-desc {
        color: var(--ink-2);
        font-size: 0.88rem;
        line-height: 1.5;
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .task-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-top: auto;
        padding-top: 0.4rem;
      }

      .due {
        font-size: 0.8rem;
        color: var(--muted);
      }

      .due.overdue {
        color: var(--high);
        font-weight: 600;
      }

      .actions {
        display: flex;
        gap: 0.35rem;
      }

      .btn-sm {
        padding: 0.4rem 0.6rem;
        font-size: 0.8rem;
      }

      .pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        margin-top: 2rem;
      }

      .pager-info {
        font-size: 0.88rem;
        color: var(--muted);
      }

      @media (max-width: 560px) {
        .page-head {
          flex-direction: column;
          align-items: stretch;
        }
        .filters .select {
          flex: 1 1 auto;
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly taskService = inject(TaskService);

  readonly priorities = PRIORITY_OPTIONS;
  readonly statuses = STATUS_OPTIONS;

  private readonly pageSize = 9;

  readonly tasks = signal<Task[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly page = signal(0);

  readonly search = signal('');
  readonly statusFilter = signal<TaskStatus | ''>('');
  readonly priorityFilter = signal<Priority | ''>('');
  readonly sortValue = signal('createdAt-desc');

  readonly showForm = signal(false);
  readonly editingTask = signal<Task | null>(null);

  readonly hasTasks = computed(() => this.tasks().length > 0);
  readonly isFiltered = computed(
    () => !!this.search() || !!this.statusFilter() || !!this.priorityFilter()
  );

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    const [sortBy, direction] = this.sortValue().split('-');

    this.taskService
      .list({
        search: this.search(),
        status: this.statusFilter(),
        priority: this.priorityFilter(),
        page: this.page(),
        size: this.pageSize,
        sortBy,
        direction: direction as 'asc' | 'desc',
      })
      .subscribe({
        next: (result) => {
          this.tasks.set(result.content);
          this.totalElements.set(result.totalElements);
          this.totalPages.set(result.totalPages);
          this.loading.set(false);
        },
        error: (err: Error) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.page.set(0);
      this.load();
    }, 300);
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value as TaskStatus | '');
    this.page.set(0);
    this.load();
  }

  onPriorityChange(value: string): void {
    this.priorityFilter.set(value as Priority | '');
    this.page.set(0);
    this.load();
  }

  onSortChange(value: string): void {
    this.sortValue.set(value);
    this.page.set(0);
    this.load();
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('');
    this.priorityFilter.set('');
    this.sortValue.set('createdAt-desc');
    this.page.set(0);
    this.load();
  }

  prev(): void {
    if (this.page() > 0) {
      this.page.set(this.page() - 1);
      this.load();
    }
  }

  next(): void {
    if (this.page() < this.totalPages() - 1) {
      this.page.set(this.page() + 1);
      this.load();
    }
  }

  openCreate(): void {
    this.editingTask.set(null);
    this.showForm.set(true);
  }

  openEdit(task: Task): void {
    this.editingTask.set(task);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingTask.set(null);
  }

  onSaved(payload: TaskRequest): void {
    const editing = this.editingTask();
    const request$ = editing
      ? this.taskService.update(editing.id, payload)
      : this.taskService.create(payload);

    request$.subscribe({
      next: () => {
        this.closeForm();
        this.load();
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.closeForm();
      },
    });
  }

  deleteTask(task: Task): void {
    const confirmed = confirm(`Delete "${task.title}"? This can't be undone.`);
    if (!confirmed) {
      return;
    }

    this.taskService.delete(task.id).subscribe({
      next: () => {
        // If we just removed the last item on a non-first page, step back.
        if (this.tasks().length === 1 && this.page() > 0) {
          this.page.set(this.page() - 1);
        }
        this.load();
      },
      error: (err: Error) => {
        this.error.set(err.message);
      },
    });
  }

  // ---- display helpers ----

  priorityLabel(p: Priority): string {
    return PRIORITY_LABELS[p];
  }

  statusLabel(s: TaskStatus): string {
    return STATUS_LABELS[s];
  }

  spineClass(p: Priority): string {
    return {
      LOW: 'spine-low',
      MEDIUM: 'spine-med',
      HIGH: 'spine-high',
      URGENT: 'spine-urgent',
    }[p];
  }

  priorityBadgeClass(p: Priority): string {
    return {
      LOW: 'badge-low',
      MEDIUM: 'badge-med',
      HIGH: 'badge-high',
      URGENT: 'badge-urgent',
    }[p];
  }

  statusBadgeClass(s: TaskStatus): string {
    return {
      TODO: 'badge-todo',
      IN_PROGRESS: 'badge-progress',
      REVIEW: 'badge-review',
      COMPLETED: 'badge-done',
      CANCELLED: 'badge-cancelled',
    }[s];
  }

  formatDate(iso: string): string {
    const date = new Date(`${iso}T00:00:00`);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  isOverdue(task: Task): boolean {
    if (!task.dueDate || TERMINAL_STATUSES.includes(task.status)) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${task.dueDate}T00:00:00`);
    return due.getTime() < today.getTime();
  }
}
