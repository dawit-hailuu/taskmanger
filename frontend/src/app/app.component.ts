import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { AppShellComponent } from './shared/shell/app-shell.component';
import { ConfirmDialogComponent } from './shared/ui/confirm-dialog.component';
import { ToastHostComponent } from './shared/ui/toast-host.component';

/**
 * Root component.
 *
 * <p>The shell is always mounted and projects the single {@code router-outlet};
 * only its chrome (adaptive sidebar + top bar) is conditional. Branching around
 * the outlet instead would tear it down and rebuild it on every sign-in and
 * sign-out, right as the router is mid-navigation.
 *
 * <p>The toast host and confirmation dialog are mounted once, outside the routed
 * area, so any component can raise one without owning UI and they survive
 * navigation.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AppShellComponent, ToastHostComponent, ConfirmDialogComponent],
  template: `
    <app-shell [chrome]="isAuthenticated()">
      <router-outlet />
    </app-shell>

    <app-toast-host />
    <app-confirm-dialog />
  `,
})
export class App {
  private readonly auth = inject(AuthService);
  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());
}
