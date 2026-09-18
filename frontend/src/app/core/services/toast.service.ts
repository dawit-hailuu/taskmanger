import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional inline action, e.g. "Undo". */
  action?: { label: string; run: () => void };
}

/** How long each kind stays on screen. Errors linger — they need reading. */
const DEFAULT_DURATION_MS: Record<ToastKind, number> = {
  success: 3200,
  info: 3800,
  warning: 5000,
  error: 6000,
};

/** Beyond this, older toasts are dropped so the stack can't cover the page. */
const MAX_VISIBLE = 4;

/**
 * Application-wide transient notifications.
 *
 * <p>A signal-backed queue rather than a component tree concern, so any service
 * or component can report an outcome without owning UI. `ToastHostComponent`
 * renders whatever is in `toasts()`.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string, action?: Toast['action']): number {
    return this.push('success', message, action);
  }

  error(message: string, action?: Toast['action']): number {
    return this.push('error', message, action);
  }

  info(message: string, action?: Toast['action']): number {
    return this.push('info', message, action);
  }

  warning(message: string, action?: Toast['action']): number {
    return this.push('warning', message, action);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this._toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this._toasts.set([]);
  }

  private push(kind: ToastKind, message: string, action?: Toast['action']): number {
    const id = this.nextId++;
    const toast: Toast = { id, kind, message, action };

    this._toasts.update((list) => [...list, toast].slice(-MAX_VISIBLE));

    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), DEFAULT_DURATION_MS[kind])
    );
    return id;
  }
}
