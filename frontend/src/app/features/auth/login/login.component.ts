import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

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
          <div class="alert" role="alert">{{ error() }}</div>
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

          <button
            type="submit"
            class="btn btn-primary btn-block"
            [disabled]="loading()"
          >
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <p class="switch">
          New here? <a routerLink="/register">Create an account</a>
        </p>
      </section>
    </main>
  `,
  styles: [
    `
      .auth {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1.25rem;
      }

      .auth-card {
        width: 100%;
        max-width: 400px;
        padding: 2.2rem;
      }

      .auth-head {
        text-align: center;
        margin-bottom: 1.6rem;
      }

      .brand-mark {
        display: inline-flex;
        gap: 4px;
        align-items: flex-end;
        height: 26px;
        margin-bottom: 1rem;
      }
      .tick { width: 5px; border-radius: 2px; display: block; }
      .tick-high { height: 26px; background: var(--high); }
      .tick-med { height: 18px; background: var(--med); }
      .tick-low { height: 11px; background: var(--low); }

      h1 { font-size: 1.5rem; }

      .sub {
        color: var(--muted);
        margin: 0.4rem 0 0;
        font-size: 0.92rem;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 1.1rem;
      }

      .alert {
        background: var(--high-tint);
        color: var(--high);
        border: 1px solid var(--high);
        border-radius: var(--radius-sm);
        padding: 0.7rem 0.85rem;
        font-size: 0.85rem;
        margin-bottom: 1.1rem;
      }

      .switch {
        text-align: center;
        margin: 1.4rem 0 0;
        font-size: 0.88rem;
        color: var(--muted);
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

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
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

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        void this.router.navigate(['/dashboard']);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }
}
