import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
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
          <h1>Create your account</h1>
          <p class="sub">Start organizing your work in a minute.</p>
        </div>

        @if (error()) {
          <div class="alert" role="alert">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label class="label" for="name">Name</label>
            <input
              id="name"
              type="text"
              class="input"
              formControlName="name"
              placeholder="Your name"
              autocomplete="name"
            />
            @if (invalid('name')) {
              <span class="error-text">Name must be at least 2 characters.</span>
            }
          </div>

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
              placeholder="At least 6 characters"
              autocomplete="new-password"
            />
            @if (invalid('password')) {
              <span class="error-text">Password must be at least 6 characters.</span>
            }
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-block"
            [disabled]="loading()"
          >
            {{ loading() ? 'Creating account…' : 'Create account' }}
          </button>
        </form>

        <p class="switch">
          Already have an account? <a routerLink="/login">Sign in</a>
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
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  invalid(control: 'name' | 'email' | 'password'): boolean {
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

    this.auth.register(this.form.getRawValue()).subscribe({
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
