import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GoogleAuthService } from '../../core/services/google-auth.service';

/**
 * "Continue with Apple" — scaffolding only.
 *
 * <p>Reads the exact same {@code appleEnabled} flag Google and GitHub's buttons
 * read, so the day Sign in with Apple is actually implemented server-side, this
 * button starts rendering with no frontend change at all. Until then
 * {@code appleEnabled} is hard-coded {@code false} on the backend
 * ({@code AuthConfigResponse}), so this component never renders anything and has
 * no click handler to misfire — there is no half-working Apple flow here, only
 * an already-wired on/off switch waiting for the real implementation.
 */
@Component({
  selector: 'app-apple-sign-in',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enabled()) {
      <button type="button" class="social-btn">
        <svg class="social-icon" viewBox="0 0 17 20" aria-hidden="true" fill="currentColor">
          <path
            d="M13.94 10.6c-.02-2.06 1.68-3.05 1.76-3.1-.96-1.4-2.45-1.6-2.98-1.62-1.27-.13-2.48.75-3.12.75-.65
               0-1.63-.73-2.68-.71-1.38.02-2.65.8-3.36 2.04-1.43 2.48-.37 6.15 1.03 8.16.68.98 1.5 2.08 2.57 2.04
               1.03-.04 1.42-.66 2.67-.66 1.24 0 1.6.66 2.68.64 1.11-.02 1.82-1 2.49-1.99.78-1.14 1.11-2.25
               1.13-2.3-.02-.01-2.17-.83-2.19-3.25ZM11.9 4.2c.56-.68.94-1.62.83-2.56-.81.03-1.79.54-2.37
               1.2-.52.6-.98 1.56-.86 2.48.9.07 1.83-.46 2.4-1.12Z"
          />
        </svg>
        Continue with Apple
      </button>
    }
  `,
})
export class AppleSignInComponent {
  private readonly googleAuth = inject(GoogleAuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly enabled = signal(false);

  constructor() {
    this.googleAuth
      .providers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => this.enabled.set(config.appleEnabled));
  }
}
