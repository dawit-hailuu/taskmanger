import { TaskNode } from '../../core/models/task.model';

/** Where a dragged node lands relative to the row it was dropped on. */
export type DropMode = 'into' | 'before';

/**
 * Everything a tree row needs, passed down as a single object.
 *
 * <p>The tree is recursive and can be arbitrarily deep, so bubbling `output()`
 * events level by level would mean every intermediate node re-emitting every
 * event. Handing each row one context object instead keeps the recursive
 * component trivial — it renders and delegates, nothing else — and keeps all
 * state and all HTTP work in the single owning container.
 */
export interface TaskTreeApi {
  // ---- expansion ----
  isExpanded(id: number): boolean;
  toggleExpanded(id: number): void;

  /** True while a request for this row is in flight, so it can show as pending. */
  isBusy(id: number): boolean;

  /**
   * Indentation in pixels for a node at the given absolute depth.
   *
   * <p>Computed by the container rather than by the row, because the same tree
   * renders both from the top level and from partway down (the task detail page
   * shows one task's subtree). Without an offset, a subtree starting at depth 4
   * would open already indented off the left edge.
   */
  indentPx(depth: number): number;

  // ---- row actions ----
  toggleComplete(node: TaskNode, completed: boolean): void;
  openDetail(node: TaskNode): void;
  remove(node: TaskNode): void;
  changeWeight(node: TaskNode, weight: number): void;

  // ---- inline "add subtask" ----
  addingUnder(): number | null;
  startAdd(id: number): void;
  cancelAdd(): void;
  draftTitle(): string;
  setDraftTitle(value: string): void;
  draftWeight(): number | null;
  setDraftWeight(value: number | null): void;
  submitAdd(parent: TaskNode): void;

  // ---- drag & drop ----
  draggingId(): number | null;
  dropTargetId(): number | null;
  dropMode(): DropMode | null;
  /** False for the dragged node itself and anything inside it — no cycles. */
  canDropOn(node: TaskNode): boolean;
  dragStart(node: TaskNode): void;
  dragOver(node: TaskNode, mode: DropMode): void;
  dragLeave(node: TaskNode): void;
  drop(node: TaskNode): void;
  dragEnd(): void;
}
