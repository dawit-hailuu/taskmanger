import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, finalize, forkJoin } from 'rxjs';
import { ApiClientError } from '../../core/models/api-error';
import {
  PRIORITY_LABELS,
  Priority,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  TagRef,
  TaskCollaborator,
  TaskNode,
  TaskStatus,
} from '../../core/models/task.model';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ProfileService } from '../../core/services/profile.service';
import { TaskDetailService } from '../../core/services/task-detail.service';
import { TaskService } from '../../core/services/task.service';
import { ToastService } from '../../core/services/toast.service';
import { ProgressBarComponent } from '../ui/progress-bar.component';
import { UserAvatarComponent } from '../ui/user-avatar.component';

/** Sub-resource info shown in a card's right-side info panel. */
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

/** How many direct children show inline before "show more" appears. */
const PREVIEW_LIMIT = 4;

/**
 * Board/card view of the same top-level task nodes {@link TaskTreeComponent}
 * renders as rows — an alternate presentation, not a separate data source.
 *
 * <p>Progress and status come straight off {@link TaskNode} (already rolled up
 * server-side); only the info-panel extras (tags/assignees/watchers/
 * attachments/comments) need their own per-card fetch, since the tree endpoint
 * doesn't carry those.
 */
@Component({
  selector: 'app-task-card-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProgressBarComponent, UserAvatarComponent],
  template: `
    <div class="card-grid">
      @for (node of nodes(); track node.id) {
        <article class="task-card card" [class.busy]="isBusy(node.id)">
          <div class="card-top">
            <div class="badges">
              <span class="badge" [class]="priorityBadgeClass(node.priority)">
                <span class="dot"></span>{{ priorityLabel(node.priority) }}
              </span>
              <span class="badge" [class]="statusBadgeClass(node.status)">
                {{ statusLabel(node.status) }}
              </span>
            </div>

            <div class="menu-wrap">
              <button
                type="button"
                class="menu-trigger"
                aria-label="Task actions"
                aria-haspopup="menu"
                [attr.aria-expanded]="openMenuId() === node.id"
                (click)="toggleMenu(node.id, $event)"
              >
                ⋮
              </button>
              @if (openMenuId() === node.id) {
                <div class="menu-dropdown" role="menu">
                  <button type="button" role="menuitem" (click)="editNode(node)">✎ Edit</button>
                  <button type="button" role="menuitem" (click)="duplicateNode(node)">
                    ⧉ Duplicate
                  </button>
                  @if (isArchived(node)) {
                    <button type="button" role="menuitem" (click)="restoreNode(node)">
                      ↺ Restore
                    </button>
                  } @else {
                    <button type="button" role="menuitem" (click)="archiveNode(node)">
                      🗄 Archive
                    </button>
                  }
                  <button
                    type="button"
                    role="menuitem"
                    class="danger"
                    (click)="deleteNode(node)"
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
                <button type="button" (click)="opened.emit(node)">{{ node.title }}</button>
              </h3>

              @if (node.description) {
                <p class="task-desc">{{ node.description }}</p>
              }

              <div class="subtask-section">
                <div class="subtask-header">
                  <span class="subtask-label">Subtasks</span>
                  @if (node.children.length > 0) {
                    <span class="subtask-count">
                      {{ completedChildren(node) }}/{{ node.children.length }}
                    </span>
                  }
                </div>

                @if (node.children.length > 0) {
                  <app-progress-bar
                    class="meter"
                    [value]="node.progress"
                    [showValue]="true"
                    [ariaLabel]="'Weighted progress for ' + node.title"
                  />

                  <ul class="subtask-list">
                    @for (child of previewChildren(node); track child.id) {
                      <li>
                        <input
                          type="checkbox"
                          [checked]="child.status === 'COMPLETED'"
                          [disabled]="isBusy(child.id)"
                          (change)="toggleChildDone(node, child, $any($event.target).checked)"
                        />
                        <span [class.done]="child.status === 'COMPLETED'">{{ child.title }}</span>
                        <button
                          type="button"
                          class="subtask-x"
                          [disabled]="isBusy(child.id)"
                          (click)="removeChild(node, child)"
                          aria-label="Remove subtask"
                        >
                          ×
                        </button>
                      </li>
                    }
                  </ul>

                  @if (overflowChildren(node).length > 0) {
                    <button type="button" class="subtask-toggle" (click)="toggleExpanded(node.id)">
                      <span class="chevron" [class.open]="isExpanded(node.id)">▸</span>
                      {{
                        isExpanded(node.id)
                          ? 'Show less'
                          : 'Show ' + overflowChildren(node).length + ' more'
                      }}
                    </button>

                    <div class="subtask-overflow-wrap" [class.open]="isExpanded(node.id)">
                      <div class="subtask-overflow-inner">
                        <ul class="subtask-list">
                          @for (child of overflowChildren(node); track child.id) {
                            <li>
                              <input
                                type="checkbox"
                                [checked]="child.status === 'COMPLETED'"
                                [disabled]="isBusy(child.id)"
                                (change)="toggleChildDone(node, child, $any($event.target).checked)"
                              />
                              <span [class.done]="child.status === 'COMPLETED'">{{ child.title }}</span>
                              <button
                                type="button"
                                class="subtask-x"
                                [disabled]="isBusy(child.id)"
                                (click)="removeChild(node, child)"
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
                    [value]="draftTitle(node.id)"
                    (input)="setDraftTitle(node.id, $any($event.target).value)"
                    (keydown.enter)="addChild(node)"
                  />
                  <button type="button" class="btn btn-ghost btn-sm" (click)="addChild(node)">
                    Add
                  </button>
                </div>
              </div>
            </div>

            <aside class="card-info">
              <div class="info-due" [class.overdue]="isOverdue(node)">
                @if (node.dueDate) {
                  <span>{{ formatDate(node.dueDate) }}</span>
                  @if (isOverdue(node)) {
                    <span class="flag">Overdue</span>
                  }
                } @else {
                  <span class="no-due">No due date</span>
                }
              </div>

              @if (node.projectName) {
                <a class="project-chip" [routerLink]="['/projects', node.projectId]">
                  {{ node.projectName }}
                </a>
              }

              @if (extras(node.id).tags.length > 0) {
                <div class="tag-row">
                  @for (tag of extras(node.id).tags; track tag.id) {
                    <span class="tag-chip" [style.color]="tag.color" [style.border-color]="tag.color">
                      {{ tag.name }}
                    </span>
                  }
                </div>
              }

              @if (extras(node.id).assignees.length > 0) {
                <div class="avatar-stack">
                  @for (a of extras(node.id).assignees.slice(0, 3); track a.userId) {
                    <app-user-avatar
                      [name]="a.name"
                      [userId]="a.userId"
                      [avatarUrl]="collaboratorAvatarUrl(a.userId)"
                      [size]="26"
                    />
                  }
                  @if (extras(node.id).assignees.length > 3) {
                    <span class="avatar-chip avatar-more">
                      +{{ extras(node.id).assignees.length - 3 }}
                    </span>
                  }
                </div>
              }

              <div class="meta-icons">
                <span title="Attachments">📎 {{ extras(node.id).attachmentCount }}</span>
                <span title="Comments">💬 {{ extras(node.id).commentCount }}</span>
                <span title="Watchers">👁 {{ extras(node.id).watcherCount }}</span>
              </div>
            </aside>
          </div>
        </article>
      }
    </div>
  `,
  styles: [
    `
      .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
        gap: 1.1rem;
        align-items: start;
      }

      .task-card {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        padding: 1.25rem 1.4rem;
        transition: box-shadow 0.15s ease, transform 0.1s ease;
      }

      .task-card:hover {
        box-shadow: var(--shadow);
        transform: translateY(-2px);
      }

      .task-card.busy {
        opacity: 0.7;
        pointer-events: none;
      }

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

      .task-title button {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        text-align: left;
        color: inherit;
        cursor: pointer;
      }

      .task-title button:hover {
        color: var(--brand);
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

      .meter {
        margin-bottom: 0.55rem;
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

      .avatar-stack app-user-avatar {
        margin-left: -8px;
        border: 2px solid var(--surface);
        border-radius: 50%;
      }

      .avatar-stack app-user-avatar:first-child {
        margin-left: 0;
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

      @media (max-width: 900px) {
        .card-grid {
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
    `,
  ],
})
export class TaskCardGridComponent {
  private readonly taskService = inject(TaskService);
  private readonly taskDetailService = inject(TaskDetailService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);

  readonly nodes = input.required<readonly TaskNode[]>();
  /** Emitted after any successful mutation, so the host can refetch. */
  readonly changed = output<void>();
  /** Emitted when a card's title is clicked (navigate to the full detail page). */
  readonly opened = output<TaskNode>();
  /** Emitted when "Edit" is chosen — the host owns the shared edit modal. */
  readonly edit = output<TaskNode>();

  private readonly expandedIds = signal<ReadonlySet<number>>(new Set());
  private readonly busyIds = signal<ReadonlySet<number>>(new Set());
  readonly openMenuId = signal<number | null>(null);

  /**
   * Signal-backed (not a plain Map): entries are filled in from an HTTP
   * response callback, not a template event, so under OnPush a plain Map
   * mutation would never trigger a re-render. The signal write is what makes
   * the newly-loaded tags/assignees/counts actually show up.
   */
  private readonly extrasCache = signal<ReadonlyMap<number, CardExtras>>(new Map());
  private readonly draftTitles = new Map<number, string>();

  /**
   * Plain Set, not a signal: tracks ids already requested (loading or loaded)
   * so a still-in-flight fetch isn't reissued. Every resolved fetch writes to
   * the `extrasCache` signal, which re-runs this effect — without this set,
   * that re-run would see the still-uncached in-flight ids as "not yet
   * requested" and fire a duplicate request for each of them, every time.
   */
  private readonly requestedIds = new Set<number>();

  constructor() {
    // Prune stale entries and fetch extras for any newly-seen root card.
    effect(() => {
      const current = new Set(this.nodes().map((n) => n.id));

      const staleCached = [...this.extrasCache().keys()].filter((id) => !current.has(id));
      if (staleCached.length > 0) {
        this.extrasCache.update((map) => {
          const next = new Map(map);
          staleCached.forEach((id) => next.delete(id));
          return next;
        });
      }
      for (const id of [...this.requestedIds]) {
        if (!current.has(id)) {
          this.requestedIds.delete(id);
        }
      }

      for (const node of this.nodes()) {
        if (!this.requestedIds.has(node.id)) {
          this.requestedIds.add(node.id);
          this.loadExtras(node.id);
        }
      }
    });
  }

  private loadExtras(taskId: number): void {
    forkJoin({
      tags: this.taskDetailService.listTaskTags(taskId),
      assignees: this.taskDetailService.listAssignees(taskId),
      watchers: this.taskDetailService.listWatchers(taskId),
      attachments: this.taskDetailService.listAttachments(taskId),
      comments: this.taskDetailService.listComments(taskId),
    }).subscribe({
      next: ({ tags, assignees, watchers, attachments, comments }) => {
        this.extrasCache.update((map) => {
          const next = new Map(map);
          next.set(taskId, {
            tags,
            assignees,
            watcherCount: watchers.length,
            attachmentCount: attachments.length,
            commentCount: comments.length,
          });
          return next;
        });
      },
      error: () => undefined,
    });
  }

  extras(taskId: number): CardExtras {
    return this.extrasCache().get(taskId) ?? EMPTY_EXTRAS;
  }

  // ---- checklist (direct children) ----

  previewChildren(node: TaskNode): TaskNode[] {
    return node.children.slice(0, PREVIEW_LIMIT);
  }

  overflowChildren(node: TaskNode): TaskNode[] {
    return node.children.slice(PREVIEW_LIMIT);
  }

  completedChildren(node: TaskNode): number {
    return node.children.filter((c) => c.status === 'COMPLETED').length;
  }

  isExpanded(id: number): boolean {
    return this.expandedIds().has(id);
  }

  toggleExpanded(id: number): void {
    this.expandedIds.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  draftTitle(id: number): string {
    return this.draftTitles.get(id) ?? '';
  }

  setDraftTitle(id: number, value: string): void {
    this.draftTitles.set(id, value);
  }

  addChild(node: TaskNode): void {
    const title = this.draftTitle(node.id).trim();
    if (!title) {
      return;
    }
    this.run(node.id, () => this.taskService.addChild(node.id, { title })).subscribe({
      next: () => {
        this.draftTitles.set(node.id, '');
        this.toast.success(`Added "${title}" under "${node.title}".`);
        this.changed.emit();
      },
      error: (err: ApiClientError) => this.toast.error(err.message),
    });
  }

  toggleChildDone(parent: TaskNode, child: TaskNode, completed: boolean): void {
    this.run(child.id, () =>
      this.taskService.setStatus(child.id, completed ? 'COMPLETED' : 'TODO')
    ).subscribe({
      next: () => this.changed.emit(),
      error: (err: ApiClientError) => {
        this.toast.error(err.message);
        this.changed.emit();
      },
    });
  }

  removeChild(parent: TaskNode, child: TaskNode): void {
    const descendants = this.collectIds(child).size - 1;
    const message =
      descendants > 0
        ? `"${child.title}" and its ${descendants} nested ${descendants === 1 ? 'subtask' : 'subtasks'} will be deleted. This can't be undone.`
        : `"${child.title}" will be deleted. This can't be undone.`;

    this.confirm
      .ask({ title: 'Delete subtask?', message, confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.run(child.id, () => this.taskService.delete(child.id)).subscribe({
          next: () => {
            this.toast.success(`Deleted "${child.title}".`);
            this.changed.emit();
          },
          error: (err: ApiClientError) => this.toast.error(err.message),
        });
      });
  }

  // ---- three-dot card menu ----

  toggleMenu(id: number, event: Event): void {
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  editNode(node: TaskNode): void {
    this.openMenuId.set(null);
    this.edit.emit(node);
  }

  duplicateNode(node: TaskNode): void {
    this.openMenuId.set(null);
    this.run(node.id, () => this.taskService.get(node.id)).subscribe({
      next: (task) => {
        this.taskService
          .create({
            title: `${task.title} (copy)`,
            description: task.description,
            priority: task.priority,
            status: 'TODO',
            startDate: task.startDate,
            dueDate: task.dueDate,
            estimatedMinutes: task.estimatedMinutes,
            recurrence: task.recurrence,
            recurrenceEndDate: task.recurrenceEndDate,
            projectId: task.projectId,
          })
          .subscribe({
            next: () => {
              this.toast.success(`Duplicated "${task.title}".`);
              this.changed.emit();
            },
            error: (err: ApiClientError) => this.toast.error(err.message),
          });
      },
      error: (err: ApiClientError) => this.toast.error(err.message),
    });
  }

  archiveNode(node: TaskNode): void {
    this.openMenuId.set(null);
    this.confirm
      .ask({
        title: 'Archive task?',
        message: `"${node.title}" will be marked Cancelled and drop out of your active list. You can restore it later.`,
        confirmLabel: 'Archive',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.run(node.id, () => this.taskService.setStatus(node.id, 'CANCELLED')).subscribe({
          next: () => {
            this.toast.success(`Archived "${node.title}".`);
            this.changed.emit();
          },
          error: (err: ApiClientError) => this.toast.error(err.message),
        });
      });
  }

  restoreNode(node: TaskNode): void {
    this.openMenuId.set(null);
    this.run(node.id, () => this.taskService.setStatus(node.id, 'TODO')).subscribe({
      next: () => {
        this.toast.success(`Restored "${node.title}".`);
        this.changed.emit();
      },
      error: (err: ApiClientError) => this.toast.error(err.message),
    });
  }

  deleteNode(node: TaskNode): void {
    this.openMenuId.set(null);
    const descendants = this.collectIds(node).size - 1;
    const message =
      descendants > 0
        ? `"${node.title}" and its ${descendants} nested ${descendants === 1 ? 'subtask' : 'subtasks'} will be deleted. This can't be undone.`
        : `"${node.title}" will be deleted. This can't be undone.`;

    this.confirm
      .ask({ title: 'Delete task?', message, confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.run(node.id, () => this.taskService.delete(node.id)).subscribe({
          next: () => {
            this.toast.success(`Deleted "${node.title}".`);
            this.changed.emit();
          },
          error: (err: ApiClientError) => this.toast.error(err.message),
        });
      });
  }

  isArchived(node: TaskNode): boolean {
    return node.status === 'CANCELLED';
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuId.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.openMenuId.set(null);
  }

  // ---- display helpers ----

  isBusy(id: number): boolean {
    return this.busyIds().has(id);
  }

  private run<T>(id: number, request: () => Observable<T>): Observable<T> {
    this.setBusy(id, true);
    return request().pipe(finalize(() => this.setBusy(id, false)));
  }

  private setBusy(id: number, busy: boolean): void {
    this.busyIds.update((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  private collectIds(node: TaskNode): Set<number> {
    const ids = new Set<number>([node.id]);
    node.children.forEach((child) => this.collectIds(child).forEach((id) => ids.add(id)));
    return ids;
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
      year: 'numeric',
    });
  }

  isOverdue(node: TaskNode): boolean {
    if (!node.dueDate || TERMINAL_STATUSES.includes(node.status)) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(`${node.dueDate}T00:00:00`).getTime() < today.getTime();
  }

  /** Same rule as the status list's row avatar: only the viewer's own (already-cached) photo is free. */
  collaboratorAvatarUrl(userId: number): string | null {
    const currentUser = this.auth.user();
    if (!currentUser || currentUser.id !== userId) {
      return null;
    }
    return this.profileService.profile()?.avatarUrl ?? null;
  }
}
