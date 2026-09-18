import { ChangeDetectionStrategy, Component, HostListener, inject, input, output, signal } from '@angular/core';
import { Observable, finalize } from 'rxjs';
import { ApiClientError } from '../../core/models/api-error';
import { STATUS_LABELS, STATUS_OPTIONS, TaskNode, TaskStatus } from '../../core/models/task.model';
import { ConfirmService } from '../../core/services/confirm.service';
import { TaskService } from '../../core/services/task.service';
import { ToastService } from '../../core/services/toast.service';
import { TaskStatusListApi } from './task-status-list-api';
import { TaskStatusRowComponent } from './task-status-row.component';

interface StatusGroup {
  status: TaskStatus;
  label: string;
  nodes: TaskNode[];
}

/** Display order for groups — matches the natural workflow, not alphabetical. */
const GROUP_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED'];

/**
 * ClickUp-style "grouped by status" task list — the replacement for the
 * drag-and-drop weight/progress tree on the main Tasks page (that tree still
 * lives on, and is still exactly right for, the Task Detail page's own
 * subtree view — see {@code TaskTreeComponent}, deliberately untouched).
 *
 * <p>Groups are collapsible sections per status; a row's own children still
 * expand indented directly beneath it regardless of which group the row is
 * in, since a child can carry a different status than its parent.
 */
@Component({
  selector: 'app-task-status-groups',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TaskStatusRowComponent],
  template: `
    @for (group of groups(); track group.status) {
      <section class="group">
        <header class="group-head">
          <button
            type="button"
            class="group-toggle"
            [class.collapsed]="isCollapsed(group.status)"
            [attr.aria-expanded]="!isCollapsed(group.status)"
            (click)="toggleGroup(group.status)"
          >
            <span class="chevron">▾</span>
            <span class="badge" [class]="statusBadgeClass(group.status)">{{ group.label }}</span>
            <span class="count">{{ group.nodes.length }}</span>
          </button>
          <button type="button" class="add-link" (click)="addToStatus.emit(group.status)">+ Add</button>
        </header>

        <!-- Animated via grid-rows rather than @if, so collapsing a group is a
             smooth slide rather than an instant snap. -->
        <div class="group-body" [class.open]="!isCollapsed(group.status)">
          <div class="group-body-inner">
            <div class="columns">
              <span class="col col-name">Name</span>
              <span class="col col-status">Status</span>
              <span class="col col-assignee">Assignee</span>
              <span class="col col-due">Due date</span>
              <span class="col col-priority">Priority</span>
              <span class="col col-points">Points</span>
              <span class="col col-progress">Progress</span>
              <span class="col col-menu"></span>
            </div>

            <div class="rows">
              @for (node of group.nodes; track node.id) {
                <app-task-status-row [node]="node" [api]="api" />
              }
            </div>

            <button type="button" class="add-task" (click)="addToStatus.emit(group.status)">
              <span class="add-task-icon">+</span> Add Task
            </button>
          </div>
        </div>
      </section>
    }
  `,
  styles: [
    `
      .group {
        border-bottom: 1px solid var(--border);
      }

      .group:last-child {
        border-bottom: none;
      }

      .group-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        padding: 0.55rem 0.9rem;
        background: var(--surface-2);
      }

      .group-toggle {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.2rem 0.3rem;
        margin: -0.2rem -0.3rem;
        border-radius: var(--radius-sm);
        transition: background-color 0.12s ease;
      }

      .group-toggle:hover {
        background: var(--surface);
      }

      .group-toggle .chevron {
        font-size: 0.7rem;
        color: var(--muted);
        transition: transform 0.18s ease;
      }

      .group-toggle.collapsed .chevron {
        transform: rotate(-90deg);
      }

      .group-toggle .badge {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        padding: 0.28rem 0.65rem;
        border-radius: 999px;
      }

      .group-toggle .count {
        font-size: 0.76rem;
        font-weight: 700;
        color: var(--muted);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 0.05rem 0.5rem;
        min-width: 1.6rem;
        text-align: center;
      }

      .add-link {
        background: none;
        border: none;
        color: var(--brand);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        padding: 0.3rem 0.5rem;
        border-radius: var(--radius-sm);
        transition: background-color 0.12s ease;
      }

      .add-link:hover {
        background: var(--brand-tint);
      }

      /* Smooth expand/collapse via animated grid track, no JS height calc. */
      .group-body {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows 0.22s ease;
      }

      .group-body.open {
        grid-template-rows: 1fr;
      }

      .group-body-inner {
        overflow: hidden;
      }

      .columns {
        display: flex;
        align-items: center;
        padding: 0.35rem 0.9rem;
        border-bottom: 1px solid var(--border);
      }

      .col {
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--faint);
        flex-shrink: 0;
      }

      .col-name { flex: 1 1 auto; }
      .col-status { width: 136px; }
      .col-assignee { width: 56px; text-align: center; }
      .col-due { width: 100px; }
      .col-priority { width: 56px; text-align: center; }
      .col-points { width: 68px; text-align: center; }
      .col-progress { width: 96px; }
      .col-menu { width: 32px; }

      .add-task {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        padding: 0.5rem 0.9rem;
        font-size: 0.82rem;
        color: var(--muted);
        cursor: pointer;
        transition: background-color 0.12s ease, color 0.12s ease;
      }

      .add-task:hover {
        background: var(--surface-2);
        color: var(--brand-strong);
      }

      .add-task-icon {
        font-weight: 700;
        color: var(--brand);
      }

      @media (max-width: 1000px) {
        .col-progress {
          display: none;
        }
      }

      @media (max-width: 900px) {
        .col-points {
          display: none;
        }
      }

      @media (max-width: 720px) {
        .col-priority,
        .col-status {
          display: none;
        }
      }
    `,
  ],
})
export class TaskStatusGroupsComponent {
  private readonly taskService = inject(TaskService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly nodes = input.required<readonly TaskNode[]>();
  /** Emitted after any successful mutation, so the host can refetch. */
  readonly changed = output<void>();
  readonly opened = output<TaskNode>();
  /** Emitted when "Edit" is chosen — the host owns the shared edit modal. */
  readonly edit = output<TaskNode>();
  /** Emitted from "+ Add" / "+ Add Task" — the host opens the create modal preset to this status. */
  readonly addToStatus = output<TaskStatus>();

  private readonly expandedIds = signal<ReadonlySet<number>>(new Set());
  private readonly busyIds = signal<ReadonlySet<number>>(new Set());
  private readonly collapsedGroups = signal<ReadonlySet<TaskStatus>>(new Set());
  readonly openMenuIdSignal = signal<number | null>(null);

  private readonly addingUnderSignal = signal<number | null>(null);
  private readonly draftTitleSignal = signal('');
  private readonly draftWeightSignal = signal<number | null>(null);

  readonly groups = () => this.computeGroups();

  private computeGroups(): StatusGroup[] {
    const byStatus = new Map<TaskStatus, TaskNode[]>();
    for (const node of this.nodes()) {
      const list = byStatus.get(node.status);
      if (list) {
        list.push(node);
      } else {
        byStatus.set(node.status, [node]);
      }
    }
    return GROUP_ORDER.filter((s) => byStatus.has(s)).map((status) => ({
      status,
      label: STATUS_LABELS[status],
      nodes: byStatus.get(status)!,
    }));
  }

  isCollapsed(status: TaskStatus): boolean {
    return this.collapsedGroups().has(status);
  }

  toggleGroup(status: TaskStatus): void {
    this.collapsedGroups.update((current) => {
      const next = new Set(current);
      if (!next.delete(status)) {
        next.add(status);
      }
      return next;
    });
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

  /** The single object handed to every row. */
  readonly api: TaskStatusListApi = {
    isExpanded: (id) => this.expandedIds().has(id),
    toggleExpanded: (id) => this.toggleExpanded(id),
    isBusy: (id) => this.busyIds().has(id),

    openMenuId: () => this.openMenuIdSignal(),
    toggleMenu: (id, event) => this.toggleMenu(id, event),

    changeStatus: (node, status) => this.changeStatus(node, status),
    openDetail: (node) => this.opened.emit(node),
    editNode: (node) => this.editNode(node),
    duplicateNode: (node) => this.duplicateNode(node),
    archiveNode: (node) => this.archiveNode(node),
    restoreNode: (node) => this.restoreNode(node),
    removeNode: (node) => this.removeNode(node),

    addingUnder: () => this.addingUnderSignal(),
    startAdd: (id) => this.startAdd(id),
    cancelAdd: () => this.cancelAdd(),
    draftTitle: () => this.draftTitleSignal(),
    setDraftTitle: (value) => this.draftTitleSignal.set(value),
    draftWeight: () => this.draftWeightSignal(),
    setDraftWeight: (value) => this.draftWeightSignal.set(value),
    submitAdd: (node) => this.submitAdd(node),
  };

  private toggleExpanded(id: number): void {
    this.expandedIds.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  private toggleMenu(id: number, event: Event): void {
    event.stopPropagation();
    this.openMenuIdSignal.set(this.openMenuIdSignal() === id ? null : id);
  }

  // ---- inline "add subtask" ----

  private startAdd(id: number): void {
    // Opening the composer also reveals where the new child will land.
    this.expandedIds.update((current) => new Set(current).add(id));
    this.addingUnderSignal.set(id);
    this.draftTitleSignal.set('');
    this.draftWeightSignal.set(null);
  }

  private cancelAdd(): void {
    this.addingUnderSignal.set(null);
    this.draftTitleSignal.set('');
    this.draftWeightSignal.set(null);
  }

  private submitAdd(parent: TaskNode): void {
    const title = this.draftTitleSignal().trim();
    if (!title) {
      return;
    }
    const weight = this.draftWeightSignal();
    this.run(parent.id, () => this.taskService.addChild(parent.id, { title, weight })).subscribe({
      next: () => {
        this.cancelAdd();
        this.toast.success(`Added "${title}" under "${parent.title}".`);
        this.changed.emit();
      },
      error: (err: ApiClientError) => this.toast.error(err.message),
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuIdSignal.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.openMenuIdSignal.set(null);
  }

  private changeStatus(node: TaskNode, status: TaskStatus): void {
    this.run(node.id, () => this.taskService.setStatus(node.id, status)).subscribe({
      next: () => this.changed.emit(),
      error: (err: ApiClientError) => {
        this.toast.error(err.message);
        this.changed.emit();
      },
    });
  }

  private editNode(node: TaskNode): void {
    this.openMenuIdSignal.set(null);
    this.edit.emit(node);
  }

  private duplicateNode(node: TaskNode): void {
    this.openMenuIdSignal.set(null);
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

  private archiveNode(node: TaskNode): void {
    this.openMenuIdSignal.set(null);
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

  private restoreNode(node: TaskNode): void {
    this.openMenuIdSignal.set(null);
    this.run(node.id, () => this.taskService.setStatus(node.id, 'TODO')).subscribe({
      next: () => {
        this.toast.success(`Restored "${node.title}".`);
        this.changed.emit();
      },
      error: (err: ApiClientError) => this.toast.error(err.message),
    });
  }

  private removeNode(node: TaskNode): void {
    this.openMenuIdSignal.set(null);
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
}
