import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Consistent "nothing here" panel.
 *
 * <p>Takes a glyph, a headline, an explanation and an optional call to action, so
 * every empty list in the app reads the same way — and so "no data yet" is
 * visibly different from "no matches for your filters", which is the distinction
 * users actually need.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" [class.compact]="compact()">
      <span class="glyph" aria-hidden="true">{{ glyph() }}</span>
      <h3>{{ title() }}</h3>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      @if (actionLabel()) {
        <button type="button" class="btn btn-primary" (click)="action.emit()">
          {{ actionLabel() }}
        </button>
      }
      @if (secondaryLabel()) {
        <button type="button" class="btn btn-ghost" (click)="secondaryAction.emit()">
          {{ secondaryLabel() }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.55rem;
        text-align: center;
        padding: 3rem 1.5rem;
      }

      .empty.compact {
        padding: 1.6rem 1rem;
        gap: 0.4rem;
      }

      .glyph {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-size: 1.2rem;
        background: var(--surface-2);
        border: 1px solid var(--border);
        margin-bottom: 0.3rem;
      }

      .compact .glyph {
        width: 34px;
        height: 34px;
        font-size: 1rem;
        border-radius: 10px;
      }

      h3 {
        font-size: 1.02rem;
      }

      .compact h3 {
        font-size: 0.92rem;
      }

      p {
        margin: 0;
        max-width: 42ch;
        font-size: 0.86rem;
        line-height: 1.5;
        color: var(--muted);
      }

      .btn {
        margin-top: 0.6rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly glyph = input('◇');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly actionLabel = input('');
  readonly secondaryLabel = input('');
  /** Tighter padding, for empty states inside a small dashboard card. */
  readonly compact = input(false);

  readonly action = output<void>();
  readonly secondaryAction = output<void>();
}
