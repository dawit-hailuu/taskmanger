import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Loading placeholder that mirrors the shape of the content it stands in for, so
 * the layout doesn't jump once data arrives.
 *
 * <pre>
 *   &lt;app-skeleton variant="text" [lines]="3" /&gt;
 *   &lt;app-skeleton variant="card" [repeat]="4" /&gt;
 *   &lt;app-skeleton variant="row" [repeat]="6" /&gt;
 * </pre>
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sk-wrap" [attr.aria-busy]="true" [attr.aria-label]="ariaLabel()" role="status">
      @for (item of items(); track $index) {
        @switch (variant()) {
          @case ('card') {
            <div class="sk-card">
              <div class="sk-line sk-w-40"></div>
              <div class="sk-line sk-w-90"></div>
              <div class="sk-line sk-w-70"></div>
              <div class="sk-bar"></div>
            </div>
          }
          @case ('row') {
            <div class="sk-row">
              <div class="sk-dot"></div>
              <div class="sk-line sk-w-60"></div>
              <div class="sk-pill"></div>
              <div class="sk-pill sk-narrow"></div>
            </div>
          }
          @case ('stat') {
            <div class="sk-stat">
              <div class="sk-line sk-w-50 sk-short"></div>
              <div class="sk-line sk-w-30 sk-tall"></div>
            </div>
          }
          @default {
            <div class="sk-line" [class.sk-w-70]="$index % 2 === 1"></div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .sk-wrap {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        width: 100%;
      }

      .sk-line,
      .sk-bar,
      .sk-dot,
      .sk-pill {
        /* A single travelling highlight reads as "working" without the
           distracting pulse of an opacity flash. */
        background: linear-gradient(
          90deg,
          var(--surface-2) 0%,
          var(--border) 40%,
          var(--surface-2) 80%
        );
        background-size: 300% 100%;
        animation: sk-shimmer 1.4s ease-in-out infinite;
        border-radius: 6px;
      }

      .sk-line { height: 12px; width: 100%; }
      .sk-short { height: 9px; }
      .sk-tall { height: 22px; }
      .sk-w-30 { width: 30%; }
      .sk-w-40 { width: 40%; }
      .sk-w-50 { width: 50%; }
      .sk-w-60 { width: 60%; }
      .sk-w-70 { width: 70%; }
      .sk-w-90 { width: 90%; }

      .sk-bar { height: 6px; border-radius: 999px; }

      .sk-dot {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        flex-shrink: 0;
      }

      .sk-pill {
        width: 62px;
        height: 18px;
        border-radius: 999px;
        flex-shrink: 0;
      }

      .sk-narrow { width: 40px; }

      .sk-card {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        padding: 0.95rem 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
      }

      .sk-row {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.7rem 0.85rem;
        border-bottom: 1px solid var(--border);
      }

      .sk-stat {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        padding: 0.9rem 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
      }

      @keyframes sk-shimmer {
        0% { background-position: 100% 0; }
        100% { background-position: 0 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        .sk-line,
        .sk-bar,
        .sk-dot,
        .sk-pill {
          animation: none;
          background: var(--surface-2);
        }
      }
    `,
  ],
})
export class SkeletonComponent {
  readonly variant = input<'text' | 'card' | 'row' | 'stat'>('text');
  /** How many placeholders to render. */
  readonly repeat = input(1);
  /** Convenience alias for `repeat` when the variant is `text`. */
  readonly lines = input(0);
  readonly ariaLabel = input('Loading');

  readonly items = computed(() => {
    const count = Math.max(1, this.lines() || this.repeat());
    return Array.from({ length: count });
  });
}
