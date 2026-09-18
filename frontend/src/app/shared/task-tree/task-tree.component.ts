import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Observable, finalize } from 'rxjs';
import { ApiClientError } from '../../core/models/api-error';
import { TaskNode } from '../../core/models/task.model';
import { ConfirmService } from '../../core/services/confirm.service';
import { TaskService } from '../../core/services/task.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../ui/empty-state.component';
import { DropMode, TaskTreeApi } from './task-tree-api';
import { TaskTreeNodeComponent } from './task-tree-node.component';

/** Horizontal indent added per nesting level. */
const INDENT_STEP_PX = 20;

/**
 * Owner of the task tree: holds all interaction state, performs every mutation,
 * and renders the recursive rows.
 *
 * <p>State lives here rather than in the rows because a row can appear at any
 * depth and must not carry its own copy of "which rows are open" or "what is
 * being dragged". Rows receive one {@link TaskTreeApi} object and stay purely
 * presentational.
 *
 * <p>After every mutation this asks its host to reload rather than patching the
 * tree locally. Weighted progress cascades to the root, and re-deriving that in
 * the browser would mean a second implementation of the rule that already lives
 * in the backend — guaranteed to drift. One refetch keeps a single source of truth.
 */
@Component({
  selector: 'app-task-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TaskTreeNodeComponent, EmptyStateComponent],
  template: `
    @if (nodes().length === 0) {
      <app-empty-state
        glyph="⌗"
        title="No tasks to show"
        message="Create a task, then nest subtasks under it to any depth."
      />
    } @else {
      <div class="tree" role="tree" (dragover)="allowRootDrop($event)" (drop)="dropAtRoot($event)">
        @for (node of nodes(); track node.id) {
          <app-task-tree-node [node]="node" [api]="api()" />
        }

        <!-- Dropping in the empty space below the tree promotes a task to the
             top level, which is otherwise hard to express by dragging. -->
        @if (draggingId() !== null) {
          <div class="root-drop" [class.active]="rootDropActive()">
            Drop here to make it a top-level task
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .tree {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }

      .root-drop {
        margin-top: 0.4rem;
        padding: 0.7rem;
        text-align: center;
        font-size: 0.8rem;
        color: var(--muted);
        border: 1px dashed var(--border-strong);
        border-radius: var(--radius-sm);
        transition: border-color 0.12s ease, color 0.12s ease, background-color 0.12s ease;
      }

      .root-drop.active {
        border-color: var(--brand);
        color: var(--brand-strong);
        background: var(--brand-tint);
      }
    `,
  ],
})
export class TaskTreeComponent {
  private readonly taskService = inject(TaskService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly nodes = input.required<readonly TaskNode[]>();
  /**
   * Absolute depth the supplied nodes sit at. Zero when rendering top-level
   * tasks; set it when rendering a subtree that starts partway down, so the first
   * visible level isn't already indented.
   */
  readonly depthOffset = input(0);
  /** Emitted after any successful mutation, so the host can refetch. */
  readonly changed = output<void>();
  /** Emitted when a row's title is clicked. */
  readonly opened = output<TaskNode>();

  // ---- interaction state ----

  private readonly expandedIds = signal<ReadonlySet<number>>(new Set());
  private readonly busyIds = signal<ReadonlySet<number>>(new Set());
  private readonly _addingUnder = signal<number | null>(null);
  private readonly _draftTitle = signal('');
  private readonly _draftWeight = signal<number | null>(null);

  private readonly _draggingId = signal<number | null>(null);
  private readonly _dropTargetId = signal<number | null>(null);
  private readonly _dropMode = signal<DropMode | null>(null);
  private readonly _rootDropActive = signal(false);

  readonly draggingId = this._draggingId.asReadonly();
  readonly rootDropActive = this._rootDropActive.asReadonly();

  /**
   * Ids inside the node being dragged. Precomputed so `canDropOn` is a set
   * lookup per row rather than a tree walk on every `dragover` event.
   */
  private readonly draggedSubtreeIds = computed<ReadonlySet<number>>(() => {
    const id = this._draggingId();
    if (id === null) {
      return new Set();
    }
    const dragged = this.findNode(this.nodes(), id);
    return dragged ? this.collectIds(dragged) : new Set([id]);
  });

  /** The single object handed to every row. */
  readonly api = computed<TaskTreeApi>(() => ({
    isExpanded: (id) => this.expandedIds().has(id),
    toggleExpanded: (id) => this.toggleExpanded(id),
    isBusy: (id) => this.busyIds().has(id),
    indentPx: (depth) => Math.max(0, depth - this.depthOffset()) * INDENT_STEP_PX,

    toggleComplete: (node, completed) => this.toggleComplete(node, completed),
    openDetail: (node) => this.opened.emit(node),
    remove: (node) => this.remove(node),
    changeWeight: (node, weight) => this.changeWeight(node, weight),

    addingUnder: () => this._addingUnder(),
    startAdd: (id) => this.startAdd(id),
    cancelAdd: () => this.cancelAdd(),
    draftTitle: () => this._draftTitle(),
    setDraftTitle: (value) => this._draftTitle.set(value),
    draftWeight: () => this._draftWeight(),
    setDraftWeight: (value) => this._draftWeight.set(value),
    submitAdd: (parent) => this.submitAdd(parent),

    draggingId: () => this._draggingId(),
    dropTargetId: () => this._dropTargetId(),
    dropMode: () => this._dropMode(),
    canDropOn: (node) => this.canDropOn(node),
    dragStart: (node) => this.dragStart(node),
    dragOver: (node, mode) => this.dragOver(node, mode),
    dragLeave: (node) => this.dragLeave(node),
    drop: (node) => this.drop(node),
    dragEnd: () => this.resetDrag(),
  }));

  // ---- expansion ----

  /** Opens every node that has children — handy for a freshly loaded tree. */
  expandAll(): void {
    const ids = new Set<number>();
    const walk = (list: readonly TaskNode[]) =>
      list.forEach((node) => {
        if (node.children.length > 0) {
          ids.add(node.id);
          walk(node.children);
        }
      });
    walk(this.nodes());
    this.expandedIds.set(ids);
  }

  collapseAll(): void {
    this.expandedIds.set(new Set());
  }

  private toggleExpanded(id: number): void {
    this.expandedIds.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  // ---- inline add ----

  private startAdd(id: number): void {
    // Opening the composer also reveals where the new child will land.
    this.expandedIds.update((current) => new Set(current).add(id));
    this._addingUnder.set(id);
    this._draftTitle.set('');
    this._draftWeight.set(null);
  }

  private cancelAdd(): void {
    this._addingUnder.set(null);
    this._draftTitle.set('');
    this._draftWeight.set(null);
  }

  private submitAdd(parent: TaskNode): void {
    const title = this._draftTitle().trim();
    if (!title) {
      return;
    }

    this.run(parent.id, () =>
      this.taskService.addChild(parent.id, { title, weight: this._draftWeight() })
    ).subscribe({
      next: () => {
        this.cancelAdd();
        this.toast.success(`Added "${title}" under "${parent.title}".`);
        this.changed.emit();
      },
      error: (err: ApiClientError) => this.toast.error(err.message),
    });
  }

  // ---- row mutations ----

  private toggleComplete(node: TaskNode, completed: boolean): void {
    this.run(node.id, () =>
      this.taskService.setStatus(node.id, completed ? 'COMPLETED' : 'TODO')
    ).subscribe({
      next: () => this.changed.emit(),
      error: (err: ApiClientError) => {
        this.toast.error(err.message);
        // Force a refetch so the checkbox snaps back to the server's truth.
        this.changed.emit();
      },
    });
  }

  private changeWeight(node: TaskNode, weight: number): void {
    this.run(node.id, () => this.taskService.setWeight(node.id, weight)).subscribe({
      next: () => {
        this.toast.success(`Weight for "${node.title}" set to ${weight}.`);
        this.changed.emit();
      },
      error: (err: ApiClientError) => {
        this.toast.error(err.message);
        this.changed.emit();
      },
    });
  }

  private remove(node: TaskNode): void {
    const descendants = this.collectIds(node).size - 1;
    const message = descendants > 0
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

  // ---- drag & drop ----

  private canDropOn(node: TaskNode): boolean {
    const draggingId = this._draggingId();
    if (draggingId === null) {
      return false;
    }
    // Dropping a task onto itself or into its own subtree would be circular.
    // The server rejects it too; blocking it here just avoids a pointless round
    // trip and an error toast for something the UI can see is impossible.
    return !this.draggedSubtreeIds().has(node.id);
  }

  private dragStart(node: TaskNode): void {
    this._draggingId.set(node.id);
  }

  private dragOver(node: TaskNode, mode: DropMode): void {
    this._rootDropActive.set(false);
    this._dropTargetId.set(node.id);
    this._dropMode.set(mode);
  }

  private dragLeave(node: TaskNode): void {
    if (this._dropTargetId() === node.id) {
      this._dropTargetId.set(null);
      this._dropMode.set(null);
    }
  }

  private drop(target: TaskNode): void {
    const draggingId = this._draggingId();
    const mode = this._dropMode();
    this.resetDrag();

    if (draggingId === null || draggingId === target.id) {
      return;
    }

    // "into" nests under the target; "before" makes it the target's preceding sibling.
    const parentId = mode === 'before' ? target.parentId : target.id;
    const position = mode === 'before' ? target.position : null;

    this.run(draggingId, () => this.taskService.move(draggingId, { parentId, position })).subscribe({
      next: () => {
        if (mode === 'into') {
          this.expandedIds.update((current) => new Set(current).add(target.id));
        }
        this.changed.emit();
      },
      error: (err: ApiClientError) => this.toast.error(err.message),
    });
  }

  allowRootDrop(event: DragEvent): void {
    if (this._draggingId() === null) {
      return;
    }
    event.preventDefault();
    // Only light up when the pointer is over the container itself, not a row.
    if (event.target === event.currentTarget) {
      this._rootDropActive.set(true);
      this._dropTargetId.set(null);
      this._dropMode.set(null);
    }
  }

  dropAtRoot(event: DragEvent): void {
    const draggingId = this._draggingId();
    if (draggingId === null || event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    this.resetDrag();

    this.run(draggingId, () =>
      this.taskService.move(draggingId, { parentId: null, position: null })
    ).subscribe({
      next: () => {
        this.toast.success('Promoted to a top-level task.');
        this.changed.emit();
      },
      error: (err: ApiClientError) => this.toast.error(err.message),
    });
  }

  private resetDrag(): void {
    this._draggingId.set(null);
    this._dropTargetId.set(null);
    this._dropMode.set(null);
    this._rootDropActive.set(false);
  }

  // ---- helpers ----

  /**
   * Marks a row busy for the lifetime of a request, so it can't be double-clicked
   * and visibly reads as pending. `finalize` rather than clearing in each branch,
   * so the flag also clears when the request fails.
   */
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

  private findNode(list: readonly TaskNode[], id: number): TaskNode | null {
    for (const node of list) {
      if (node.id === id) {
        return node;
      }
      const found = this.findNode(node.children, id);
      if (found) {
        return found;
      }
    }
    return null;
  }

  /** The node's own id plus every descendant's. */
  private collectIds(node: TaskNode): Set<number> {
    const ids = new Set<number>([node.id]);
    node.children.forEach((child) => this.collectIds(child).forEach((id) => ids.add(id)));
    return ids;
  }
}
