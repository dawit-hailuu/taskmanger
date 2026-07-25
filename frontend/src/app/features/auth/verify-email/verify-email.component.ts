import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApiClientError } from '../../../core/models/api-error';

type State = 'verifying' | 'success' | 'error';

@Component({
  selector: 'app-verify-email',
  standalone: true,
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
          <h1>Email verification</h1>
        </div>

        @switch (state()) {
          @case ('verifying') {
            <div class="alert alert-info" role="status">Verifying your email…</div>
          }
          @case ('success') {
            <div class="alert alert-success" role="status">{{ message() }}</div>
            <a class="btn btn-primary btn-block" routerLink="/login">Continue to sign in</a>
          }
          @case ('error') {
            <div class="alert alert-error" role="alert">{{ message() }}</div>
            <p class="switch">
              Need a new link? <a routerLink="/login">Sign in</a> and request one.
            </p>
          }
        }
      </section>
    </main>
  `,
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly state = signal<State>('verifying');
  readonly message = signal('');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('error');
      this.message.set('This verification link is missing its token.');
      return;
    }

    this.auth.verifyEmail(token).subscribe({
      next: (res) => {
        this.state.set('success');
        this.message.set(res.message);
      },
      error: (err: ApiClientError) => {
        // An already-verified account is not really a failure — guide to sign in.
        if (err.code === 'EMAIL_ALREADY_VERIFIED') {
          this.state.set('success');
          this.message.set(err.message);
          return;
        }
        this.state.set('error');
        this.message.set(err.message);
      },
    });
  }
}
