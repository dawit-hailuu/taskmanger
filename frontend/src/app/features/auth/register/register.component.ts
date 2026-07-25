import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApiClientError } from '../../../core/models/api-error';

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
          @if (registeredEmail()) {
            <h1>Check your email</h1>
            <p class="sub">One more step to activate your account.</p>
          } @else {
            <h1>Create your account</h1>
            <p class="sub">Start organizing your work in a minute.</p>
          }
        </div>

        @if (registeredEmail(); as email) {
          <div class="alert alert-success" role="status">
            We've sent a verification link to <strong>{{ email }}</strong>.
            Click it to activate your account, then sign in.
          </div>
          @if (info()) {
            <div class="alert alert-info" role="status">{{ info() }}</div>
          }
          <button type="button" class="btn btn-ghost btn-block" (click)="resend()" [disabled]="resending()">
            {{ resending() ? 'Sending…' : "Didn't get it? Resend email" }}
          </button>
          <p class="switch">Already verified? <a routerLink="/login">Sign in</a></p>
        } @else {
          @if (error()) {
            <div class="alert alert-error" role="alert">{{ error() }}</div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label class="label" for="name">Name</label>
              <input id="name" type="text" class="input" formControlName="name"
                     placeholder="Your name" autocomplete="name" />
              @if (invalid('name')) {
                <span class="error-text">Name must be at least 2 characters.</span>
              }
            </div>

            <div class="field">
              <label class="label" for="email">Email</label>
              <input id="email" type="email" class="input" formControlName="email"
                     placeholder="you@example.com" autocomplete="email" />
              @if (invalid('email')) {
                <span class="error-text">Enter a valid email address.</span>
              }
            </div>

            <div class="field">
              <label class="label" for="password">Password</label>
              <input id="password" type="password" class="input" formControlName="password"
                     placeholder="At least 6 characters" autocomplete="new-password" />
              @if (invalid('password')) {
                <span class="error-text">Password must be at least 6 characters.</span>
              }
            </div>

            <button type="submit" class="btn btn-primary btn-block" [disabled]="loading()">
              {{ loading() ? 'Creating account…' : 'Create account' }}
            </button>
          </form>

          <p class="switch">Already have an account? <a routerLink="/login">Sign in</a></p>
        }
      </section>
    </main>
  `,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly registeredEmail = signal<string | null>(null);
  readonly resending = signal(false);

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

    const email = this.form.controls.email.value;
    this.auth.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.registeredEmail.set(email);
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  resend(): void {
    const email = this.registeredEmail();
    if (!email) {
      return;
    }
    this.resending.set(true);
    this.info.set(null);
    this.auth.resendVerification(email).subscribe({
      next: (res) => {
        this.resending.set(false);
        this.info.set(res.message);
      },
      error: (err: ApiClientError) => {
        this.resending.set(false);
        this.error.set(err.message);
      },
    });
  }
}
