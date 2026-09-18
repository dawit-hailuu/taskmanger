import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { ThemeService } from '../../core/services/theme.service';
import { NAV_ITEMS } from './nav-items';

const SIDEBAR_COLLAPSED_KEY = 'taskflow.sidebarCollapsed';

/**
 * DOM event fired when the user presses `n`. Pages that can create something
 * listen for it, so the shell never has to know what page is mounted.
 */
export const NEW_ITEM_SHORTCUT = 'taskflow:new-item';

/**
 * Authenticated application shell: adaptive sidebar, top bar, and the routed page.
 *
 * <p>One layout, three behaviours, driven purely by CSS breakpoints so there's no
 * resize listener and no layout thrash:
 * <ul>
 *   <li><strong>Desktop</strong> — persistent sidebar, collapsible to icons only
 *       (remembered across sessions).</li>
 *   <li><strong>Tablet</strong> — sidebar starts collapsed to icons, reclaiming
 *       width for content.</li>
 *   <li><strong>Mobile</strong> — sidebar becomes an off-canvas drawer behind a
 *       scrim, opened from the top bar.</li>
 * </ul>
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div
      class="shell"
      [class.bare]="!chrome()"
      [class.collapsed]="collapsed()"
      [class.drawer-open]="drawerOpen()"
    >
      @if (chrome()) {
      <!-- Skip link: the first tab stop on every page. -->
      <a class="skip" href="#main">Skip to content</a>

      <aside class="sidebar">
        <div class="side-head">
          <a class="brand" routerLink="/dashboard" (click)="closeDrawer()">
            <span class="brand-mark" aria-hidden="true">
              <span class="tick tick-high"></span>
              <span class="tick tick-med"></span>
              <span class="tick tick-low"></span>
            </span>
            <span class="brand-name">Taskflow</span>
          </a>
        </div>

        <nav class="side-nav" aria-label="Primary">
          @for (item of navItems; track item.route) {
            <a
              class="side-link"
              [routerLink]="item.route"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: !!item.exact }"
              [title]="item.label"
              (click)="closeDrawer()"
            >
              <span class="side-glyph" aria-hidden="true">{{ item.glyph }}</span>
              <span class="side-label">{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="side-foot">
          <button
            type="button"
            class="side-link as-button"
            (click)="toggleCollapsed()"
            [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          >
            <span class="side-glyph" aria-hidden="true">{{ collapsed() ? '»' : '«' }}</span>
            <span class="side-label">Collapse</span>
          </button>
        </div>
      </aside>

      <!-- Tapping the scrim closes the mobile drawer. -->
      <div class="scrim" (click)="closeDrawer()" aria-hidden="true"></div>

      <header class="topbar">
        <button
          type="button"
          class="hamburger"
          aria-label="Open navigation"
          [attr.aria-expanded]="drawerOpen()"
          (click)="drawerOpen.set(!drawerOpen())"
        >
          ☰
        </button>

        <span class="topbar-brand">Taskflow</span>

        <div class="topbar-spacer"></div>

        <button
          type="button"
          class="btn btn-ghost btn-icon"
          (click)="theme.toggle()"
          [attr.aria-label]="
            theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
          "
          [attr.aria-pressed]="theme.theme() === 'dark'"
        >
          <span aria-hidden="true">{{ theme.theme() === 'dark' ? '☀' : '☾' }}</span>
        </button>

        @if (user(); as u) {
          <div class="account">
            <a routerLink="/profile" class="who" title="View profile">
              @if (avatarUrl(); as url) {
                <img [src]="url" alt="" class="avatar-img" />
              } @else {
                <span class="avatar" aria-hidden="true">{{ initial(u.name) }}</span>
              }
              <span class="who-text">
                <span class="who-name">{{ u.name }}</span>
                <span class="who-email">{{ u.email }}</span>
              </span>
            </a>
            <button type="button" class="btn btn-ghost btn-sm" (click)="logout()">Sign out</button>
          </div>
        }
      </header>
      }

      <!--
        Exactly one projection slot, and exactly one <router-outlet> in the whole
        app (owned by the root component). Branching around the outlet instead
        would destroy and recreate it every time the user signs in or out.
      -->
      <main id="main" class="content" tabindex="-1">
        <ng-content />
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .shell {
        --sidebar-w: 232px;
        --sidebar-w-collapsed: 62px;
        --topbar-h: 58px;

        display: grid;
        grid-template-columns: var(--sidebar-w) 1fr;
        grid-template-rows: var(--topbar-h) 1fr;
        grid-template-areas:
          'sidebar topbar'
          'sidebar content';
        min-height: 100vh;
        transition: grid-template-columns 0.2s ease;
      }

      .shell.collapsed {
        grid-template-columns: var(--sidebar-w-collapsed) 1fr;
      }

      /* Signed out: no chrome, just the page. */
      .shell.bare {
        display: block;
        min-height: 100vh;
      }

      .skip {
        position: absolute;
        left: -9999px;
        top: 0;
        z-index: 300;
        padding: 0.6rem 0.9rem;
        background: var(--surface);
        border: 1px solid var(--brand);
        border-radius: var(--radius-sm);
        font-size: 0.85rem;
        font-weight: 600;
      }

      .skip:focus {
        left: 0.75rem;
        top: 0.75rem;
      }

      /* ---------- sidebar ---------- */
      .sidebar {
        grid-area: sidebar;
        display: flex;
        flex-direction: column;
        background: var(--surface);
        border-right: 1px solid var(--border);
        position: sticky;
        top: 0;
        height: 100vh;
        overflow-y: auto;
        overflow-x: hidden;
        z-index: 40;
      }

      .side-head {
        height: var(--topbar-h);
        display: flex;
        align-items: center;
        padding: 0 0.9rem;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        text-decoration: none;
        color: var(--ink);
        min-width: 0;
      }

      .brand-mark {
        display: inline-flex;
        gap: 3px;
        align-items: flex-end;
        height: 20px;
        flex-shrink: 0;
      }

      .tick { width: 4px; border-radius: 2px; display: block; }
      .tick-high { height: 20px; background: var(--high); }
      .tick-med { height: 14px; background: var(--med); }
      .tick-low { height: 9px; background: var(--low); }

      .brand-name {
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 1.08rem;
        letter-spacing: -0.02em;
        white-space: nowrap;
      }

      .side-nav {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        padding: 0.75rem 0.5rem;
        flex: 1;
      }

      .side-link {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.55rem 0.65rem;
        border-radius: var(--radius-sm);
        color: var(--ink-2);
        font-size: 0.88rem;
        font-weight: 600;
        text-decoration: none;
        white-space: nowrap;
        border: 1px solid transparent;
        transition: background-color 0.13s ease, color 0.13s ease;
      }

      .side-link.as-button {
        background: none;
        cursor: pointer;
        font-family: inherit;
        width: 100%;
        text-align: left;
      }

      .side-link:hover {
        background: var(--surface-2);
        color: var(--ink);
        text-decoration: none;
      }

      .side-link.active {
        background: var(--brand-tint);
        color: var(--brand-strong);
      }

      .side-glyph {
        flex-shrink: 0;
        width: 20px;
        text-align: center;
        font-size: 0.98rem;
      }

      .side-foot {
        padding: 0.5rem;
        border-top: 1px solid var(--border);
        flex-shrink: 0;
      }

      .collapsed .brand-name,
      .collapsed .side-label {
        display: none;
      }

      .collapsed .side-link {
        justify-content: center;
        gap: 0;
      }

      .collapsed .side-head {
        justify-content: center;
        padding: 0;
      }

      /* ---------- top bar ---------- */
      .topbar {
        grid-area: topbar;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0 1rem;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 30;
      }

      .hamburger {
        display: none;
        background: none;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        color: var(--ink-2);
        font-size: 1rem;
        line-height: 1;
        padding: 0.4rem 0.55rem;
        cursor: pointer;
      }

      .topbar-brand {
        display: none;
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 1rem;
      }

      .topbar-spacer {
        flex: 1;
      }

      .account {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .who {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        text-decoration: none;
        color: inherit;
        min-width: 0;
      }

      .who:hover {
        text-decoration: none;
      }

      .who-text {
        display: flex;
        flex-direction: column;
        line-height: 1.25;
        min-width: 0;
      }

      .who-name {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--ink);
      }

      .who-email {
        font-size: 0.72rem;
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 180px;
      }

      .avatar,
      .avatar-img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .avatar-img {
        object-fit: cover;
      }

      .avatar {
        background: var(--brand-tint);
        color: var(--brand-strong);
        display: inline-grid;
        place-items: center;
        font-weight: 700;
        font-size: 0.86rem;
      }

      .btn-sm {
        padding: 0.45rem 0.7rem;
        font-size: 0.82rem;
      }

      /* ---------- content ---------- */
      .content {
        grid-area: content;
        min-width: 0;
        outline: none;
      }

      .scrim {
        display: none;
      }

      /* Tablet: icons only, so the content column keeps its width. */
      @media (max-width: 1080px) {
        .shell {
          grid-template-columns: var(--sidebar-w-collapsed) 1fr;
        }
        .shell .brand-name,
        .shell .side-label {
          display: none;
        }
        .shell .side-link {
          justify-content: center;
          gap: 0;
        }
        .shell .side-head {
          justify-content: center;
          padding: 0;
        }
        .side-foot {
          display: none;
        }
      }

      /* Mobile: off-canvas drawer. */
      @media (max-width: 760px) {
        .shell,
        .shell.collapsed {
          grid-template-columns: 1fr;
          grid-template-areas:
            'topbar'
            'content';
        }

        .sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: var(--sidebar-w);
          transform: translateX(-100%);
          transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: var(--shadow-lg);
          z-index: 120;
        }

        .drawer-open .sidebar {
          transform: translateX(0);
        }

        /* Labels always show in the drawer — there's room, and icon-only nav is
           harder to hit and read on a phone. */
        .shell .brand-name,
        .shell .side-label {
          display: inline;
        }
        .shell .side-link {
          justify-content: flex-start;
          gap: 0.7rem;
          padding: 0.7rem 0.75rem;
        }
        .shell .side-head {
          justify-content: flex-start;
          padding: 0 0.9rem;
        }

        .drawer-open .scrim {
          display: block;
          position: fixed;
          inset: 0;
          background: rgba(17, 22, 34, 0.5);
          z-index: 110;
          animation: fade 0.16s ease;
        }

        .hamburger,
        .topbar-brand {
          display: inline-block;
        }

        .who-text {
          display: none;
        }
      }

      @media (max-width: 420px) {
        .topbar {
          padding: 0 0.7rem;
          gap: 0.4rem;
        }
        .topbar-brand {
          display: none;
        }
      }

      @keyframes fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `,
  ],
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  /** Show the sidebar and top bar. False on the auth screens. */
  readonly chrome = input(true);

  readonly navItems = NAV_ITEMS;
  readonly user = this.auth.user;
  readonly avatarUrl = computed(() => this.profileService.profile()?.avatarUrl ?? null);

  readonly collapsed = signal(this.readCollapsed());
  readonly drawerOpen = signal(false);

  constructor() {
    /*
     * The shell outlives sign-in (it's always mounted, only its chrome is
     * conditional), so this has to react to the session appearing rather than run
     * once on init — otherwise the avatar would stay missing until a page reload.
     */
    effect(() => {
      if (this.auth.isAuthenticated() && !this.profileService.profile()) {
        this.profileService.get().subscribe({ error: () => undefined });
      }
    });
  }

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
  }

  initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDrawer();
  }

  /**
   * Global shortcuts, following the convention used by Linear, Jira and Notion:
   * {@code /} focuses search, {@code n} starts a new item, {@code t} jumps to the
   * task list. Deliberately few, and always ignored while the user is typing so
   * they can never hijack a search box or a title field.
   *
   * <p>{@code n} is broadcast as a DOM event rather than wired to a page, so the
   * shell doesn't need to know which page is mounted or what "new" means there.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.isTypingContext(event) || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    switch (event.key) {
      case '/': {
        const search = document.querySelector<HTMLInputElement>('[data-shortcut="search"]');
        if (search) {
          event.preventDefault();
          search.focus();
          search.select();
        }
        break;
      }
      case 'n':
        event.preventDefault();
        document.dispatchEvent(new CustomEvent(NEW_ITEM_SHORTCUT));
        break;
      case 't':
        event.preventDefault();
        void this.router.navigate(['/tasks']);
        break;
      default:
        break;
    }
  }

  private isTypingContext(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    );
  }

  private readCollapsed(): boolean {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  }
}
