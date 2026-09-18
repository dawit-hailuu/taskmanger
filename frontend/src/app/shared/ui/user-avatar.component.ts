import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Stable per-user color, cycling through a small fixed palette. */
const AVATAR_PALETTE = ['#10b981', '#7c3aed', '#f59e0b', '#3d4ee0', '#ec4899', '#0891b2', '#dc2626'];

/**
 * One avatar, used everywhere a person needs representing — task rows, card
 * assignees, the navbar. A real photo when one's known; otherwise a coloured
 * initials circle, so there's never a blank space where a person belongs.
 *
 * <p>Always links to {@code /profile} — the only profile route this app has.
 * For the signed-in user's own avatar that's exactly right; for someone
 * else's (e.g. a project teammate shown as a task's owner) it's the closest
 * available destination until the app grows per-user profile pages.
 */
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a
      routerLink="/profile"
      class="user-avatar"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.font-size.px]="size() * 0.42"
      [title]="name()"
      [attr.aria-label]="'Open profile (' + name() + ')'"
    >
      @if (avatarUrl()) {
        <img [src]="avatarUrl()!" alt="" class="avatar-img" />
      } @else {
        <span class="avatar-fallback" [style.background]="color()">{{ initials() }}</span>
      }
    </a>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .user-avatar {
        display: inline-flex;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        text-decoration: none;
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }

      .user-avatar:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-sm);
      }

      .avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .avatar-fallback {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        color: #fff;
        font-weight: 700;
        line-height: 1;
      }
    `,
  ],
})
export class UserAvatarComponent {
  readonly name = input.required<string>();
  readonly avatarUrl = input<string | null | undefined>(null);
  /** userId feeds the fallback colour only — kept separate from `name` since two
   *  people can share a display name but never an id. */
  readonly userId = input<number>(0);
  readonly size = input(26);

  readonly color = computed(() => AVATAR_PALETTE[this.userId() % AVATAR_PALETTE.length]);

  initials(): string {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return '?';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
