import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
} from '@angular/core';
import { ConfirmService } from '../../core/services/confirm.service';

/**
 * Renders whatever {@link ConfirmService} is currently asking. Mounted once in
 * the app shell, so any component can request a confirmation without hosting a
 * dialog of its own.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pending(); as ask) {
      <div class="overlay" (click)="cancel()">
        <section
          class="dialog card"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          (click)="$event.stopPropagation()"
        >
          <div class="dialog-body">
            <span class="glyph" [class.danger]="ask.danger" aria-hidden="true">
              {{ ask.danger ? '!' : '?' }}
            </span>
            <div>
              <h2 id="confirm-title">{{ ask.title }}</h2>
              <p id="confirm-message">{{ ask.message }}</p>
            </div>
          </div>

          <footer class="dialog-foot">
            <button type="button" class="btn btn-ghost" (click)="cancel()">
              {{ ask.cancelLabel ?? 'Cancel' }}
            </button>
            <button
              type="button"
              class="btn"
              [class.btn-primary]="!ask.danger"
              [class.btn-danger-solid]="ask.danger"
              (click)="confirm()"
            >
              {{ ask.confirmLabel ?? 'Confirm' }}
            </button>
          </footer>
        </section>
      </div>
    }
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 150;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        background: rgba(17, 22, 34, 0.55);
        backdrop-filter: blur(3px);
        animation: fade 0.14s ease;
      }

      .dialog {
        width: 100%;
        max-width: 420px;
        padding: 1.4rem;
        animation: rise 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .dialog-body {
        display: flex;
        gap: 0.9rem;
        align-items: flex-start;
      }

      .glyph {
        flex-shrink: 0;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-weight: 800;
        font-size: 1rem;
        background: var(--brand-tint);
        color: var(--brand-strong);
      }

      .glyph.danger {
        background: var(--high-tint);
        color: var(--high);
      }

      h2 {
        font-size: 1.05rem;
        margin-bottom: 0.3rem;
      }

      p {
        margin: 0;
        font-size: 0.88rem;
        line-height: 1.5;
        color: var(--muted);
      }

      .dialog-foot {
        display: flex;
        justify-content: flex-end;
        gap: 0.55rem;
        margin-top: 1.3rem;
      }

      @media (max-width: 420px) {
        .dialog-foot {
          flex-direction: column-reverse;
        }
        .dialog-foot .btn {
          width: 100%;
        }
      }

      @keyframes fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes rise {
        from { opacity: 0; transform: translateY(10px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  private readonly confirmService = inject(ConfirmService);
  readonly pending = this.confirmService.pending;

  confirm(): void {
    this.confirmService.resolve(true);
  }

  cancel(): void {
    this.confirmService.resolve(false);
  }

  /** Escape always means "no" — never accidentally confirm a destructive action. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pending()) {
      this.cancel();
    }
  }
}
