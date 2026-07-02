import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  template: `
    <header class="nav">
      <div class="container nav-inner">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">
            <span class="tick tick-high"></span>
            <span class="tick tick-med"></span>
            <span class="tick tick-low"></span>
          </span>
          <span class="brand-name">Taskflow</span>
        </div>

        @if (user(); as u) {
          <div class="account">
            <div class="who">
              <span class="who-name">{{ u.name }}</span>
              <span class="who-email">{{ u.email }}</span>
            </div>
            <span class="avatar" aria-hidden="true">{{ initial(u.name) }}</span>
            <button type="button" class="btn btn-ghost" (click)="logout()">
              Sign out
            </button>
          </div>
        }
      </div>
    </header>
  `,
  styles: [
    `
      .nav {
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        box-shadow: var(--shadow-sm);
        position: sticky;
        top: 0;
        z-index: 20;
      }

      .nav-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 62px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .brand-mark {
        display: inline-flex;
        gap: 3px;
        align-items: flex-end;
        height: 20px;
      }

      .tick {
        width: 4px;
        border-radius: 2px;
        display: block;
      }
      .tick-high { height: 20px; background: var(--high); }
      .tick-med { height: 14px; background: var(--med); }
      .tick-low { height: 9px; background: var(--low); }

      .brand-name {
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 1.15rem;
        letter-spacing: -0.02em;
      }

      .account {
        display: flex;
        align-items: center;
        gap: 0.85rem;
      }

      .who {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1.2;
      }

      .who-name {
        font-weight: 600;
        font-size: 0.88rem;
      }

      .who-email {
        font-size: 0.75rem;
        color: var(--muted);
      }

      .avatar {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--brand-tint);
        color: var(--brand-strong);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 0.9rem;
      }

      @media (max-width: 520px) {
        .who {
          display: none;
        }
      }
    `,
  ],
})
export class NavbarComponent {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.user;

  logout(): void {
    this.auth.logout();
  }

  initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }
}
