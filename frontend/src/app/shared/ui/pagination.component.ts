import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

/** Page-size choices offered by the selector. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Reusable server-side pagination bar: first / previous / numbered pages / next /
 * last, a page-size selector, a record count, and a loading state.
 *
 * <p>Purely presentational — it emits intent and never fetches. That's what keeps
 * it usable next to any paged endpoint, and what keeps paging server-side: the
 * host re-queries with the new page, rather than slicing a local array.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="pager" role="navigation" aria-label="Pagination">
      <p class="summary" aria-live="polite">
        @if (totalElements() === 0) {
          No results
        } @else {
          <strong>{{ rangeStart() }}–{{ rangeEnd() }}</strong>
          of {{ totalElements() }} {{ totalElements() === 1 ? label() : labelPlural() }}
        }
        @if (loading()) {
          <span class="spin" aria-hidden="true"></span>
        }
      </p>

      <div class="controls">
        <label class="size">
          <span class="size-label">Rows</span>
          <select
            class="select"
            [value]="size()"
            [disabled]="loading()"
            (change)="sizeChange.emit(+$any($event.target).value)"
            aria-label="Rows per page"
          >
            @for (option of sizeOptions; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </label>

        <div class="buttons">
          <button
            type="button"
            class="page-btn"
            aria-label="First page"
            [disabled]="isFirst() || loading()"
            (click)="pageChange.emit(0)"
          >
            «
          </button>
          <button
            type="button"
            class="page-btn"
            aria-label="Previous page"
            [disabled]="isFirst() || loading()"
            (click)="pageChange.emit(page() - 1)"
          >
            ‹
          </button>

          @for (candidate of visiblePages(); track candidate) {
            @if (candidate < 0) {
              <span class="ellipsis" aria-hidden="true">…</span>
            } @else {
              <button
                type="button"
                class="page-btn numbered"
                [class.current]="candidate === page()"
                [attr.aria-current]="candidate === page() ? 'page' : null"
                [attr.aria-label]="'Page ' + (candidate + 1)"
                [disabled]="loading()"
                (click)="pageChange.emit(candidate)"
              >
                {{ candidate + 1 }}
              </button>
            }
          }

          <button
            type="button"
            class="page-btn"
            aria-label="Next page"
            [disabled]="isLast() || loading()"
            (click)="pageChange.emit(page() + 1)"
          >
            ›
          </button>
          <button
            type="button"
            class="page-btn"
            aria-label="Last page"
            [disabled]="isLast() || loading()"
            (click)="pageChange.emit(totalPages() - 1)"
          >
            »
          </button>
        </div>
      </div>
    </nav>
  `,
  styles: [
    `
      .pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding: 0.7rem 0.15rem;
        border-top: 1px solid var(--border);
        margin-top: 0.25rem;
      }

      .summary {
        margin: 0;
        font-size: 0.82rem;
        color: var(--muted);
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .summary strong {
        color: var(--ink-2);
        font-weight: 600;
      }

      .spin {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid var(--border-strong);
        border-top-color: var(--brand);
        animation: spin 0.7s linear infinite;
      }

      .controls {
        display: flex;
        align-items: center;
        gap: 0.9rem;
      }

      .size {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
      }

      .size-label {
        font-size: 0.78rem;
        color: var(--muted);
      }

      .size .select {
        width: auto;
        padding: 0.35rem 0.5rem;
        font-size: 0.82rem;
      }

      .buttons {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
      }

      .page-btn {
        min-width: 30px;
        height: 30px;
        padding: 0 0.4rem;
        border-radius: 7px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--ink-2);
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.14s ease, color 0.14s ease, border-color 0.14s ease;
      }

      .page-btn:hover:not(:disabled) {
        background: var(--surface-2);
        border-color: var(--border);
      }

      .page-btn.current {
        background: var(--brand);
        border-color: var(--brand);
        color: var(--brand-ink);
      }

      .page-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .ellipsis {
        padding: 0 0.2rem;
        color: var(--faint);
        font-size: 0.82rem;
      }

      /* Numbered buttons are the first thing to go on a narrow screen — the
         arrows alone are enough to navigate, and stay comfortably tappable. */
      @media (max-width: 640px) {
        .pager {
          justify-content: center;
        }
        .buttons .page-btn.numbered,
        .ellipsis {
          display: none;
        }
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `,
  ],
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly size = input.required<number>();
  readonly totalElements = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly loading = input(false);
  /** Noun for the record count, e.g. "task" / "tasks". */
  readonly label = input('result');
  readonly labelPlural = input('results');

  readonly pageChange = output<number>();
  readonly sizeChange = output<number>();

  readonly sizeOptions = PAGE_SIZE_OPTIONS;

  readonly isFirst = computed(() => this.page() <= 0);
  readonly isLast = computed(() => this.page() >= this.totalPages() - 1);

  readonly rangeStart = computed(() => this.page() * this.size() + 1);
  readonly rangeEnd = computed(() =>
    Math.min((this.page() + 1) * this.size(), this.totalElements())
  );

  /**
   * A compact window of page numbers around the current page, with `-1` standing
   * in for an ellipsis. Keeps the control a fixed width whether there are 5
   * pages or 5,000.
   */
  readonly visiblePages = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 1) {
      return total === 1 ? [0] : [];
    }
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i);
    }

    const pages = new Set<number>([0, total - 1, current]);
    if (current - 1 > 0) pages.add(current - 1);
    if (current + 1 < total - 1) pages.add(current + 1);

    const sorted = [...pages].sort((a, b) => a - b);
    const withGaps: number[] = [];
    sorted.forEach((value, index) => {
      if (index > 0 && value - sorted[index - 1] > 1) {
        withGaps.push(-1);
      }
      withGaps.push(value);
    });
    return withGaps;
  });
}
