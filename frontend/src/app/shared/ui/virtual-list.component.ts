import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
  signal,
} from '@angular/core';

/**
 * Fixed-row-height virtual scroller.
 *
 * <p>Only the rows inside the viewport (plus a small buffer) are in the DOM, so a
 * 5,000-row list costs the same as a 20-row one. Written against plain Angular
 * rather than pulling in `@angular/cdk` — one small component beats a new runtime
 * dependency for the single behaviour we need.
 *
 * <p>Rows must all be {@link itemHeight} tall; that constraint is what lets the
 * visible window be derived arithmetically instead of measured.
 *
 * <pre>
 *   &lt;app-virtual-list [items]="rows()" [itemHeight]="52" [viewportHeight]="520"&gt;
 *     &lt;ng-template let-row let-i="index"&gt;…&lt;/ng-template&gt;
 *   &lt;/app-virtual-list&gt;
 * </pre>
 */
@Component({
  selector: 'app-virtual-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    <div
      class="viewport"
      [style.height.px]="viewportHeight()"
      (scroll)="onScroll($event)"
      tabindex="0"
    >
      <!-- Full-height spacer keeps the scrollbar honest about the real list length. -->
      <div class="canvas" [style.height.px]="totalHeight()">
        <div class="window" [style.transform]="'translateY(' + offsetY() + 'px)'">
          @for (entry of visible(); track entry.index) {
            <div class="row" [style.height.px]="itemHeight()">
              <ng-container
                [ngTemplateOutlet]="rowTemplate()!"
                [ngTemplateOutletContext]="{ $implicit: entry.item, index: entry.index }"
              />
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .viewport {
        overflow-y: auto;
        overflow-x: hidden;
        position: relative;
        /* Momentum scrolling on iOS, and no scroll-chaining to the page. */
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }

      .canvas {
        position: relative;
      }

      .window {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        will-change: transform;
      }

      .row {
        box-sizing: border-box;
      }
    `,
  ],
})
export class VirtualListComponent<T> {
  readonly items = input.required<readonly T[]>();
  /** Every row must be exactly this tall, in pixels. */
  readonly itemHeight = input(52);
  readonly viewportHeight = input(520);
  /** Extra rows rendered above and below the viewport, to hide fast scrolling. */
  readonly buffer = input(6);

  private readonly rowTemplateRef = contentChild(TemplateRef);
  readonly rowTemplate = computed(() => this.rowTemplateRef());

  private readonly scrollTop = signal(0);

  readonly totalHeight = computed(() => this.items().length * this.itemHeight());

  private readonly firstIndex = computed(() => {
    const raw = Math.floor(this.scrollTop() / this.itemHeight()) - this.buffer();
    return Math.max(0, raw);
  });

  private readonly lastIndex = computed(() => {
    const rowsInView = Math.ceil(this.viewportHeight() / this.itemHeight());
    const raw = this.firstIndex() + rowsInView + this.buffer() * 2;
    return Math.min(this.items().length, raw);
  });

  /** Translate the window so the rendered slice lines up with the scroll offset. */
  readonly offsetY = computed(() => this.firstIndex() * this.itemHeight());

  readonly visible = computed(() =>
    this.items()
      .slice(this.firstIndex(), this.lastIndex())
      .map((item, offset) => ({ item, index: this.firstIndex() + offset }))
  );

  onScroll(event: Event): void {
    this.scrollTop.set((event.target as HTMLElement).scrollTop);
  }
}
