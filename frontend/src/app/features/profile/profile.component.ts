import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { COMMON_TIMEZONES, Profile } from '../../core/models/profile.model';
import { ApiClientError } from '../../core/models/api-error';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <main class="container page">
      <h1>My profile</h1>

      @if (loading()) {
        <div class="state">Loading your profile…</div>
      } @else if (profile(); as p) {
        @if (error()) {
          <div class="alert alert-error" role="alert">{{ error() }}</div>
        }
        @if (success()) {
          <div class="alert alert-success" role="status">{{ success() }}</div>
        }

        <section class="card avatar-card">
          <div class="avatar-wrap">
            @if (p.avatarUrl) {
              <img [src]="p.avatarUrl" alt="Profile picture" class="avatar-img" />
            } @else {
              <span class="avatar-fallback">{{ initial(p.name) }}</span>
            }
          </div>
          <div class="avatar-actions">
            <div>
              <h3>{{ p.name }}</h3>
              <p class="muted">{{ p.email }} · {{ roleLabel(p.role) }}</p>
              <p class="muted small">Member since {{ formatDate(p.createdAt) }}</p>
            </div>
            <div class="avatar-buttons">
              <button type="button" class="btn btn-ghost" (click)="fileInput.click()" [disabled]="avatarBusy()">
                {{ avatarBusy() ? 'Uploading…' : 'Upload photo' }}
              </button>
              @if (p.avatarUrl) {
                <button type="button" class="btn btn-danger" (click)="removeAvatar()" [disabled]="avatarBusy()">
                  Remove
                </button>
              }
              <input
                #fileInput
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                style="display:none"
                (change)="onFileSelected($any($event.target).files)"
              />
            </div>
          </div>
        </section>

        <section class="card form-card">
          <h2>Personal information</h2>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label class="label" for="name">Full name</label>
              <input id="name" type="text" class="input" formControlName="name" maxlength="100" />
              @if (invalid('name')) {
                <span class="error-text">Name must be at least 2 characters.</span>
              }
            </div>

            <div class="field">
              <label class="label" for="bio">Bio</label>
              <textarea id="bio" class="textarea" formControlName="bio" maxlength="1000"
                        placeholder="Tell your team a bit about yourself"></textarea>
            </div>

            <div class="row">
              <div class="field">
                <label class="label" for="phone">Phone</label>
                <input id="phone" type="tel" class="input" formControlName="phone"
                       placeholder="+1 555 123 4567" />
                @if (invalid('phone')) {
                  <span class="error-text">Enter a valid phone number.</span>
                }
              </div>

              <div class="field">
                <label class="label" for="timezone">Timezone</label>
                <select id="timezone" class="select" formControlName="timezone">
                  @for (tz of timezones; track tz) {
                    <option [value]="tz">{{ tz }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="saving()">
                {{ saving() ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </form>
        </section>
      }
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

      .state {
        text-align: center;
        color: var(--muted);
        padding: 3rem 1rem;
      }

      .card {
        padding: 1.5rem 1.6rem;
        margin-bottom: 1.4rem;
      }

      .avatar-card {
        display: flex;
        gap: 1.4rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .avatar-wrap {
        width: 84px;
        height: 84px;
        flex-shrink: 0;
        border-radius: 50%;
        overflow: hidden;
        background: var(--brand-tint);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-fallback {
        font-size: 2rem;
        font-weight: 700;
        color: var(--brand-strong);
      }

      .avatar-actions {
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .avatar-actions h3 {
        font-size: 1.1rem;
      }

      .muted {
        color: var(--muted);
        font-size: 0.88rem;
        margin: 0.2rem 0 0;
      }

      .muted.small {
        font-size: 0.78rem;
      }

      .avatar-buttons {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .form-card h2 {
        font-size: 1.1rem;
        margin-bottom: 1.2rem;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 1.1rem;
      }

      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.4rem;
      }

      @media (max-width: 560px) {
        .row {
          grid-template-columns: 1fr;
        }
        .avatar-actions {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class ProfileComponent implements OnInit {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);

  readonly timezones = COMMON_TIMEZONES;

  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly avatarBusy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    bio: ['', [Validators.maxLength(1000)]],
    phone: ['', [Validators.pattern(/^$|^[+]?[0-9 ()-]{7,30}$/)]],
    timezone: ['UTC', [Validators.required]],
  });

  ngOnInit(): void {
    this.profileService.get().subscribe({
      next: (p) => {
        this.applyProfile(p);
        this.loading.set(false);
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  invalid(control: 'name' | 'phone'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    const raw = this.form.getRawValue();
    this.profileService
      .update({
        name: raw.name.trim(),
        bio: raw.bio.trim() ? raw.bio.trim() : null,
        phone: raw.phone.trim() ? raw.phone.trim() : null,
        timezone: raw.timezone,
      })
      .subscribe({
        next: (p) => {
          this.applyProfile(p);
          this.saving.set(false);
          this.success.set('Profile updated.');
        },
        error: (err: ApiClientError) => {
          this.error.set(err.message);
          this.saving.set(false);
        },
      });
  }

  onFileSelected(files: FileList | null): void {
    const file = files?.[0];
    if (!file) {
      return;
    }
    this.avatarBusy.set(true);
    this.error.set(null);
    this.success.set(null);

    this.profileService.uploadAvatar(file).subscribe({
      next: (p) => {
        this.profile.set(p);
        this.avatarBusy.set(false);
        this.success.set('Profile picture updated.');
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.avatarBusy.set(false);
      },
    });
  }

  removeAvatar(): void {
    this.avatarBusy.set(true);
    this.error.set(null);
    this.success.set(null);

    this.profileService.removeAvatar().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.avatarBusy.set(false);
        this.success.set('Profile picture removed.');
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.avatarBusy.set(false);
      },
    });
  }

  roleLabel(role: string): string {
    return role.replace('ROLE_', '').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }

  initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private applyProfile(p: Profile): void {
    this.profile.set(p);
    this.form.patchValue({
      name: p.name,
      bio: p.bio ?? '',
      phone: p.phone ?? '',
      timezone: p.timezone,
    });
  }
}
