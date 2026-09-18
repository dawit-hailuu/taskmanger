import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Toast, ToastKind, ToastService } from '../../core/services/toast.service';

/**
 * Renders the toast stack. Mounted once, in the app shell.
 *
 * <p>`aria-live="polite"` means screen readers announce each toast without
 * interrupting whatever the user is doing.
 */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div class="toast" [class]="'toast-' + toast.kind">
          <span class="toast-icon" aria-hidden="true">{{ icon(toast.kind) }}</span>
          <p class="toast-msg">{{ toast.message }}</p>

          @if (toast.action) {
            <button type="button" class="toast-action" (click)="run(toast)">
              {{ toast.action.label }}
            </button>
          }

          <button
            type="button"
            class="toast-close"
            aria-label="Dismiss notification"
            (click)="toastService.dismiss(toast.id)"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-stack {
        position: fixed;
        z-index: 200;
        bottom: 1.25rem;
        right: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        width: min(380px, calc(100vw - 2.5rem));
        pointer-events: none;
      }

      .toast {
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 0.75rem 0.85rem;
        border-radius: var(--radius);
        background: var(--surface);
        border: 1px solid var(--border);
        border-left: 3px solid var(--muted);
        box-shadow: var(--shadow);
        animation: toast-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .toast-success { border-left-color: var(--low); }
      .toast-error { border-left-color: var(--high); }
      .toast-warning { border-left-color: var(--med); }
      .toast-info { border-left-color: var(--brand); }

      .toast-icon {
        font-size: 0.95rem;
        line-height: 1.35;
      }

      .toast-msg {
        flex: 1;
        margin: 0;
        font-size: 0.86rem;
        line-height: 1.4;
        color: var(--ink);
      }

      .toast-action {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--brand);
        cursor: pointer;
        white-space: nowrap;
      }

      .toast-close {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--faint);
        font-size: 0.8rem;
        line-height: 1;
        padding: 0.15rem;
      }

      .toast-close:hover {
        color: var(--ink);
      }

      /* On phones the stack spans the width and sits above the thumb zone. */
      @media (max-width: 560px) {
        .toast-stack {
          left: 0.75rem;
          right: 0.75rem;
          bottom: 0.75rem;
          width: auto;
        }
      }

      @keyframes toast-in {
        from {
          opacity: 0;
          transform: translateY(10px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `,
  ],
})
export class ToastHostComponent {
  readonly toastService = inject(ToastService);
  readonly toasts = this.toastService.toasts;

  icon(kind: ToastKind): string {
    return { success: '✓', error: '✕', warning: '!', info: 'i' }[kind];
  }

  run(toast: Toast): void {
    toast.action?.run();
    this.toastService.dismiss(toast.id);
  }
}
