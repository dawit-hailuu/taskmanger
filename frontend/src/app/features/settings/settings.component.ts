import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { ApiClientError } from '../../core/models/api-error';
import {
  ACTIVITY_LABELS,
  LoginHistoryEntry,
  NOTIFICATION_EVENTS,
  NotificationPreferences,
  UserActivity,
} from '../../core/models/profile.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <main class="container page">
      <h1>Settings</h1>

      <!-- Notification preferences -->
      <section class="card">
        <h2>Notification preferences</h2>
        <p class="muted">Choose how you want to be notified for each event.</p>

        @if (prefsError()) {
          <div class="alert alert-error" role="alert">{{ prefsError() }}</div>
        }
        @if (prefsSuccess()) {
          <div class="alert alert-success" role="status">{{ prefsSuccess() }}</div>
        }

        @if (prefs(); as p) {
          <div class="table-wrap">
            <table class="prefs-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Email</th>
                  <th>In-app</th>
                </tr>
              </thead>
              <tbody>
                @for (event of events; track event.label) {
                  <tr>
                    <td>{{ event.label }}</td>
                    <td>
                      <input
                        type="checkbox"
                        [checked]="p[event.emailKey]"
                        (change)="toggle(event.emailKey, $any($event.target).checked)"
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        [checked]="p[event.inAppKey]"
                        (change)="toggle(event.inAppKey, $any($event.target).checked)"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-primary" (click)="savePrefs()" [disabled]="savingPrefs()">
              {{ savingPrefs() ? 'Saving…' : 'Save preferences' }}
            </button>
          </div>
        }
      </section>

      <!-- Change password -->
      <section class="card">
        <h2>Change password</h2>

        @if (pwdError()) {
          <div class="alert alert-error" role="alert">{{ pwdError() }}</div>
        }
        @if (pwdSuccess()) {
          <div class="alert alert-success" role="status">{{ pwdSuccess() }}</div>
        }

        <form [formGroup]="pwdForm" (ngSubmit)="changePassword()" novalidate>
          <div class="field">
            <label class="label" for="currentPassword">Current password</label>
            <input id="currentPassword" type="password" class="input"
                   formControlName="currentPassword" autocomplete="current-password" />
          </div>
          <div class="field">
            <label class="label" for="newPassword">New password</label>
            <input id="newPassword" type="password" class="input"
                   formControlName="newPassword" autocomplete="new-password" />
            @if (pwdInvalid('newPassword')) {
              <span class="error-text">Password must be at least 6 characters.</span>
            }
          </div>
          <div class="field">
            <label class="label" for="confirmPassword">Confirm new password</label>
            <input id="confirmPassword" type="password" class="input"
                   formControlName="confirmPassword" autocomplete="new-password" />
            @if (pwdForm.hasError('mismatch') && pwdForm.controls.confirmPassword.touched) {
              <span class="error-text">Passwords don't match.</span>
            }
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" [disabled]="changingPwd()">
              {{ changingPwd() ? 'Updating…' : 'Update password' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Login history -->
      <section class="card">
        <h2>Login history</h2>
        @if (loginHistory().length === 0 && !loadingLogins()) {
          <p class="muted">No login attempts recorded yet.</p>
        } @else {
          <ul class="history-list">
            @for (entry of loginHistory(); track entry.id) {
              <li>
                <span class="dot" [class.dot-fail]="!entry.success"></span>
                <span class="history-main">
                  {{ entry.success ? 'Successful sign-in' : 'Failed sign-in (' + (entry.failureReason ?? 'unknown') + ')' }}
                </span>
                <span class="history-meta">{{ entry.ipAddress ?? 'unknown IP' }} · {{ formatDateTime(entry.createdAt) }}</span>
              </li>
            }
          </ul>
          @if (hasMoreLogins()) {
            <button type="button" class="btn btn-ghost" (click)="loadMoreLogins()" [disabled]="loadingLogins()">
              {{ loadingLogins() ? 'Loading…' : 'Load more' }}
            </button>
          }
        }
      </section>

      <!-- Activity history -->
      <section class="card">
        <h2>Activity history</h2>
        @if (activity().length === 0 && !loadingActivity()) {
          <p class="muted">No activity recorded yet.</p>
        } @else {
          <ul class="history-list">
            @for (entry of activity(); track entry.id) {
              <li>
                <span class="dot"></span>
                <span class="history-main">{{ activityLabel(entry.type) }}</span>
                <span class="history-meta">{{ formatDateTime(entry.createdAt) }}</span>
              </li>
            }
          </ul>
          @if (hasMoreActivity()) {
            <button type="button" class="btn btn-ghost" (click)="loadMoreActivity()" [disabled]="loadingActivity()">
              {{ loadingActivity() ? 'Loading…' : 'Load more' }}
            </button>
          }
        }
      </section>
    </main>
  `,
  styles: [
    `
      .page {
        padding-top: 2rem;
        padding-bottom: 4rem;
        max-width: 720px;
      }

      h1 {
        font-size: 1.7rem;
        margin-bottom: 1.4rem;
      }

      .card {
        padding: 1.5rem 1.6rem;
        margin-bottom: 1.4rem;
      }

      .card h2 {
        font-size: 1.1rem;
      }

      .muted {
        color: var(--muted);
        font-size: 0.88rem;
        margin: 0.3rem 0 1rem;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 1.1rem;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 1rem;
      }

      .table-wrap {
        overflow-x: auto;
      }

      .prefs-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }

      .prefs-table th {
        text-align: left;
        color: var(--muted);
        font-weight: 600;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        padding: 0.5rem 0.6rem;
        border-bottom: 1px solid var(--border);
      }

      .prefs-table td {
        padding: 0.6rem;
        border-bottom: 1px solid var(--border);
      }

      .prefs-table th:not(:first-child),
      .prefs-table td:not(:first-child) {
        text-align: center;
        width: 90px;
      }

      .prefs-table input[type='checkbox'] {
        width: 16px;
        height: 16px;
        accent-color: var(--brand);
      }

      .history-list {
        list-style: none;
        margin: 0 0 1rem;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
      }

      .history-list li {
        display: flex;
        align-items: baseline;
        gap: 0.6rem;
        font-size: 0.88rem;
        flex-wrap: wrap;
      }

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--low);
        flex-shrink: 0;
      }

      .dot-fail {
        background: var(--high);
      }

      .history-main {
        font-weight: 500;
      }

      .history-meta {
        color: var(--muted);
        font-size: 0.8rem;
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);

  readonly events = NOTIFICATION_EVENTS;

  // Notification preferences
  readonly prefs = signal<NotificationPreferences | null>(null);
  readonly savingPrefs = signal(false);
  readonly prefsError = signal<string | null>(null);
  readonly prefsSuccess = signal<string | null>(null);

  // Change password
  readonly changingPwd = signal(false);
  readonly pwdError = signal<string | null>(null);
  readonly pwdSuccess = signal<string | null>(null);

  readonly pwdForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: matchPasswords }
  );

  // Login history
  readonly loginHistory = signal<LoginHistoryEntry[]>([]);
  readonly loadingLogins = signal(false);
  readonly hasMoreLogins = signal(false);
  private loginPage = 0;

  // Activity history
  readonly activity = signal<UserActivity[]>([]);
  readonly loadingActivity = signal(false);
  readonly hasMoreActivity = signal(false);
  private activityPage = 0;

  ngOnInit(): void {
    this.profileService.getNotificationPreferences().subscribe({
      next: (p) => this.prefs.set(p),
      error: (err: ApiClientError) => this.prefsError.set(err.message),
    });
    this.loadMoreLogins();
    this.loadMoreActivity();
  }

  toggle(key: keyof NotificationPreferences, checked: boolean): void {
    const current = this.prefs();
    if (!current) {
      return;
    }
    this.prefs.set({ ...current, [key]: checked });
  }

  savePrefs(): void {
    const current = this.prefs();
    if (!current) {
      return;
    }
    this.savingPrefs.set(true);
    this.prefsError.set(null);
    this.prefsSuccess.set(null);

    this.profileService.updateNotificationPreferences(current).subscribe({
      next: (p) => {
        this.prefs.set(p);
        this.savingPrefs.set(false);
        this.prefsSuccess.set('Notification preferences saved.');
      },
      error: (err: ApiClientError) => {
        this.prefsError.set(err.message);
        this.savingPrefs.set(false);
      },
    });
  }

  pwdInvalid(control: 'newPassword'): boolean {
    const c = this.pwdForm.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  changePassword(): void {
    if (this.pwdForm.invalid) {
      this.pwdForm.markAllAsTouched();
      return;
    }
    this.changingPwd.set(true);
    this.pwdError.set(null);
    this.pwdSuccess.set(null);

    const raw = this.pwdForm.getRawValue();
    this.auth.changePassword(raw.currentPassword, raw.newPassword).subscribe({
      next: (res) => {
        this.changingPwd.set(false);
        this.pwdSuccess.set(res.message);
        this.pwdForm.reset();
      },
      error: (err: ApiClientError) => {
        this.changingPwd.set(false);
        this.pwdError.set(err.message);
      },
    });
  }

  loadMoreLogins(): void {
    this.loadingLogins.set(true);
    this.profileService.getLoginHistory(this.loginPage, 20).subscribe({
      next: (page) => {
        this.loginHistory.set([...this.loginHistory(), ...page.content]);
        this.hasMoreLogins.set(!page.last);
        this.loginPage++;
        this.loadingLogins.set(false);
      },
      error: () => this.loadingLogins.set(false),
    });
  }

  loadMoreActivity(): void {
    this.loadingActivity.set(true);
    this.profileService.getActivity(this.activityPage, 20).subscribe({
      next: (page) => {
        this.activity.set([...this.activity(), ...page.content]);
        this.hasMoreActivity.set(!page.last);
        this.activityPage++;
        this.loadingActivity.set(false);
      },
      error: () => this.loadingActivity.set(false),
    });
  }

  activityLabel(type: string): string {
    return ACTIVITY_LABELS[type] ?? type;
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}

function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return newPassword === confirm ? null : { mismatch: true };
}
