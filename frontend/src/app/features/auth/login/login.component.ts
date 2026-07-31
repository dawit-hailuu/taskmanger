import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApiClientError } from '../../../core/models/api-error';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="auth">
      <section class="auth-card card">
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
              <div style="margin-top:.6rem;">
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
            />
            @if (invalid('email')) {
              <span class="error-text">Enter a valid email address.</span>
            }
          </div>

          <div class="field">
            <label class="label" for="password">Password</label>
            <input
              id="password"
              type="password"
              class="input"
              formControlName="password"
              placeholder="Your password"
              autocomplete="current-password"
            />
            @if (invalid('password')) {
              <span class="error-text">Password is required.</span>
            }
          </div>

          <div class="row-between">
            <label class="checkbox-row">
              <input type="checkbox" formControlName="rememberMe" />
              Remember me
            </label>
            <a routerLink="/forgot-password">Reset password?</a>
          </div>

          <button type="submit" class="btn btn-primary btn-block" [disabled]="loading()">
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <p class="switch">New here? <a routerLink="/register">Create an account</a></p>
      </section>
    </main>
  `,
  styles: [
    `
      .row-between {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly needsVerification = signal(false);
  readonly resending = signal(false);

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
