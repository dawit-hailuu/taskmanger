import { TaskNode, TaskStatus } from '../../core/models/task.model';

/**
 * Everything a row needs, passed down as a single object — same reasoning as
 * {@code TaskTreeApi}: the row tree is recursive and can nest arbitrarily, so
 * bubbling `output()` events level by level would mean every intermediate row
 * re-emitting every child event. One context object keeps each row purely
 * presentational; all state and HTTP work lives in the owning container.
 */
export interface TaskStatusListApi {
  isExpanded(id: number): boolean;
  toggleExpanded(id: number): void;
  /** True while a request for this row is in flight. */
  isBusy(id: number): boolean;

  openMenuId(): number | null;
  toggleMenu(id: number, event: Event): void;

  changeStatus(node: TaskNode, status: TaskStatus): void;
  openDetail(node: TaskNode): void;
  editNode(node: TaskNode): void;
  duplicateNode(node: TaskNode): void;
  archiveNode(node: TaskNode): void;
  restoreNode(node: TaskNode): void;
  removeNode(node: TaskNode): void;

  // ---- inline "add subtask", revealed by hovering a row ----
  addingUnder(): number | null;
  startAdd(id: number): void;
  cancelAdd(): void;
  draftTitle(): string;
  setDraftTitle(value: string): void;
  /** Null means "let the server decide" — the parent's remaining weight budget. */
  draftWeight(): number | null;
  setDraftWeight(value: number | null): void;
  submitAdd(node: TaskNode): void;
}
