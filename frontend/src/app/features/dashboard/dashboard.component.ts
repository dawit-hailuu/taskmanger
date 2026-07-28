import {
  Component,
  HostListener,
  OnInit,
  inject,
  computed,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TaskService } from '../../core/services/task.service';
import { TaskDetailService } from '../../core/services/task-detail.service';
import {
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  Priority,
  STATUS_LABELS,
  STATUS_OPTIONS,
  Subtask,
  TagRef,
  Task,
  TaskCollaborator,
  TaskRequest,
  TaskStatus,
  TERMINAL_STATUSES,
} from '../../core/models/task.model';
import { TaskFormComponent } from './task-form.component';

interface SubtaskCardState {
  expanded: boolean;
  loading: boolean;
  items: Subtask[];
}

/** Extra sub-resource info shown in a card's right-side info panel. */
interface CardExtras {
  tags: TagRef[];
  assignees: TaskCollaborator[];
  watcherCount: number;
  attachmentCount: number;
  commentCount: number;
}

const EMPTY_EXTRAS: CardExtras = {
  tags: [],
  assignees: [],
  watcherCount: 0,
  attachmentCount: 0,
  commentCount: 0,
};

/** How many subtasks show inline before the "show more" toggle appears. */
const SUBTASK_PREVIEW_LIMIT = 4;

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
              <div class="card-top">
                <div class="badges">
                  <span class="badge" [ngClass]="priorityBadgeClass(task.priority)">
                    <span class="dot"></span>{{ priorityLabel(task.priority) }}
                  </span>
                  <span class="badge" [ngClass]="statusBadgeClass(task.status)">
                    {{ statusLabel(task.status) }}
                  </span>
                </div>

                <div class="menu-wrap">
                  <button
                    type="button"
                    class="menu-trigger"
                    aria-label="Task actions"
                    aria-haspopup="menu"
                    [attr.aria-expanded]="openMenuId() === task.id"
                    (click)="toggleMenu(task.id, $event)"
                  >
                    ⋮
                  </button>
                  @if (openMenuId() === task.id) {
                    <div class="menu-dropdown" role="menu">
                      <button type="button" role="menuitem" (click)="openEdit(task)">
                        ✎ Edit
                      </button>
                      <button type="button" role="menuitem" (click)="duplicateTask(task)">
                        ⧉ Duplicate
                      </button>
                      @if (isArchived(task)) {
                        <button type="button" role="menuitem" (click)="restoreTask(task)">
                          ↺ Restore
                        </button>
                      } @else {
                        <button type="button" role="menuitem" (click)="archiveTask(task)">
                          🗄 Archive
                        </button>
                      }
                      <button
                        type="button"
                        role="menuitem"
                        class="danger"
                        (click)="deleteTask(task)"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  }
                </div>
              </div>

              <div class="card-content">
                <div class="card-main">
                  <h3 class="task-title">
                    <a [routerLink]="['/tasks', task.id]">{{ task.title }}</a>
                  </h3>

                  @if (task.description) {
                    <p class="task-desc">{{ task.description }}</p>
                  }

                  <div class="subtask-section">
                    <div class="subtask-header">
                      <span class="subtask-label">Subtasks</span>
                      @if (subtaskState(task.id).items.length > 0) {
                        <span class="subtask-count">{{ subtaskProgress(task.id) }}</span>
                      }
                    </div>

                    @if (subtaskState(task.id).items.length > 0) {
                      <div class="progress-row">
                        <div class="progress-track">
                          <div
                            class="progress-fill"
                            [style.width.%]="subtaskProgressPct(task.id)"
                          ></div>
                        </div>
                        <span class="progress-pct">{{ subtaskProgressPct(task.id) }}%</span>
                      </div>
                      <p class="progress-caption">
                        {{ subtaskProgress(task.id) }} subtasks completed
                      </p>

                      <ul class="subtask-list">
                        @for (s of subtaskPreview(task.id); track s.id) {
                          <li>
                            <input
                              type="checkbox"
                              [checked]="s.completed"
                              (change)="toggleSubtaskDone(task, s, $any($event.target).checked)"
                            />
                            <span [class.done]="s.completed">{{ s.title }}</span>
                            <button
                              type="button"
                              class="subtask-x"
                              (click)="deleteSubtaskInline(task, s)"
                              aria-label="Remove subtask"
                            >
                              ×
                            </button>
                          </li>
                        }
                      </ul>

                      @if (subtaskOverflow(task.id).length > 0) {
                        <button
                          type="button"
                          class="subtask-toggle"
                          (click)="toggleSubtasks(task)"
                        >
                          <span class="chevron" [class.open]="subtaskState(task.id).expanded">▸</span>
                          {{
                            subtaskState(task.id).expanded
                              ? 'Show less'
                              : 'Show ' + subtaskOverflow(task.id).length + ' more'
                          }}
                        </button>

                        <div
                          class="subtask-overflow-wrap"
                          [class.open]="subtaskState(task.id).expanded"
                        >
                          <div class="subtask-overflow-inner">
                            <ul class="subtask-list">
                              @for (s of subtaskOverflow(task.id); track s.id) {
                                <li>
                                  <input
                                    type="checkbox"
                                    [checked]="s.completed"
                                    (change)="toggleSubtaskDone(task, s, $any($event.target).checked)"
                                  />
                                  <span [class.done]="s.completed">{{ s.title }}</span>
                                  <button
                                    type="button"
                                    class="subtask-x"
                                    (click)="deleteSubtaskInline(task, s)"
                                    aria-label="Remove subtask"
                                  >
                                    ×
                                  </button>
                                </li>
                              }
                            </ul>
                          </div>
                        </div>
                      }
                    } @else {
                      <p class="subtask-empty">No subtasks yet.</p>
                    }

                    <div class="subtask-add">
                      <input
                        type="text"
                        class="input subtask-input"
                        placeholder="+ Add subtask"
                        [value]="newSubtaskTitle(task.id)"
                        (input)="setNewSubtaskTitle(task.id, $any($event.target).value)"
                        (keydown.enter)="addSubtaskInline(task)"
                      />
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        (click)="addSubtaskInline(task)"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <aside class="card-info">
                  <div class="info-due" [class.overdue]="isOverdue(task)">
                    @if (task.dueDate) {
                      <span>{{ formatDate(task.dueDate) }}</span>
                      @if (isOverdue(task)) {
                        <span class="flag">Overdue</span>
                      }
                    } @else {
                      <span class="no-due">No due date</span>
                    }
                  </div>

                  @if (task.projectName) {
                    <a class="project-chip" [routerLink]="['/projects', task.projectId]">
                      {{ task.projectName }}
                    </a>
                  }

                  @if (cardExtras(task.id).tags.length > 0) {
                    <div class="tag-row">
                      @for (tag of cardExtras(task.id).tags; track tag.id) {
                        <span
                          class="tag-chip"
                          [style.color]="tag.color"
                          [style.border-color]="tag.color"
                        >
                          {{ tag.name }}
                        </span>
                      }
                    </div>
                  }

                  @if (cardExtras(task.id).assignees.length > 0) {
                    <div class="avatar-stack">
                      @for (a of cardExtras(task.id).assignees.slice(0, 3); track a.userId) {
                        <span class="avatar-chip" [title]="a.name">{{ initials(a.name) }}</span>
                      }
                      @if (cardExtras(task.id).assignees.length > 3) {
                        <span class="avatar-chip avatar-more">
                          +{{ cardExtras(task.id).assignees.length - 3 }}
                        </span>
                      }
                    </div>
                  }

                  <div class="meta-icons">
                    <span title="Attachments">📎 {{ cardExtras(task.id).attachmentCount }}</span>
                    <span title="Comments">💬 {{ cardExtras(task.id).commentCount }}</span>
                    <span title="Watchers">👁 {{ cardExtras(task.id).watcherCount }}</span>
                  </div>
                </aside>
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
        grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
        gap: 1.1rem;
        align-items: start;
      }

      /* ---- Task card + priority spine (the signature) ---- */
      .task {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        padding: 1.25rem 1.4rem;
        border-left-width: 4px;
        border-left-style: solid;
        border-left-color: var(--border);
        transition: box-shadow 0.15s ease, transform 0.1s ease, border-color 0.15s ease;
      }

      .task:hover {
        box-shadow: var(--shadow);
        transform: translateY(-2px);
      }

      .spine-low { border-left-color: var(--low); }
      .spine-med { border-left-color: var(--med); }
      .spine-high { border-left-color: var(--high); }
      .spine-urgent { border-left-color: var(--urgent); border-left-width: 5px; }

      /* ---- card header: badges + actions menu ---- */
      .card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .badges {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .menu-wrap {
        position: relative;
        flex-shrink: 0;
      }

      .menu-trigger {
        background: none;
        border: none;
        color: var(--muted);
        font-size: 1.15rem;
        line-height: 1;
        padding: 0.15rem 0.45rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
      }

      .menu-trigger:hover {
        background: var(--surface-2);
        color: var(--ink);
      }

      .menu-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 20;
        min-width: 160px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow-lg);
        padding: 0.35rem;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }

      .menu-dropdown button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: none;
        border: none;
        text-align: left;
        padding: 0.5rem 0.6rem;
        border-radius: 6px;
        font-size: 0.85rem;
        color: var(--ink-2);
        cursor: pointer;
        white-space: nowrap;
      }

      .menu-dropdown button:hover {
        background: var(--surface-2);
        color: var(--ink);
      }

      .menu-dropdown button.danger {
        color: var(--danger);
      }

      .menu-dropdown button.danger:hover {
        background: var(--high-tint);
      }

      /* ---- card body: main column + right info panel ---- */
      .card-content {
        display: flex;
        gap: 1.4rem;
      }

      .card-main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .card-info {
        width: 172px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
        border-left: 1px dashed var(--border);
        padding-left: 1.1rem;
      }

      .task-title {
        font-size: 1.08rem;
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

      /* ---- subtask checklist ---- */
      .subtask-section {
        border-top: 1px dashed var(--border);
        padding-top: 0.7rem;
        margin-top: 0.1rem;
      }

      .subtask-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .subtask-label {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--ink-2);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .subtask-count {
        color: var(--brand-strong);
        background: var(--brand-tint);
        border-radius: 999px;
        padding: 0.05rem 0.5rem;
        font-size: 0.72rem;
        font-weight: 600;
      }

      .subtask-empty {
        color: var(--muted);
        font-size: 0.82rem;
        margin: 0;
      }

      .progress-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 0.3rem;
      }

      .progress-track {
        flex: 1;
        height: 6px;
        border-radius: 999px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: var(--brand);
        border-radius: 999px;
        transition: width 0.3s ease;
      }

      .progress-pct {
        font-size: 0.74rem;
        font-weight: 700;
        color: var(--brand-strong);
        white-space: nowrap;
      }

      .progress-caption {
        font-size: 0.76rem;
        color: var(--muted);
        margin: 0 0 0.55rem;
      }

      .subtask-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .subtask-list li {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
      }

      .subtask-list input[type='checkbox'] {
        width: 15px;
        height: 15px;
        accent-color: var(--brand);
        flex-shrink: 0;
      }

      .subtask-list span {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .subtask-list .done {
        text-decoration: line-through;
        color: var(--muted);
      }

      .subtask-x {
        background: none;
        border: none;
        color: var(--muted);
        cursor: pointer;
        font-size: 0.95rem;
        line-height: 1;
        padding: 0 0.15rem;
        flex-shrink: 0;
      }

      .subtask-x:hover {
        color: var(--high);
      }

      .subtask-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--brand-strong);
        font-size: 0.8rem;
        font-weight: 600;
        padding: 0.45rem 0 0;
      }

      .chevron {
        display: inline-block;
        font-size: 0.7rem;
        transition: transform 0.15s ease;
        color: var(--muted);
      }

      .chevron.open {
        transform: rotate(90deg);
      }

      /* smooth expand/collapse via animated grid track, no JS height calc */
      .subtask-overflow-wrap {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows 0.25s ease;
      }

      .subtask-overflow-wrap.open {
        grid-template-rows: 1fr;
      }

      .subtask-overflow-inner {
        overflow: hidden;
      }

      .subtask-overflow-inner .subtask-list {
        padding-top: 0.5rem;
      }

      .subtask-add {
        display: flex;
        gap: 0.4rem;
        margin-top: 0.6rem;
      }

      .subtask-input {
        flex: 1;
        font-size: 0.82rem;
        padding: 0.4rem 0.6rem;
      }

      .btn-sm {
        padding: 0.4rem 0.6rem;
        font-size: 0.8rem;
      }

      /* ---- right-side info panel ---- */
      .info-due {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
        font-size: 0.82rem;
        color: var(--ink-2);
        font-weight: 600;
      }

      .info-due .no-due {
        color: var(--muted);
        font-weight: 500;
      }

      .info-due.overdue {
        color: var(--high);
      }

      .info-due .flag {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        background: var(--high-tint);
        color: var(--high);
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
      }

      .project-chip {
        align-self: flex-start;
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--brand-strong);
        background: var(--brand-tint);
        border-radius: 999px;
        padding: 0.2rem 0.55rem;
        text-decoration: none;
      }

      .project-chip:hover {
        text-decoration: underline;
      }

      .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }

      .tag-chip {
        font-size: 0.7rem;
        font-weight: 600;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        color: var(--ink-2);
      }

      .avatar-stack {
        display: flex;
      }

      .avatar-chip {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: var(--brand-tint);
        color: var(--brand-strong);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.66rem;
        font-weight: 700;
        border: 2px solid var(--surface);
        margin-left: -8px;
      }

      .avatar-chip:first-child {
        margin-left: 0;
      }

      .avatar-more {
        background: var(--surface-2);
        color: var(--muted);
      }

      .meta-icons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.8rem;
        font-size: 0.78rem;
        color: var(--muted);
        margin-top: auto;
        padding-top: 0.4rem;
      }

      .meta-icons span {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        white-space: nowrap;
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

      @media (max-width: 900px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .card-content {
          flex-direction: column;
        }
        .card-info {
          width: auto;
          border-left: none;
          border-top: 1px dashed var(--border);
          padding-left: 0;
          padding-top: 0.75rem;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
        }
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
  private readonly taskDetailService = inject(TaskDetailService);

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

  /** Task id whose three-dot action menu is currently open (only one at a time). */
  readonly openMenuId = signal<number | null>(null);

  readonly hasTasks = computed(() => this.tasks().length > 0);
  readonly isFiltered = computed(
    () => !!this.search() || !!this.statusFilter() || !!this.priorityFilter()
  );

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Per-card inline subtask ("mini task") state, keyed by task id.
  private readonly subtaskStates = new Map<number, SubtaskCardState>();
  private readonly newSubtaskTitles = new Map<number, string>();

  // Per-card info-panel data (tags/assignees/watchers/attachments/comments), keyed by task id.
  private readonly cardExtrasMap = new Map<number, CardExtras>();

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
          this.preloadSubtaskCounts(result.content);
          this.preloadCardExtras(result.content);
        },
        error: (err: Error) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  /** Fetches subtasks for each visible card up front so collapsed cards can show a "2/5" count. */
  private preloadSubtaskCounts(tasks: Task[]): void {
    for (const task of tasks) {
      this.taskDetailService.listSubtasks(task.id).subscribe({
        next: (items) => this.subtaskStates.set(task.id, { expanded: false, loading: false, items }),
        error: () => undefined,
      });
    }
  }

  /** Fetches the sub-resources shown in each card's right-side info panel. */
  private preloadCardExtras(tasks: Task[]): void {
    for (const task of tasks) {
      forkJoin({
        tags: this.taskDetailService.listTaskTags(task.id),
        assignees: this.taskDetailService.listAssignees(task.id),
        watchers: this.taskDetailService.listWatchers(task.id),
        attachments: this.taskDetailService.listAttachments(task.id),
        comments: this.taskDetailService.listComments(task.id),
      }).subscribe({
        next: ({ tags, assignees, watchers, attachments, comments }) => {
          this.cardExtrasMap.set(task.id, {
            tags,
            assignees,
            watcherCount: watchers.length,
            attachmentCount: attachments.length,
            commentCount: comments.length,
          });
        },
        error: () => undefined,
      });
    }
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
    this.openMenuId.set(null);
    this.editingTask.set(null);
    this.showForm.set(true);
  }

  openEdit(task: Task): void {
    this.openMenuId.set(null);
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
    this.openMenuId.set(null);
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

  // ---- three-dot card menu ----

  toggleMenu(taskId: number, event: Event): void {
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === taskId ? null : taskId);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuId.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.openMenuId.set(null);
  }

  /** Full-replace PUT payload seeded from the current task, so unrelated fields survive the round-trip. */
  private requestFromTask(task: Task, overrides: Partial<TaskRequest> = {}): TaskRequest {
    return {
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      startDate: task.startDate,
      dueDate: task.dueDate,
      estimatedMinutes: task.estimatedMinutes,
      recurrence: task.recurrence,
      recurrenceEndDate: task.recurrenceEndDate,
      projectId: task.projectId,
      ...overrides,
    };
  }

  /** Clones a task via the existing create endpoint — no dedicated "duplicate" API needed. */
  duplicateTask(task: Task): void {
    this.openMenuId.set(null);
    const payload = this.requestFromTask(task, {
      title: `${task.title} (copy)`,
      status: 'TODO',
    });

    this.taskService.create(payload).subscribe({
      next: () => this.load(),
      error: (err: Error) => this.error.set(err.message),
    });
  }

  /**
   * There's no dedicated "archived" flag on the backend, so archiving reuses the existing
   * CANCELLED status via the normal update endpoint — it drops out of active work without
   * a new API, and "Restore" flips it back.
   */
  archiveTask(task: Task): void {
    this.openMenuId.set(null);
    const confirmed = confirm(
      `Archive "${task.title}"? It'll be marked Cancelled and out of your active list — you can restore it later.`
    );
    if (!confirmed) {
      return;
    }

    this.taskService.update(task.id, this.requestFromTask(task, { status: 'CANCELLED' })).subscribe({
      next: () => this.load(),
      error: (err: Error) => this.error.set(err.message),
    });
  }

  restoreTask(task: Task): void {
    this.openMenuId.set(null);
    this.taskService.update(task.id, this.requestFromTask(task, { status: 'TODO' })).subscribe({
      next: () => this.load(),
      error: (err: Error) => this.error.set(err.message),
    });
  }

  isArchived(task: Task): boolean {
    return task.status === 'CANCELLED';
  }

  // ---- inline subtasks ("mini tasks") ----

  subtaskState(taskId: number): SubtaskCardState {
    return this.subtaskStates.get(taskId) ?? { expanded: false, loading: false, items: [] };
  }

  subtaskPreview(taskId: number): Subtask[] {
    return this.subtaskState(taskId).items.slice(0, SUBTASK_PREVIEW_LIMIT);
  }

  subtaskOverflow(taskId: number): Subtask[] {
    return this.subtaskState(taskId).items.slice(SUBTASK_PREVIEW_LIMIT);
  }

  subtaskProgress(taskId: number): string {
    const items = this.subtaskState(taskId).items;
    const done = items.filter((i) => i.completed).length;
    return `${done}/${items.length}`;
  }

  subtaskProgressPct(taskId: number): number {
    const items = this.subtaskState(taskId).items;
    if (items.length === 0) {
      return 0;
    }
    const done = items.filter((i) => i.completed).length;
    return Math.round((done / items.length) * 100);
  }

  newSubtaskTitle(taskId: number): string {
    return this.newSubtaskTitles.get(taskId) ?? '';
  }

  setNewSubtaskTitle(taskId: number, value: string): void {
    this.newSubtaskTitles.set(taskId, value);
  }

  toggleSubtasks(task: Task): void {
    const state = this.subtaskState(task.id);
    this.subtaskStates.set(task.id, { ...state, expanded: !state.expanded });
  }

  addSubtaskInline(task: Task): void {
    const title = this.newSubtaskTitle(task.id).trim();
    if (!title) {
      return;
    }
    this.taskDetailService.createSubtask(task.id, title).subscribe({
      next: (created) => {
        const state = this.subtaskState(task.id);
        this.subtaskStates.set(task.id, { ...state, items: [...state.items, created] });
        this.newSubtaskTitles.set(task.id, '');
      },
      error: (err: Error) => this.error.set(err.message),
    });
  }

  toggleSubtaskDone(task: Task, subtask: Subtask, completed: boolean): void {
    this.taskDetailService.updateSubtask(task.id, subtask.id, subtask.title, completed).subscribe({
      next: (updated) => {
        const state = this.subtaskState(task.id);
        this.subtaskStates.set(task.id, {
          ...state,
          items: state.items.map((i) => (i.id === updated.id ? updated : i)),
        });
      },
      error: (err: Error) => this.error.set(err.message),
    });
  }

  deleteSubtaskInline(task: Task, subtask: Subtask): void {
    this.taskDetailService.deleteSubtask(task.id, subtask.id).subscribe({
      next: () => {
        const state = this.subtaskState(task.id);
        this.subtaskStates.set(task.id, {
          ...state,
          items: state.items.filter((i) => i.id !== subtask.id),
        });
      },
      error: (err: Error) => this.error.set(err.message),
    });
  }

  // ---- card info panel ----

  cardExtras(taskId: number): CardExtras {
    return this.cardExtrasMap.get(taskId) ?? EMPTY_EXTRAS;
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return '?';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
