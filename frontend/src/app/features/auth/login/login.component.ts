import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiClientError } from '../../../core/models/api-error';
import { AuthService } from '../../../core/services/auth.service';
import { GoogleAuthService } from '../../../core/services/google-auth.service';
import { AppleSignInComponent } from '../../../shared/auth/apple-sign-in.component';
import { GithubSignInComponent } from '../../../shared/auth/github-sign-in.component';
import { GoogleSignInComponent } from '../../../shared/auth/google-sign-in.component';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    GoogleSignInComponent,
    GithubSignInComponent,
    AppleSignInComponent,
  ],
  template: `
    <main class="auth">
      <section class="auth-card card" [class.busy]="loading()">
        <div class="auth-head">
          <span class="brand-mark" aria-hidden="true">
            <span class="tick tick-high"></span>
            <span class="tick tick-med"></span>
            <span class="tick tick-low"></span>
          </span>
          <h1>Welcome back</h1>
          <p class="sub">Sign in to pick up where you left off.</p>
        </div>

        @if (error()) {
          <div class="alert alert-error" role="alert">
            {{ error() }}
            @if (needsVerification()) {
              <div class="alert-action">
                <button type="button" class="link-btn" (click)="resend()" [disabled]="resending()">
                  {{ resending() ? 'Sending…' : 'Resend verification email' }}
                </button>
              </div>
            }
          </div>
        }

        @if (info()) {
          <div class="alert alert-info" role="status">{{ info() }}</div>
        }

        <!-- Google first: it's one click, and it's what most returning users
             reach for. The email form stays fully visible underneath. -->
        <div class="social-stack">
          <app-google-sign-in
            [rememberMe]="form.controls.rememberMe.value"
            [hideDivider]="true"
            (failedToSignIn)="error.set($event)"
          />
          <app-github-sign-in [rememberMe]="form.controls.rememberMe.value" />
          <app-apple-sign-in />
        </div>

        @if (anySocialEnabled()) {
          <div class="divider"><span>or continue with email</span></div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label class="label" for="email">Email</label>
            <input
              id="email"
              type="email"
              class="input"
              formControlName="email"
              placeholder="you@example.com"
              autocomplete="email"
              [attr.aria-invalid]="invalid('email')"
            />
            @if (invalid('email')) {
              <span class="error-text">Enter a valid email address.</span>
            }
          </div>

          <div class="field">
            <div class="label-row">
              <label class="label" for="password">Password</label>
              <a class="tiny-link" routerLink="/forgot-password">Forgot?</a>
            </div>
            <div class="password-wrap">
              <input
                id="password"
                [type]="showPassword() ? 'text' : 'password'"
                class="input"
                formControlName="password"
                placeholder="Your password"
                autocomplete="current-password"
                [attr.aria-invalid]="invalid('password')"
              />
              <button
                type="button"
                class="reveal"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                [attr.aria-pressed]="showPassword()"
                (click)="showPassword.set(!showPassword())"
              >
                {{ showPassword() ? 'Hide' : 'Show' }}
              </button>
            </div>
            @if (invalid('password')) {
              <span class="error-text">Password is required.</span>
            }
          </div>

          <label class="checkbox-row">
            <input type="checkbox" formControlName="rememberMe" />
            Keep me signed in
          </label>

          <button type="submit" class="btn btn-primary btn-block" [disabled]="loading()">
            @if (loading()) {
              <span class="spin" aria-hidden="true"></span> Signing in…
            } @else {
              Sign in
            }
          </button>
        </form>

        <p class="switch">New here? <a routerLink="/register">Create an account</a></p>
      </section>
    </main>
  `,
  styles: [
    `
      .auth-card {
        /* A single short entrance — enough to feel deliberate, never enough to
           delay the first interaction. */
        animation: card-in 0.32s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .auth-card.busy {
        pointer-events: none;
      }

      .label-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .tiny-link {
        font-size: 0.78rem;
        font-weight: 600;
      }

      .password-wrap {
        position: relative;
        display: flex;
      }

      .password-wrap .input {
        padding-right: 4rem;
      }

      .reveal {
        position: absolute;
        right: 0.35rem;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--muted);
        padding: 0.3rem 0.4rem;
        border-radius: 6px;
      }

      .reveal:hover {
        color: var(--brand);
        background: var(--surface-2);
      }

      .alert-action {
        margin-top: 0.6rem;
      }

      .spin {
        width: 13px;
        height: 13px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.45);
        border-top-color: #fff;
        animation: spin 0.7s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @keyframes card-in {
        from { opacity: 0; transform: translateY(12px) scale(0.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly googleAuth = inject(GoogleAuthService);
  private readonly providersConfig = toSignal(this.googleAuth.providers(), { initialValue: null });

  /** Whether to show the "or continue with email" divider — only once at least one social button renders. */
  readonly anySocialEnabled = computed(() => {
    const config = this.providersConfig();
    return !!config && (config.googleEnabled || config.githubEnabled || config.appleEnabled);
  });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly needsVerification = signal(false);
  readonly resending = signal(false);
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  invalid(control: 'email' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.info.set(null);
    this.needsVerification.set(false);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        void this.router.navigate(['/dashboard']);
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.needsVerification.set(err.code === 'EMAIL_NOT_VERIFIED');
        this.loading.set(false);
      },
    });
  }

  resend(): void {
    const email = this.form.controls.email.value;
    if (!email) {
      return;
    }
    this.resending.set(true);
    this.auth.resendVerification(email).subscribe({
      next: (res) => {
        this.resending.set(false);
        this.needsVerification.set(false);
        this.error.set(null);
        this.info.set(res.message);
      },
      error: (err: ApiClientError) => {
        this.resending.set(false);
        this.error.set(err.message);
      },
    });
  }
}
