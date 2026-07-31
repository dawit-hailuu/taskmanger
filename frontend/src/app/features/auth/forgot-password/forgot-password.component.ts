import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApiClientError } from '../../../core/models/api-error';

@Component({
  selector: 'app-forgot-password',
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
          <h1>Reset password</h1>
          <p class="sub">We'll email you a link to reset it.</p>
        </div>

        @if (sent()) {
          <div class="alert alert-success" role="status">{{ message() }}</div>
          <p class="switch"><a routerLink="/login">Back to sign in</a></p>
        } @else {
          @if (error()) {
            <div class="alert alert-error" role="alert">{{ error() }}</div>
          }
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label class="label" for="email">Email</label>
              <input id="email" type="email" class="input" formControlName="email"
                     placeholder="you@example.com" autocomplete="email" />
              @if (invalid()) {
                <span class="error-text">Enter a valid email address.</span>
              }
            </div>
            <button type="submit" class="btn btn-primary btn-block" [disabled]="loading()">
              {{ loading() ? 'Sending…' : 'Send reset link' }}
            </button>
          </form>
          <p class="switch">Remembered it? <a routerLink="/login">Sign in</a></p>
        }
      </section>
    </main>
  `,
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sent = signal(false);
  readonly message = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  invalid(): boolean {
    const c = this.form.controls.email;
    return c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.auth.forgotPassword(this.form.controls.email.value).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.sent.set(true);
        this.message.set(res.message);
      },
      error: (err: ApiClientError) => {
        this.loading.set(false);
        this.error.set(err.message);
      },
    });
  }
}
