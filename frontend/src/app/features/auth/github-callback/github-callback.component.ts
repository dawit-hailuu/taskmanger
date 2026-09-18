import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClientError } from '../../../core/models/api-error';
import { AuthService } from '../../../core/services/auth.service';
import {
  GITHUB_OAUTH_REMEMBER_KEY,
  GITHUB_OAUTH_STATE_KEY,
} from '../../../shared/auth/github-sign-in.component';

/**
 * Where GitHub redirects back to after the user approves (or cancels) the
 * authorization request started by {@code GithubSignInComponent}.
 *
 * <p>Three things are checked before ever calling the backend: GitHub didn't
 * report an error (e.g. the user clicked "Cancel"), a {@code code} is actually
 * present, and the {@code state} it sent back matches the one we generated —
 * confirming this response belongs to a redirect *we* started, not a forged or
 * replayed one.
 */
@Component({
  selector: 'app-github-callback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="auth">
      <section class="auth-card card">
        <div class="auth-head">
          <span class="brand-mark" aria-hidden="true">
            <span class="tick tick-high"></span>
            <span class="tick tick-med"></span>
            <span class="tick tick-low"></span>
          </span>
          <h1>{{ error() ? 'Sign-in failed' : 'Signing you in…' }}</h1>
        </div>

        @if (error()) {
          <div class="alert alert-error" role="alert">{{ error() }}</div>
          <a class="btn btn-primary btn-block" routerLink="/login">Back to sign in</a>
        } @else {
          <p class="status" role="status">
            <span class="spin" aria-hidden="true"></span> Finishing GitHub sign-in…
          </p>
        }
      </section>
    </main>
  `,
  styles: [
    `
      .status {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.55rem;
        color: var(--muted);
        font-size: 0.9rem;
        margin: 1.4rem 0 0;
      }

      .spin {
        width: 15px;
        height: 15px;
        border-radius: 50%;
        border: 2px solid var(--border-strong);
        border-top-color: var(--brand);
        animation: spin 0.7s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `,
  ],
})
export class GithubCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;

    const expectedState = sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY);
    const rememberMe = sessionStorage.getItem(GITHUB_OAUTH_REMEMBER_KEY) === 'true';
    sessionStorage.removeItem(GITHUB_OAUTH_STATE_KEY);
    sessionStorage.removeItem(GITHUB_OAUTH_REMEMBER_KEY);

    if (params.get('error')) {
      this.error.set('GitHub sign-in was cancelled.');
      return;
    }

    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state || !expectedState || state !== expectedState) {
      this.error.set('GitHub sign-in could not be verified. Please try again.');
      return;
    }

    this.auth
      .loginWithGithub({
        code,
        redirectUri: `${window.location.origin}/auth/github/callback`,
        rememberMe,
      })
      .subscribe({
        next: () => void this.router.navigate(['/dashboard']),
        error: (err: ApiClientError) => this.error.set(err.message),
      });
  }
}
