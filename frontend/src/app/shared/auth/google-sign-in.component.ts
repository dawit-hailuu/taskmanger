import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ApiClientError } from '../../core/models/api-error';
import { AuthService } from '../../core/services/auth.service';
import { GoogleAuthService } from '../../core/services/google-auth.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * "Continue with Google" — same shape and styling as
 * {@code GithubSignInComponent}/{@code AppleSignInComponent}: a fully custom
 * button with Google's official "G" mark, not Google's own rendered widget.
 *
 * <p>This is possible without faking the sign-in flow because the click opens
 * Google's own real OAuth consent popup (`initCodeClient` — see
 * {@code GoogleAuthService.requestCode}), which is Google's officially
 * supported mechanism for a custom button. The rendered-button requirement
 * only applies to the separate ID-token/One Tap product, which this no longer
 * uses at all.
 *
 * <p>Renders nothing at all when Google sign-in isn't configured, so both auth
 * screens can drop it in unconditionally. Shared between sign-in and sign-up
 * because the flow is genuinely identical — Google returns the same account
 * whether it already exists or is about to be created.
 */
@Component({
  selector: 'app-google-sign-in',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enabled()) {
      <button type="button" class="social-btn" [disabled]="busy()" (click)="start()">
        @if (busy()) {
          <span class="social-spinner" aria-hidden="true"></span> Signing you in…
        } @else {
          <svg class="social-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          Continue with Google
        }
      </button>

      @if (!hideDivider()) {
        <div class="divider"><span>{{ dividerLabel() }}</span></div>
      }
    }
  `,
})
export class GoogleSignInComponent {
  private readonly googleAuth = inject(GoogleAuthService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Opt into the extended refresh-token lifetime, mirroring the password form. */
  readonly rememberMe = input(false);
  readonly dividerLabel = input('or continue with email');
  /** Set when another social button (GitHub, Apple) renders below this one and owns the divider instead. */
  readonly hideDivider = input(false);

  /** Raised so the host can show the message in its own alert area. */
  readonly failedToSignIn = output<string>();

  readonly enabled = signal(false);
  readonly busy = signal(false);

  private clientId: string | null = null;

  constructor() {
    this.googleAuth
      .providers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => {
        this.clientId = config.googleClientId;
        this.enabled.set(config.googleEnabled && !!config.googleClientId);
      });
  }

  async start(): Promise<void> {
    if (!this.clientId || this.busy()) {
      return;
    }
    this.busy.set(true);

    let code: string;
    try {
      code = await this.googleAuth.requestCode(this.clientId);
    } catch (err) {
      this.busy.set(false);
      this.failedToSignIn.emit(err instanceof Error ? err.message : 'Google sign-in was cancelled.');
      return;
    }

    this.auth.loginWithGoogleCode({ code, rememberMe: this.rememberMe() }).subscribe({
      next: (res) => {
        this.toast.success(`Signed in as ${res.user.name}.`);
        void this.router.navigate(['/dashboard']);
      },
      error: (err: ApiClientError) => {
        this.busy.set(false);
        this.failedToSignIn.emit(err.message);
      },
    });
  }
}
