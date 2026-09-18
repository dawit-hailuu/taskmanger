import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClientError } from '../../core/models/api-error';
import {
  DashboardSummary,
  PRIORITY_LABELS,
  Priority,
  STATUS_LABELS,
  TaskRequest,
  TaskStatus,
} from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';
import { ToastService } from '../../core/services/toast.service';
import { NEW_ITEM_SHORTCUT } from '../../shared/shell/app-shell.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ProgressBarComponent } from '../../shared/ui/progress-bar.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { TaskFormComponent } from './task-form.component';

/** One tile in the KPI row. */
interface StatTile {
  key: string;
  label: string;
  value: number;
  hint: string;
  tone: 'neutral' | 'brand' | 'good' | 'warn' | 'bad';
  /** Optional route + query to drill into. */
  filter?: Record<string, string>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TaskFormComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ProgressBarComponent,
  ],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <h1>{{ greeting() }}</h1>
          <p class="sub">{{ today() }}</p>
        </div>
        <div class="head-actions">
          <a class="btn btn-ghost" routerLink="/tasks">Open task list</a>
          <button type="button" class="btn btn-primary" (click)="openCreate()">
            New task
            <kbd class="kbd">n</kbd>
          </button>
        </div>
      </header>

      @if (error()) {
        <div class="alert alert-error" role="alert">{{ error() }}</div>
      }

      <!-- KPI row: compact tiles, not oversized cards. -->
      <section class="stat-row" aria-label="Task statistics">
        @if (loading()) {
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <app-skeleton variant="stat" ariaLabel="Loading statistics" />
          }
        } @else {
          @for (tile of tiles(); track tile.key) {
            <button
              type="button"
              class="stat"
              [class]="'tone-' + tile.tone"
              (click)="drillInto(tile)"
            >
              <span class="stat-label">{{ tile.label }}</span>
              <span class="stat-value">{{ tile.value }}</span>
              <span class="stat-hint">{{ tile.hint }}</span>
            </button>
          }
        }
      </section>

      <div class="grid">
        <!-- Weighted progress + activity overview -->
        <section class="panel card span-2">
          <header class="panel-head">
            <h2>Progress overview</h2>
            <span class="panel-note">Weighted by task weight, not by count</span>
          </header>

          @if (loading()) {
            <div class="panel-body">
              <app-skeleton [lines]="4" />
            </div>
          } @else if (summary(); as data) {
            <div class="panel-body overview">
              <div class="overall">
                <div class="overall-figure">
                  <span class="overall-value">{{ data.stats.averageProgress }}%</span>
                  <span class="overall-label">average across top-level tasks</span>
                </div>
                <app-progress-bar [value]="data.stats.averageProgress" [showValue]="false" />
              </div>

              <ul class="status-bars">
                @for (row of statusBreakdown(); track row.status) {
                  <li>
                    <span class="status-name">
                      <span class="swatch" [class]="'sw-' + row.status.toLowerCase()"></span>
                      {{ statusLabel(row.status) }}
                    </span>
                    <span class="status-count">{{ row.count }}</span>
                    <span class="status-track">
                      <span
                        class="status-fill"
                        [class]="'sw-' + row.status.toLowerCase()"
                        [style.width.%]="row.share"
                      ></span>
                    </span>
                  </li>
                }
              </ul>

              <!-- 14-day completion sparkline. Bars, because the values are
                   discrete daily counts rather than a continuous series. -->
              <div class="trend">
                <div class="trend-head">
                  <span class="trend-title">Completed, last 14 days</span>
                  <span class="trend-total">{{ trendTotal() }} total</span>
                </div>
                <div class="spark" role="img" [attr.aria-label]="trendLabel()">
                  @for (point of data.completionTrend; track point.date) {
                    <span
                      class="spark-bar"
                      [style.height.%]="barHeight(point.completed)"
                      [title]="point.date + ': ' + point.completed"
                    ></span>
                  }
                </div>
              </div>
            </div>
          }
        </section>

        <!-- Due today -->
        <section class="panel card">
          <header class="panel-head">
            <h2>Due today</h2>
            @if (summary(); as data) {
              <span class="pill">{{ data.stats.dueToday }}</span>
            }
          </header>
          <div class="panel-body tight">
            @if (loading()) {
              <app-skeleton variant="row" [repeat]="3" />
            } @else if (summary()!.dueToday.length === 0) {
              <app-empty-state
                [compact]="true"
                glyph="✓"
                title="Nothing due today"
                message="Enjoy the clear runway."
              />
            } @else {
              @for (task of summary()!.dueToday; track task.id) {
                <a class="row" [routerLink]="['/tasks', task.id]">
                  <span class="row-title">{{ task.title }}</span>
                  <span class="badge" [class]="priorityBadgeClass(task.priority)">
                    {{ priorityLabel(task.priority) }}
                  </span>
                  <app-progress-bar class="row-meter" [value]="task.progress" [slim]="true" />
                </a>
              }
            }
          </div>
        </section>

        <!-- Overdue -->
        <section class="panel card">
          <header class="panel-head">
            <h2>Overdue</h2>
            @if (summary(); as data) {
              <span class="pill" [class.pill-bad]="data.stats.overdue > 0">
                {{ data.stats.overdue }}
              </span>
            }
          </header>
          <div class="panel-body tight">
            @if (loading()) {
              <app-skeleton variant="row" [repeat]="3" />
            } @else if (summary()!.overdue.length === 0) {
              <app-empty-state
                [compact]="true"
                glyph="◎"
                title="Nothing overdue"
                message="Every deadline is still ahead of you."
              />
            } @else {
              @for (task of summary()!.overdue; track task.id) {
                <a class="row" [routerLink]="['/tasks', task.id]">
                  <span class="row-title">{{ task.title }}</span>
                  <span class="row-date late">{{ formatDate(task.dueDate!) }}</span>
                </a>
              }
            }
          </div>
        </section>

        <!-- Upcoming -->
        <section class="panel card">
          <header class="panel-head">
            <h2>Upcoming deadlines</h2>
            <span class="panel-note">Next 7 days</span>
          </header>
          <div class="panel-body tight">
            @if (loading()) {
              <app-skeleton variant="row" [repeat]="3" />
            } @else if (summary()!.upcoming.length === 0) {
              <app-empty-state
                [compact]="true"
                glyph="◇"
                title="No upcoming deadlines"
                message="Nothing scheduled in the next week."
              />
            } @else {
              @for (task of summary()!.upcoming; track task.id) {
                <a class="row" [routerLink]="['/tasks', task.id]">
                  <span class="row-title">{{ task.title }}</span>
                  <span class="row-date">{{ formatDate(task.dueDate!) }}</span>
                </a>
              }
            }
          </div>
        </section>

        <!-- Recent tasks -->
        <section class="panel card">
          <header class="panel-head">
            <h2>Recent tasks</h2>
            <a class="panel-link" routerLink="/tasks">View all</a>
          </header>
          <div class="panel-body tight">
            @if (loading()) {
              <app-skeleton variant="row" [repeat]="4" />
            } @else if (summary()!.recent.length === 0) {
              <app-empty-state
                [compact]="true"
                glyph="✎"
                title="No tasks yet"
                message="Create your first task to get started."
                actionLabel="New task"
                (action)="openCreate()"
              />
            } @else {
              @for (task of summary()!.recent; track task.id) {
                <a class="row" [routerLink]="['/tasks', task.id]">
                  <span class="row-title" [class.done]="task.status === 'COMPLETED'">
                    {{ task.title }}
                  </span>
                  @if (task.childCount) {
                    <span class="sub-count" title="Nested subtasks">
                      ⌄{{ task.childCount }}
                    </span>
                  }
                  <span class="badge" [class]="statusBadgeClass(task.status)">
                    {{ statusLabel(task.status) }}
                  </span>
                  <app-progress-bar class="row-meter" [value]="task.progress" [slim]="true" />
                </a>
              }
            }
          </div>
        </section>

        <!-- Activity feed -->
        <section class="panel card span-2">
          <header class="panel-head">
            <h2>Activity</h2>
            <span class="panel-note">Most recent changes across your tasks</span>
          </header>
          <div class="panel-body tight">
            @if (loading()) {
              <app-skeleton variant="row" [repeat]="4" />
            } @else if (summary()!.activity.length === 0) {
              <app-empty-state
                [compact]="true"
                glyph="◷"
                title="No activity yet"
                message="Changes to your tasks will show up here."
              />
            } @else {
              @for (entry of summary()!.activity; track entry.id) {
                <a class="activity" [routerLink]="['/tasks', entry.taskId]">
                  <span class="activity-dot" aria-hidden="true"></span>
                  <span class="activity-text">
                    <span class="activity-summary">{{ entry.summary }}</span>
                    <span class="activity-meta">
                      {{ entry.taskTitle }} · {{ entry.actorName }} ·
                      {{ relativeTime(entry.createdAt) }}
                    </span>
                  </span>
                </a>
              }
            }
          </div>
        </section>
      </div>
    </div>

    @if (showForm()) {
      <app-task-form (saved)="onSaved($event)" (cancelled)="closeForm()" />
    }
  `,
  styles: [
    `
      .page {
        /* Tighter rhythm than the old layout: dense enough to see the whole day
           at once, which is the point of a dashboard. */
        max-width: 1280px;
        margin: 0 auto;
        padding: 1.5rem 1.25rem 3rem;
        display: flex;
        flex-direction: column;
        gap: 1.1rem;
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
        gap: 0.5rem;
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

      /* ---------- KPI tiles ---------- */
      .stat-row {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 0.7rem;
      }

      .stat {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        align-items: flex-start;
        text-align: left;
        padding: 0.8rem 0.9rem;
        border-radius: var(--radius);
        border: 1px solid var(--border);
        background: var(--surface);
        cursor: pointer;
        transition: transform 0.12s ease, box-shadow 0.14s ease, border-color 0.14s ease;
      }

      .stat:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-sm);
        border-color: var(--border-strong);
      }

      .stat-label {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .stat-value {
        font-family: var(--font-display);
        font-size: 1.5rem;
        font-weight: 700;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
      }

      .stat-hint {
        font-size: 0.72rem;
        color: var(--faint);
      }

      .tone-brand .stat-value { color: var(--brand-strong); }
      .tone-good .stat-value { color: var(--done); }
      .tone-warn .stat-value { color: var(--med); }
      .tone-bad .stat-value { color: var(--high); }

      /* ---------- panels ---------- */
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.9rem;
        align-items: start;
      }

      .span-2 {
        grid-column: span 2;
      }

      .panel {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        padding: 0.75rem 0.95rem;
        border-bottom: 1px solid var(--border);
      }

      .panel-head h2 {
        font-size: 0.92rem;
        font-weight: 700;
      }

      .panel-note {
        font-size: 0.72rem;
        color: var(--faint);
      }

      .panel-link {
        font-size: 0.76rem;
        font-weight: 700;
      }

      .pill {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        background: var(--surface-2);
        color: var(--ink-2);
        font-variant-numeric: tabular-nums;
      }

      .pill-bad {
        background: var(--high-tint);
        color: var(--high);
      }

      .panel-body {
        padding: 0.9rem 0.95rem;
      }

      .panel-body.tight {
        padding: 0.3rem 0.35rem;
      }

      /* ---------- progress overview ---------- */
      .overview {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr);
        gap: 1.4rem;
      }

      .overall {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        justify-content: center;
      }

      .overall-value {
        display: block;
        font-family: var(--font-display);
        font-size: 2rem;
        font-weight: 700;
        line-height: 1;
        color: var(--brand-strong);
        font-variant-numeric: tabular-nums;
      }

      .overall-label {
        display: block;
        margin-top: 0.3rem;
        font-size: 0.74rem;
        color: var(--muted);
      }

      .status-bars {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }

      .status-bars li {
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-areas: 'name count' 'track track';
        gap: 0.2rem 0.5rem;
        font-size: 0.78rem;
      }

      .status-name {
        grid-area: name;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: var(--ink-2);
      }

      .status-count {
        grid-area: count;
        font-weight: 700;
        color: var(--ink);
        font-variant-numeric: tabular-nums;
      }

      .status-track {
        grid-area: track;
        height: 4px;
        border-radius: 999px;
        background: var(--surface-2);
        overflow: hidden;
      }

      .status-fill {
        display: block;
        height: 100%;
        border-radius: 999px;
        transition: width 0.35s ease;
      }

      .swatch {
        width: 7px;
        height: 7px;
        border-radius: 2px;
      }

      .sw-todo { background: var(--todo); }
      .sw-in_progress { background: var(--progress); }
      .sw-review { background: var(--review); }
      .sw-completed { background: var(--done); }
      .sw-cancelled { background: var(--cancelled); }

      .trend {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .trend-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .trend-title {
        font-size: 0.74rem;
        font-weight: 700;
        color: var(--ink-2);
      }

      .trend-total {
        font-size: 0.72rem;
        color: var(--muted);
      }

      .spark {
        display: flex;
        align-items: flex-end;
        gap: 3px;
        height: 54px;
      }

      .spark-bar {
        flex: 1;
        min-height: 3px;
        border-radius: 2px 2px 0 0;
        background: var(--brand);
        opacity: 0.85;
        transition: height 0.3s ease;
      }

      .spark-bar:hover {
        opacity: 1;
      }

      /* ---------- list rows ---------- */
      .row,
      .activity {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.5rem 0.6rem;
        border-radius: var(--radius-sm);
        text-decoration: none;
        color: inherit;
        transition: background-color 0.12s ease;
      }

      .row:hover,
      .activity:hover {
        background: var(--surface-2);
        text-decoration: none;
      }

      .row-title {
        flex: 1;
        min-width: 0;
        font-size: 0.85rem;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .row-title.done {
        color: var(--muted);
        text-decoration: line-through;
      }

      .sub-count {
        font-size: 0.7rem;
        font-weight: 700;
        color: var(--muted);
        background: var(--surface-2);
        border-radius: 999px;
        padding: 0.05rem 0.35rem;
        flex-shrink: 0;
      }

      .row-date {
        font-size: 0.75rem;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
      }

      .row-date.late {
        color: var(--high);
        font-weight: 700;
      }

      .row-meter {
        flex: 0 0 74px;
      }

      .activity {
        align-items: flex-start;
      }

      .activity-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--brand);
        margin-top: 0.45rem;
        flex-shrink: 0;
      }

      .activity-text {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 0;
      }

      .activity-summary {
        font-size: 0.83rem;
        color: var(--ink);
      }

      .activity-meta {
        font-size: 0.72rem;
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ---------- responsive ---------- */
      @media (max-width: 1100px) {
        .overview {
          grid-template-columns: 1fr 1fr;
        }
        .trend {
          grid-column: span 2;
        }
      }

      @media (max-width: 900px) {
        .stat-row {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .grid,
        .span-2 {
          grid-template-columns: 1fr;
          grid-column: auto;
        }
      }

      @media (max-width: 620px) {
        .page {
          padding: 1.1rem 0.85rem 2.5rem;
        }
        .stat-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .overview {
          grid-template-columns: 1fr;
        }
        .trend {
          grid-column: auto;
        }
        .head-actions {
          width: 100%;
        }
        .head-actions .btn {
          flex: 1;
        }
        .row-meter {
          display: none;
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly taskService = inject(TaskService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);

  ngOnInit(): void {
    this.load();
    // Global "n" shortcut, broadcast by the shell.
    document.addEventListener(NEW_ITEM_SHORTCUT, this.onNewItemShortcut);
  }

  ngOnDestroy(): void {
    document.removeEventListener(NEW_ITEM_SHORTCUT, this.onNewItemShortcut);
  }

  private readonly onNewItemShortcut = () => this.openCreate();

  /**
   * One request for the whole page. The previous dashboard fired a request per
   * card plus five per visible task; this is a single aggregate endpoint, cached
   * briefly in the service so returning to the page is instant.
   */
  load(force = false): void {
    this.loading.set(true);
    this.error.set(null);

    this.taskService.dashboard(force).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.loading.set(false);
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  // ---- KPI tiles ----

  readonly tiles = computed<StatTile[]>(() => {
    const stats = this.summary()?.stats;
    if (!stats) {
      return [];
    }
    const tiles: StatTile[] = [
      {
        key: 'open',
        label: 'Open',
        value: stats.open,
        hint: `${stats.total} in total`,
        tone: 'brand',
        filter: { status: 'TODO' },
      },
      {
        key: 'today',
        label: 'Due today',
        value: stats.dueToday,
        hint: 'ends today',
        tone: stats.dueToday > 0 ? 'warn' : 'neutral',
      },
      {
        key: 'overdue',
        label: 'Overdue',
        value: stats.overdue,
        hint: 'past due date',
        tone: stats.overdue > 0 ? 'bad' : 'good',
        filter: { overdueOnly: 'true' },
      },
      {
        key: 'week',
        label: 'This week',
        value: stats.dueThisWeek,
        hint: 'next 7 days',
        tone: 'neutral',
      },
      {
        key: 'done',
        label: 'Completed',
        value: stats.completed,
        hint: `${stats.completionRate}% of all tasks`,
        tone: 'good',
        filter: { status: 'COMPLETED' },
      },
    ];
    return tiles;
  });

  drillInto(tile: StatTile): void {
    void this.router.navigate(['/tasks'], { queryParams: tile.filter ?? {} });
  }

  // ---- status breakdown ----

  readonly statusBreakdown = computed(() => {
    const stats = this.summary()?.stats;
    if (!stats) {
      return [];
    }
    const entries = Object.entries(stats.byStatus) as [TaskStatus, number][];
    const max = Math.max(1, ...entries.map(([, count]) => count));
    return entries
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        count,
        // Share of the largest bucket, so small counts stay visible.
        share: Math.round((count / max) * 100),
      }));
  });

  // ---- sparkline ----

  readonly trendTotal = computed(() =>
    (this.summary()?.completionTrend ?? []).reduce((sum, point) => sum + point.completed, 0)
  );

  private readonly trendMax = computed(() =>
    Math.max(1, ...(this.summary()?.completionTrend ?? []).map((point) => point.completed))
  );

  barHeight(count: number): number {
    return Math.max(5, Math.round((count / this.trendMax()) * 100));
  }

  trendLabel(): string {
    return `Tasks completed per day over the last 14 days, ${this.trendTotal()} in total.`;
  }

  // ---- create ----

  openCreate(): void {
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  onSaved(payload: TaskRequest): void {
    this.taskService.create(payload).subscribe({
      next: (task) => {
        this.closeForm();
        this.toast.success(`Created "${task.title}".`);
        this.load(true);
      },
      error: (err: ApiClientError) => {
        this.closeForm();
        this.toast.error(err.message);
      },
    });
  }

  // ---- display helpers ----

  greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  today(): string {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  priorityLabel(p: Priority): string {
    return PRIORITY_LABELS[p];
  }

  statusLabel(s: TaskStatus): string {
    return STATUS_LABELS[s];
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
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  /** Compact "3h ago" style stamp for the activity feed. */
  relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));

    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
