import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input } from '@angular/core';
import {
  PRIORITY_LABELS,
  Priority,
  STATUS_LABELS,
  STATUS_OPTIONS,
  TERMINAL_STATUSES,
  TaskNode,
  TaskStatus,
} from '../../core/models/task.model';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { ProgressBarComponent } from '../ui/progress-bar.component';
import { UserAvatarComponent } from '../ui/user-avatar.component';
import { TaskStatusListApi } from './task-status-list-api';

/**
 * One row of the status-grouped task list — and, for its children, the list
 * again. Self-referencing via `forwardRef` (the class isn't defined yet when
 * the decorator runs) so a task's own subtasks render indented directly
 * beneath it, at any depth, regardless of which status group the row itself
 * belongs to.
 */
@Component({
  selector: 'app-task-status-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [forwardRef(() => TaskStatusRowComponent), UserAvatarComponent, ProgressBarComponent],
  template: `
    <div class="row" [class.busy]="api().isBusy(node().id)" [class.done]="isDone()">
      <div class="cell cell-name" [style.--indent.px]="depth() * 22">
        <button
          type="button"
          class="chevron"
          [class.open]="expanded()"
          [class.hidden]="!hasChildren()"
          [disabled]="!hasChildren()"
          [attr.aria-label]="expanded() ? 'Collapse subtasks' : 'Expand subtasks'"
          (click)="api().toggleExpanded(node().id)"
        >
          ▸
        </button>

        <input
          type="checkbox"
          class="done-check"
          [checked]="isDone()"
          [disabled]="api().isBusy(node().id)"
          [attr.aria-label]="'Mark \\'' + node().title + '\\' complete'"
          (click)="$event.stopPropagation()"
          (change)="api().changeStatus(node(), $any($event.target).checked ? 'COMPLETED' : 'TODO')"
        />

        <button type="button" class="title" (click)="api().openDetail(node())">
          {{ node().title }}
        </button>

        @if (hasChildren()) {
          <span class="subtask-count" [title]="node().children.length + ' subtasks'">
            {{ completedCount() }}/{{ node().children.length }}
          </span>
        }

        <button
          type="button"
          class="add-subtask-trigger"
          title="Add subtask"
          aria-label="Add subtask"
          (click)="api().startAdd(node().id)"
        >
          +
        </button>
      </div>

      <div class="cell cell-status">
        <select
          class="status-pill"
          [class]="statusBadgeClass()"
          [value]="node().status"
          [disabled]="api().isBusy(node().id)"
          (click)="$event.stopPropagation()"
          (change)="api().changeStatus(node(), $any($event.target).value)"
        >
          @for (s of statuses; track s) {
            <option [value]="s">{{ statusLabel(s) }}</option>
          }
        </select>
      </div>

      <div class="cell cell-assignee">
        <app-user-avatar [name]="node().ownerName" [userId]="node().ownerId" [avatarUrl]="ownerAvatarUrl()" [size]="26" />
      </div>

      <div class="cell cell-due" [class.overdue]="isOverdue()">
        {{ dueLabel() }}
      </div>

      <div class="cell cell-priority" [title]="priorityLabel() + ' priority'">
        <svg class="flag" [class]="priorityFlagClass()" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3.5 1.5a.5.5 0 0 1 .5.5v.5h8.15c.4 0 .6.48.32.76l-2.1 2.1 2.1 2.1c.28.28.08.76-.32.76H4v5.25a.5.5 0 0 1-1 0V2a.5.5 0 0 1 .5-.5Z"
          />
        </svg>
      </div>

      <div class="cell cell-points" [title]="node().weight + ' points'">
        <span class="points-badge">{{ node().weight }}</span>
      </div>

      <div class="cell cell-progress" [title]="node().progress + '% complete (weighted)'">
        <app-progress-bar [value]="node().progress" [slim]="true" ariaLabel="Weighted progress" />
      </div>

      <div class="cell cell-menu">
        <button
          type="button"
          class="menu-trigger"
          aria-label="Task actions"
          [attr.aria-expanded]="api().openMenuId() === node().id"
          (click)="api().toggleMenu(node().id, $event)"
        >
          ⋮
        </button>
        @if (api().openMenuId() === node().id) {
          <div class="menu-dropdown" role="menu">
            <button type="button" role="menuitem" (click)="api().editNode(node())">Edit</button>
            <button type="button" role="menuitem" (click)="api().duplicateNode(node())">Duplicate</button>
            @if (isArchived()) {
              <button type="button" role="menuitem" (click)="api().restoreNode(node())">Restore</button>
            } @else {
              <button type="button" role="menuitem" (click)="api().archiveNode(node())">Archive</button>
            }
            <button type="button" role="menuitem" class="danger" (click)="api().removeNode(node())">
              Delete
            </button>
          </div>
        }
      </div>
    </div>

    @if (api().addingUnder() === node().id) {
      <div class="add-row" [style.--indent.px]="(depth() + 1) * 22">
        <input
          type="text"
          class="input add-input"
          placeholder="Subtask title…"
          autofocus
          [value]="api().draftTitle()"
          (input)="api().setDraftTitle($any($event.target).value)"
          (keydown.enter)="api().submitAdd(node())"
          (keydown.escape)="api().cancelAdd()"
        />
        <label class="add-weight-label" [title]="weightHint()">
          <span class="add-weight-key">w</span>
          <input
            type="number"
            class="input add-weight"
            min="1"
            [max]="node().availableChildWeight || null"
            [placeholder]="'' + (node().availableChildWeight || 1)"
            [value]="api().draftWeight() ?? ''"
            (input)="api().setDraftWeight(parseWeight($any($event.target).value))"
            (keydown.enter)="api().submitAdd(node())"
            (keydown.escape)="api().cancelAdd()"
          />
        </label>
        <button type="button" class="btn btn-primary btn-xs" (click)="api().submitAdd(node())">
          Add
        </button>
        <button type="button" class="btn btn-ghost btn-xs" (click)="api().cancelAdd()">
          Cancel
        </button>
        <span class="add-budget">{{ node().allocatedChildWeight }} / {{ node().weight }} allocated</span>
      </div>
    }

    @if (expanded()) {
      @for (child of node().children; track child.id) {
        <app-task-status-row [node]="child" [api]="api()" [depth]="depth() + 1" />
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .row {
        position: relative;
        display: flex;
        align-items: center;
        min-height: 38px;
        padding: 0 0.9rem;
        border-bottom: 1px solid var(--border);
        transition: background-color 0.12s ease, box-shadow 0.12s ease;
      }

      .row:hover {
        background: var(--surface-2);
        box-shadow: inset 2px 0 0 var(--brand);
      }

      .row.busy {
        opacity: 0.55;
        pointer-events: none;
      }

      .cell {
        display: flex;
        align-items: center;
        font-size: 0.84rem;
        color: var(--ink-2);
        flex-shrink: 0;
      }

      .cell-name {
        flex: 1 1 auto;
        min-width: 0;
        gap: 0.4rem;
        padding-left: calc(var(--indent, 0px));
      }

      .chevron {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
        display: grid;
        place-items: center;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--muted);
        font-size: 0.6rem;
        padding: 0;
        transition: transform 0.15s ease;
      }

      .chevron.open {
        transform: rotate(90deg);
      }

      .chevron.hidden {
        visibility: hidden;
      }

      .done-check {
        flex-shrink: 0;
        width: 15px;
        height: 15px;
        accent-color: var(--brand);
        cursor: pointer;
      }

      .title {
        flex: 1 1 auto;
        min-width: 0;
        text-align: left;
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        font-size: 0.86rem;
        font-weight: 500;
        color: var(--ink);
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .title:hover {
        color: var(--brand);
      }

      .row.done .title {
        color: var(--muted);
        text-decoration: line-through;
      }

      .subtask-count {
        flex-shrink: 0;
        font-size: 0.68rem;
        font-weight: 700;
        color: var(--muted);
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 0.05rem 0.4rem;
      }

      .add-subtask-trigger {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        display: grid;
        place-items: center;
        background: none;
        border: 1px solid var(--border-strong);
        border-radius: 50%;
        color: var(--muted);
        font-size: 0.85rem;
        line-height: 1;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.12s ease, background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
      }

      .row:hover .add-subtask-trigger,
      .row:focus-within .add-subtask-trigger {
        opacity: 1;
      }

      .add-subtask-trigger:hover {
        background: var(--brand);
        border-color: var(--brand);
        color: var(--brand-ink);
      }

      .add-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.4rem;
        padding: 0.4rem 0.9rem 0.5rem calc(0.9rem + var(--indent, 0px));
        border-bottom: 1px solid var(--border);
        background: var(--surface-2);
      }

      .add-input {
        flex: 1 1 200px;
        min-width: 0;
        font-size: 0.84rem;
        padding: 0.35rem 0.6rem;
      }

      .add-weight-label {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        flex-shrink: 0;
        padding: 0.15rem 0.4rem;
        border-radius: 6px;
        background: var(--surface);
        border: 1px solid var(--border);
      }

      .add-weight-key {
        font-size: 0.68rem;
        font-weight: 700;
        color: var(--faint);
        text-transform: uppercase;
      }

      .add-weight {
        width: 3.4rem;
        border: none;
        background: transparent;
        color: var(--ink-2);
        font: inherit;
        font-size: 0.82rem;
        padding: 0.1rem 0;
      }

      .add-weight:focus {
        outline: none;
        box-shadow: none;
      }

      .add-budget {
        flex-shrink: 0;
        font-size: 0.72rem;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
        margin-left: auto;
      }

      .btn-xs {
        padding: 0.35rem 0.6rem;
        font-size: 0.78rem;
        flex-shrink: 0;
      }

      .cell-status {
        width: 136px;
      }

      .status-pill {
        width: 100%;
        border: none;
        border-radius: 999px;
        padding: 0.32rem 1.5rem 0.32rem 0.65rem;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        transition: filter 0.12s ease;
        /* Custom caret, since appearance:none drops the native one — a single
           consistent chevron beats each browser's own inconsistent default. */
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath fill='%23000' fill-opacity='0.45' d='M3 4.5 6 8l3-3.5H3Z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.5rem center;
        background-size: 10px;
      }

      .status-pill:hover:not(:disabled) {
        filter: brightness(0.96);
      }

      .cell-assignee {
        width: 56px;
        justify-content: center;
      }

      .cell-due {
        width: 100px;
        font-size: 0.79rem;
      }

      .cell-due.overdue {
        color: var(--high);
        font-weight: 700;
      }

      .cell-priority {
        width: 56px;
        justify-content: center;
      }

      .flag {
        width: 15px;
        height: 15px;
      }

      .flag-low { color: var(--low); }
      .flag-med { color: var(--med); }
      .flag-high { color: var(--high); }
      .flag-urgent { color: var(--urgent); }

      .cell-points {
        width: 68px;
        justify-content: center;
      }

      .points-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 26px;
        height: 22px;
        padding: 0 0.35rem;
        border-radius: 999px;
        border: 1px solid var(--border-strong);
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
        transition: border-color 0.12s ease, color 0.12s ease;
      }

      .row:hover .points-badge {
        border-color: var(--brand);
        color: var(--brand-strong);
      }

      .cell-progress {
        width: 96px;
      }

      .cell-menu {
        width: 32px;
        justify-content: center;
        position: relative;
      }

      .menu-trigger {
        background: none;
        border: none;
        color: var(--muted);
        font-size: 1.05rem;
        line-height: 1;
        padding: 0.15rem 0.35rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.12s ease;
      }

      .row:hover .menu-trigger,
      .row:focus-within .menu-trigger {
        opacity: 1;
      }

      .menu-trigger:hover {
        background: var(--surface);
        color: var(--ink);
      }

      .menu-dropdown {
        position: absolute;
        top: calc(100% + 2px);
        right: 0.5rem;
        z-index: 20;
        min-width: 150px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow-lg);
        padding: 0.35rem;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        animation: menu-in 0.12s ease;
        transform-origin: top right;
      }

      @keyframes menu-in {
        from { opacity: 0; transform: scale(0.96) translateY(-2px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }

      .menu-dropdown button {
        background: none;
        border: none;
        text-align: left;
        padding: 0.5rem 0.6rem;
        border-radius: 6px;
        font-size: 0.84rem;
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

      @media (max-width: 1000px) {
        .cell-progress {
          display: none;
        }
      }

      @media (max-width: 900px) {
        .cell-points {
          display: none;
        }
      }

      @media (max-width: 720px) {
        .cell-priority,
        .cell-status {
          display: none;
        }
      }
    `,
  ],
})
export class TaskStatusRowComponent {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);

  readonly node = input.required<TaskNode>();
  readonly api = input.required<TaskStatusListApi>();
  readonly depth = input(0);

  readonly statuses = STATUS_OPTIONS;

  readonly hasChildren = computed(() => this.node().children.length > 0);
  readonly expanded = computed(() => this.api().isExpanded(this.node().id));
  readonly isArchived = computed(() => this.node().status === 'CANCELLED');
  readonly isDone = computed(() => this.node().status === 'COMPLETED');

  readonly completedCount = computed(
    () => this.node().children.filter((c) => c.status === 'COMPLETED').length
  );

  readonly isOverdue = computed(() => {
    const node = this.node();
    if (!node.dueDate || TERMINAL_STATUSES.includes(node.status)) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(`${node.dueDate}T00:00:00`).getTime() < today.getTime();
  });

  /**
   * A real photo is only cheap for the signed-in user's own tasks — their profile
   * is already cached app-wide, so this costs no extra request. For a project task
   * owned by someone else, {@link UserAvatarComponent} falls back to initials
   * rather than this component firing a per-row profile lookup.
   */
  readonly ownerAvatarUrl = computed(() => {
    const currentUser = this.auth.user();
    if (!currentUser || currentUser.id !== this.node().ownerId) {
      return null;
    }
    return this.profileService.profile()?.avatarUrl ?? null;
  });

  readonly statusBadgeClass = computed(
    () =>
      ({
        TODO: 'badge-todo',
        IN_PROGRESS: 'badge-progress',
        REVIEW: 'badge-review',
        COMPLETED: 'badge-done',
        CANCELLED: 'badge-cancelled',
      })[this.node().status]
  );

  readonly priorityFlagClass = computed(
    () =>
      ({
        LOW: 'flag-low',
        MEDIUM: 'flag-med',
        HIGH: 'flag-high',
        URGENT: 'flag-urgent',
      })[this.node().priority]
  );

  statusLabel(s: TaskStatus): string {
    return STATUS_LABELS[s];
  }

  priorityLabel(): string {
    return PRIORITY_LABELS[this.node().priority as Priority];
  }

  dueLabel(): string {
    const node = this.node();
    if (!node.dueDate) {
      return '—';
    }
    if (this.isOverdue()) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(`${node.dueDate}T00:00:00`);
      const days = Math.round((today.getTime() - due.getTime()) / 86_400_000);
      return days <= 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
    return new Date(`${node.dueDate}T00:00:00`).toLocaleDateString(undefined, {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
    });
  }

  weightHint(): string {
    const node = this.node();
    return `Weight ${node.weight}. Subtasks use ${node.allocatedChildWeight} of it, ${node.availableChildWeight} still free.`;
  }

  parseWeight(raw: string): number | null {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
}
