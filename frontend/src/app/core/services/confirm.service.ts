import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive and highlights the risk. */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  result: Subject<boolean>;
}

/**
 * Promise-free replacement for `window.confirm`.
 *
 * <p>Native `confirm()` blocks the whole tab, can't be styled, and is silently
 * suppressed in some embedded contexts. This keeps the same one-line call site
 * while rendering a real, themed, keyboard-accessible dialog:
 *
 * <pre>
 *   this.confirm.ask({ title: 'Delete task', message: '…', danger: true })
 *       .subscribe(ok => { if (ok) … });
 * </pre>
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _pending = signal<PendingConfirm | null>(null);

  /** The dialog currently being asked, or null. Consumed by ConfirmDialogComponent. */
  readonly pending = this._pending.asReadonly();

  ask(options: ConfirmOptions): Observable<boolean> {
    // Only one confirmation can be outstanding; a second ask cancels the first
    // rather than stacking dialogs the user can't tell apart.
    this.resolve(false);

    const result = new Subject<boolean>();
    this._pending.set({ ...options, result });
    return result.asObservable();
  }

  /** Called by the dialog when the user answers (or dismisses). */
  resolve(answer: boolean): void {
    const current = this._pending();
    if (!current) {
      return;
    }
    this._pending.set(null);
    current.result.next(answer);
    current.result.complete();
  }
}
