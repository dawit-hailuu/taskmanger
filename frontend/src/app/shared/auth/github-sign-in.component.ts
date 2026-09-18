import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GoogleAuthService } from '../../core/services/google-auth.service';

/** Where sessionStorage keeps the CSRF state param across the GitHub redirect round-trip. */
export const GITHUB_OAUTH_STATE_KEY = 'taskflow.github.oauthState';
/** Where sessionStorage remembers the user's "keep me signed in" choice across the same round-trip. */
export const GITHUB_OAUTH_REMEMBER_KEY = 'taskflow.github.rememberMe';

/**
 * "Continue with GitHub" — self-hides when the server hasn't configured a
 * GitHub OAuth App, same rule {@link GoogleSignInComponent} follows.
 *
 * <p>Unlike Google's Identity Services (a same-page popup that hands back a
 * credential directly), GitHub's OAuth is the classic Authorization Code flow:
 * clicking the button is a full-page redirect to github.com, and GitHub
 * redirects back to {@code /auth/github/callback} with a one-time code. That
 * callback route (a separate component) is what actually completes the sign-in
 * — this component's only job is starting the redirect safely, with a random
 * `state` value stashed in sessionStorage so the callback can confirm the
 * response wasn't forged or replayed.
 */
@Component({
  selector: 'app-github-sign-in',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enabled()) {
      <button
        type="button"
        class="social-btn"
        [disabled]="starting()"
        (click)="start()"
      >
        @if (starting()) {
          <span class="social-spinner" aria-hidden="true"></span> Redirecting to GitHub…
        } @else {
          <svg class="social-icon" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
            <path
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53
                 .63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
                 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82
                 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
                 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
            />
          </svg>
          Continue with GitHub
        }
      </button>
    }
  `,
})
export class GithubSignInComponent {
  private readonly googleAuth = inject(GoogleAuthService);
  private readonly destroyRef = inject(DestroyRef);

  /** Opt into the extended refresh-token lifetime, carried across the redirect via sessionStorage. */
  readonly rememberMe = input(false);

  readonly enabled = signal(false);
  readonly starting = signal(false);

  private clientId: string | null = null;

  constructor() {
    this.googleAuth
      .providers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => {
        this.clientId = config.githubClientId;
        this.enabled.set(config.githubEnabled && !!config.githubClientId);
      });
  }

  start(): void {
    if (!this.clientId || this.starting()) {
      return;
    }
    this.starting.set(true);

    const state = crypto.randomUUID();
    sessionStorage.setItem(GITHUB_OAUTH_STATE_KEY, state);
    sessionStorage.setItem(GITHUB_OAUTH_REMEMBER_KEY, String(this.rememberMe()));

    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', `${window.location.origin}/auth/github/callback`);
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state);
    window.location.href = url.toString();
  }
}
