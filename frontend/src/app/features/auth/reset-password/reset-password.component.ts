import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApiClientError } from '../../../core/models/api-error';

@Component({
  selector: 'app-reset-password',
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
          <p class="sub">Choose a new password for your account.</p>
        </div>

        @if (!token()) {
          <div class="alert alert-error" role="alert">
            This reset link is invalid or incomplete.
          </div>
          <p class="switch"><a routerLink="/forgot-password">Request a new link</a></p>
        } @else if (done()) {
          <div class="alert alert-success" role="status">{{ message() }}</div>
          <a class="btn btn-primary btn-block" routerLink="/login">Continue to sign in</a>
        } @else {
          @if (error()) {
            <div class="alert alert-error" role="alert">{{ error() }}</div>
          }
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label class="label" for="password">New password</label>
              <input id="password" type="password" class="input" formControlName="password"
                     placeholder="At least 6 characters" autocomplete="new-password" />
              @if (controlInvalid('password')) {
                <span class="error-text">Password must be at least 6 characters.</span>
              }
            </div>
            <div class="field">
              <label class="label" for="confirm">Confirm password</label>
              <input id="confirm" type="password" class="input" formControlName="confirm"
                     placeholder="Re-enter your password" autocomplete="new-password" />
              @if (form.hasError('mismatch') && form.controls.confirm.touched) {
                <span class="error-text">Passwords don't match.</span>
              }
            </div>
            <button type="submit" class="btn btn-primary btn-block" [disabled]="loading()">
              {{ loading() ? 'Updating…' : 'Update password' }}
            </button>
          </form>
        }
      </section>
    </main>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly token = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly done = signal(false);
  readonly message = signal('');

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', [Validators.required]],
    },
    { validators: matchPasswords }
  );

  ngOnInit(): void {
    this.token.set(this.route.snapshot.queryParamMap.get('token'));
  }

  controlInvalid(control: 'password' | 'confirm'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    const token = this.token();
    if (!token || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.auth.resetPassword(token, this.form.controls.password.value).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.done.set(true);
        this.message.set(res.message);
      },
      error: (err: ApiClientError) => {
        this.loading.set(false);
        this.error.set(err.message);
      },
    });
  }
}

function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return password === confirm ? null : { mismatch: true };
}
