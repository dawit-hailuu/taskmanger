import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import {
  PRIORITY_LABELS,
  Priority,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  TaskNode,
  TaskStatus,
} from '../../core/models/task.model';
import { ProgressBarComponent } from '../ui/progress-bar.component';
import { TaskTreeApi } from './task-tree-api';

/**
 * One row of the task tree — and, for its children, the tree again.
 *
 * <p>The component references itself in its own template (wired up with
 * `forwardRef`, since the class isn't defined yet when the decorator runs). That
 * self-reference is what makes nesting unlimited: there is no depth constant, no
 * level-specific markup, and no special case for "subtask of a subtask". Depth
 * only ever feeds the indentation width.
 */
@Component({
  selector: 'app-task-tree-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressBarComponent, forwardRef(() => TaskTreeNodeComponent)],
  template: `
    <div
      class="node"
      [class.dragging]="api().draggingId() === node().id"
      [class.drop-into]="isDropTarget() && api().dropMode() === 'into'"
      [class.drop-before]="isDropTarget() && api().dropMode() === 'before'"
      [class.busy]="api().isBusy(node().id)"
      [class.done]="isDone()"
      [style.--indent.px]="api().indentPx(node().depth)"
      draggable="true"
      (dragstart)="onDragStart($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="api().dragLeave(node())"
      (drop)="onDrop($event)"
      (dragend)="api().dragEnd()"
    >
      <!-- Guide line back to the parent; a root row has no parent to point at. -->
      <span
        class="rail"
        [class.visible]="api().indentPx(node().depth) > 0"
        aria-hidden="true"
      ></span>

      <button
        type="button"
        class="chevron"
        [class.open]="expanded()"
        [class.hidden]="!hasChildren()"
        [attr.aria-expanded]="hasChildren() ? expanded() : null"
        [attr.aria-label]="expanded() ? 'Collapse subtasks' : 'Expand subtasks'"
        [disabled]="!hasChildren()"
        (click)="api().toggleExpanded(node().id)"
      >
        ▸
      </button>

      <input
        type="checkbox"
        class="check"
        [checked]="isDone()"
        [attr.aria-label]="'Mark \\'' + node().title + '\\' complete'"
        (change)="api().toggleComplete(node(), $any($event.target).checked)"
      />

      <button type="button" class="title" (click)="api().openDetail(node())">
        {{ node().title }}
      </button>

      <span class="badge" [class]="priorityBadgeClass()">
        {{ priorityLabel() }}
      </span>

      <span class="badge" [class]="statusBadgeClass()">
        {{ statusLabel() }}
      </span>

      @if (node().dueDate) {
        <span class="due" [class.overdue]="isOverdue()">{{ shortDate(node().dueDate!) }}</span>
      }

      <!-- Weight is editable in place: it's the number that drives the whole
           weighted-progress calculation, so it belongs next to the progress bar. -->
      <label class="weight" [title]="weightHint()">
        <span class="weight-key">w</span>
        <input
          type="number"
          min="1"
          class="weight-input"
          [value]="node().weight"
          [disabled]="api().isBusy(node().id)"
          [attr.aria-label]="'Weight for ' + node().title"
          (keydown.enter)="commitWeight($any($event.target))"
          (blur)="commitWeight($any($event.target))"
        />
      </label>

      <app-progress-bar class="meter" [value]="node().progress" />

      <div class="actions">
        <button
          type="button"
          class="icon-btn"
          title="Add subtask"
          aria-label="Add subtask"
          (click)="api().startAdd(node().id)"
        >
          +
        </button>
        <button
          type="button"
          class="icon-btn danger"
          title="Delete task and its subtasks"
          aria-label="Delete task and its subtasks"
          (click)="api().remove(node())"
        >
          ✕
        </button>
      </div>
    </div>

    @if (api().addingUnder() === node().id) {
      <div class="add-row" [style.--indent.px]="api().indentPx(node().depth + 1)">
        <input
          type="text"
          class="input add-title"
          placeholder="Subtask title…"
          autofocus
          [value]="api().draftTitle()"
          (input)="api().setDraftTitle($any($event.target).value)"
          (keydown.enter)="api().submitAdd(node())"
          (keydown.escape)="api().cancelAdd()"
        />
        <input
          type="number"
          class="input add-weight"
          min="1"
          [max]="node().availableChildWeight || null"
          [placeholder]="'w ' + (node().availableChildWeight || 1)"
          [value]="api().draftWeight() ?? ''"
          (input)="api().setDraftWeight(parseWeight($any($event.target).value))"
          (keydown.enter)="api().submitAdd(node())"
        />
        <button type="button" class="btn btn-primary btn-xs" (click)="api().submitAdd(node())">
          Add
        </button>
        <button type="button" class="btn btn-ghost btn-xs" (click)="api().cancelAdd()">
          Cancel
        </button>
        <span class="budget">
          {{ node().allocatedChildWeight }} / {{ node().weight }} allocated
        </span>
      </div>
    }

    @if (expanded()) {
      @for (child of node().children; track child.id) {
        <app-task-tree-node [node]="child" [api]="api()" />
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .node {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.6rem 0.4rem calc(0.6rem + var(--indent, 0px));
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
        min-height: 38px;
        transition: background-color 0.12s ease, border-color 0.12s ease;
      }

      .node:hover {
        background: var(--surface-2);
      }

      .node.busy {
        opacity: 0.55;
        pointer-events: none;
      }

      .node.dragging {
        opacity: 0.4;
      }

      /* "Drop inside" outlines the whole row; "drop before" draws an insertion
         line. Two visually distinct affordances for two different outcomes. */
      .node.drop-into {
        border-color: var(--brand);
        background: var(--brand-tint);
      }

      .node.drop-before::before {
        content: '';
        position: absolute;
        left: calc(var(--indent, 0px) + 0.6rem);
        right: 0.6rem;
        top: -1px;
        height: 2px;
        border-radius: 2px;
        background: var(--brand);
      }

      /* Guide line showing which parent a nested row belongs to. */
      .rail {
        display: none;
        position: absolute;
        left: calc(var(--indent, 0px) + 0.15rem);
        top: 0;
        bottom: 0;
        width: 1px;
        background: var(--border);
      }

      .rail.visible {
        display: block;
      }

      .chevron {
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        display: grid;
        place-items: center;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--muted);
        font-size: 0.62rem;
        padding: 0;
        transition: transform 0.15s ease;
      }

      .chevron.open {
        transform: rotate(90deg);
      }

      .chevron.hidden {
        visibility: hidden;
        cursor: default;
      }

      .check {
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
        font-size: 0.88rem;
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

      .done .title {
        color: var(--muted);
        text-decoration: line-through;
      }

      .badge {
        flex-shrink: 0;
      }

      .due {
        flex-shrink: 0;
        font-size: 0.74rem;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
      }

      .due.overdue {
        color: var(--high);
        font-weight: 700;
      }

      .weight {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: 0.15rem;
        padding: 0.1rem 0.3rem;
        border-radius: 6px;
        background: var(--surface-2);
        border: 1px solid var(--border);
      }

      .weight-key {
        font-size: 0.66rem;
        font-weight: 700;
        color: var(--faint);
        text-transform: uppercase;
      }

      .weight-input {
        width: 3.1rem;
        border: none;
        background: transparent;
        color: var(--ink-2);
        font: inherit;
        font-size: 0.74rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        padding: 0;
        text-align: right;
      }

      .weight-input:focus {
        outline: none;
        color: var(--brand-strong);
      }

      .meter {
        flex: 0 0 120px;
        max-width: 120px;
      }

      .actions {
        flex-shrink: 0;
        display: inline-flex;
        gap: 0.1rem;
        /* Kept out of the way until the row is hovered or focused, so a deep tree
           stays readable instead of being a wall of buttons. */
        opacity: 0;
        transition: opacity 0.12s ease;
      }

      .node:hover .actions,
      .node:focus-within .actions {
        opacity: 1;
      }

      .icon-btn {
        width: 22px;
        height: 22px;
        display: grid;
        place-items: center;
        border-radius: 5px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1;
        cursor: pointer;
      }

      .icon-btn:hover {
        color: var(--ink);
        border-color: var(--border-strong);
      }

      .icon-btn.danger:hover {
        color: var(--high);
        border-color: var(--high);
        background: var(--high-tint);
      }

      .add-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
        padding: 0.4rem 0.6rem 0.5rem calc(0.6rem + var(--indent, 0px));
      }

      .add-title {
        flex: 1 1 180px;
        min-width: 0;
        font-size: 0.84rem;
        padding: 0.35rem 0.55rem;
      }

      .add-weight {
        width: 5.5rem;
        font-size: 0.84rem;
        padding: 0.35rem 0.55rem;
      }

      .btn-xs {
        padding: 0.35rem 0.6rem;
        font-size: 0.78rem;
      }

      .budget {
        font-size: 0.72rem;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
      }

      /* On phones the metadata chips wrap under the title instead of squeezing it. */
      @media (max-width: 720px) {
        .node {
          flex-wrap: wrap;
          padding-top: 0.5rem;
          padding-bottom: 0.5rem;
        }
        .title {
          flex: 1 1 100%;
          order: -1;
          padding-left: 2.2rem;
        }
        .meter {
          flex: 1 1 90px;
          max-width: none;
        }
        .actions {
          opacity: 1;
          margin-left: auto;
        }
      }
    `,
  ],
})
export class TaskTreeNodeComponent {
  readonly node = input.required<TaskNode>();
  readonly api = input.required<TaskTreeApi>();

  readonly hasChildren = computed(() => this.node().children.length > 0);
  readonly expanded = computed(() => this.api().isExpanded(this.node().id));
  readonly isDone = computed(() => this.node().status === 'COMPLETED');
  readonly isDropTarget = computed(() => this.api().dropTargetId() === this.node().id);

  readonly isOverdue = computed(() => {
    const node = this.node();
    if (!node.dueDate || TERMINAL_STATUSES.includes(node.status)) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(`${node.dueDate}T00:00:00`).getTime() < today.getTime();
  });

  readonly weightHint = computed(() => {
    const node = this.node();
    return `Weight ${node.weight}. Subtasks use ${node.allocatedChildWeight} of it, ${node.availableChildWeight} still free.`;
  });

  readonly priorityLabel = computed(() => PRIORITY_LABELS[this.node().priority]);
  readonly statusLabel = computed(() => STATUS_LABELS[this.node().status]);

  readonly priorityBadgeClass = computed(
    () =>
      ({
        LOW: 'badge-low',
        MEDIUM: 'badge-med',
        HIGH: 'badge-high',
        URGENT: 'badge-urgent',
      })[this.node().priority as Priority]
  );

  readonly statusBadgeClass = computed(
    () =>
      ({
        TODO: 'badge-todo',
        IN_PROGRESS: 'badge-progress',
        REVIEW: 'badge-review',
        COMPLETED: 'badge-done',
        CANCELLED: 'badge-cancelled',
      })[this.node().status as TaskStatus]
  );

  // ---- drag & drop ----

  onDragStart(event: DragEvent): void {
    event.stopPropagation();
    // Required for Firefox to start a drag at all.
    event.dataTransfer?.setData('text/plain', String(this.node().id));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    this.api().dragStart(this.node());
  }

  onDragOver(event: DragEvent): void {
    if (!this.api().canDropOn(this.node())) {
      return;
    }
    // preventDefault is what marks this element as a valid drop target.
    event.preventDefault();
    event.stopPropagation();

    // Top quarter of the row means "insert above me as a sibling"; anywhere
    // else means "nest inside me".
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const mode = event.clientY - bounds.top < bounds.height * 0.25 ? 'before' : 'into';
    this.api().dragOver(this.node(), mode);
  }

  onDrop(event: DragEvent): void {
    if (!this.api().canDropOn(this.node())) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.api().drop(this.node());
  }

  // ---- inline editing ----

  commitWeight(input: HTMLInputElement): void {
    const parsed = Number.parseInt(input.value, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed === this.node().weight) {
      input.value = String(this.node().weight);
      return;
    }
    this.api().changeWeight(this.node(), parsed);
  }

  parseWeight(raw: string): number | null {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  shortDate(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
}
