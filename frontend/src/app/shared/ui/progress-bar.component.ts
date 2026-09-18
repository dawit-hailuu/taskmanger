import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Weighted-progress meter.
 *
 * <p>Colour tracks completeness rather than being decorative, so a row's state is
 * legible at a glance in a dense tree: red-ish while barely started, amber in
 * flight, green once done.
 */
@Component({
  selector: 'app-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="meter" [class.slim]="slim()">
      <div
        class="track"
        role="progressbar"
        [attr.aria-valuenow]="clamped()"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-label]="ariaLabel()"
      >
        <div class="fill" [class]="tone()" [style.width.%]="clamped()"></div>
      </div>
      @if (showValue()) {
        <span class="value" [class]="tone()">{{ clamped() }}%</span>
      }
    </div>
  `,
  styles: [
    `
      .meter {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
      }

      .track {
        flex: 1;
        height: 6px;
        min-width: 40px;
        border-radius: 999px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        overflow: hidden;
      }

      .slim .track {
        height: 4px;
      }

      .fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .fill.tone-none { background: var(--border-strong); }
      .fill.tone-early { background: var(--med); }
      .fill.tone-mid { background: var(--brand); }
      .fill.tone-done { background: var(--done); }

      .value {
        font-size: 0.72rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .value.tone-none { color: var(--faint); }
      .value.tone-early { color: var(--med); }
      .value.tone-mid { color: var(--brand-strong); }
      .value.tone-done { color: var(--done); }
    `,
  ],
})
export class ProgressBarComponent {
  readonly value = input.required<number>();
  readonly showValue = input(true);
  readonly slim = input(false);
  readonly ariaLabel = input('Weighted progress');

  readonly clamped = computed(() => Math.max(0, Math.min(100, Math.round(this.value()))));

  readonly tone = computed(() => {
    const value = this.clamped();
    if (value >= 100) return 'tone-done';
    if (value === 0) return 'tone-none';
    return value < 40 ? 'tone-early' : 'tone-mid';
  });
}
