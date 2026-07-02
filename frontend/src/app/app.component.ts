import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { NavbarComponent } from './shared/navbar/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    @if (showNavbar()) {
      <app-navbar />
    }
    <router-outlet />
  `,
})
export class App {
  private readonly auth = inject(AuthService);
  readonly showNavbar = computed(() => this.auth.isAuthenticated());
}
