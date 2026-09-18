import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';

/** What the backend says about the sign-in methods this deployment offers. */
export interface AuthProviderConfig {
  googleEnabled: boolean;
  googleClientId: string | null;
  githubEnabled: boolean;
  githubClientId: string | null;
  /** Always false today — Sign in with Apple isn't implemented yet. */
  appleEnabled: boolean;
}

const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GSI_SCRIPT_ID = 'google-identity-services';

/** One error the code-client popup reports rather than resolving a code. */
interface GoogleOAuthError {
  type: string;
  message?: string;
}

/**
 * Minimal surface of Google Identity Services' OAuth 2.0 code client that we
 * actually call — `initCodeClient`, not the ID-token/One Tap widget API. This
 * is the flow Google explicitly supports triggering from any custom button;
 * the rendered-button requirement applies to the other (One Tap) product.
 */
interface GoogleIdentityServices {
  accounts: {
    oauth2: {
      initCodeClient(options: {
        client_id: string;
        scope: string;
        ux_mode: 'popup' | 'redirect';
        callback: (response: { code?: string }) => void;
        error_callback?: (error: GoogleOAuthError) => void;
      }): { requestCode(): void };
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

/**
 * Wraps the one Google Identity Services call the frontend needs — opening the
 * "Continue with Google" popup and getting back an authorization code — plus
 * the one shared {@code /api/auth/config} fetch every social sign-in button
 * (Google, GitHub, the not-yet-implemented Apple) reads from via
 * {@link providers}, so the request only ever happens once per page load and
 * every button's enabled/disabled state agrees. Kept as one service rather than
 * split into a same-purpose "AuthConfigService" to avoid a rename touching
 * every existing call site for no behavioural change.
 *
 * <p>The code this produces is only ever forwarded to the backend
 * ({@code POST /api/auth/google/code}), which exchanges it for tokens itself —
 * the client secret that exchange needs never reaches the browser.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private readonly http = inject(HttpClient);

  private config$?: Observable<AuthProviderConfig>;
  private scriptPromise?: Promise<boolean>;

  private static readonly DISABLED_CONFIG: AuthProviderConfig = {
    googleEnabled: false,
    googleClientId: null,
    githubEnabled: false,
    githubClientId: null,
    appleEnabled: false,
  };

  /**
   * Which providers are available. Cached for the lifetime of the app, and a
   * network failure degrades to "every provider disabled" rather than blocking
   * the page — email/password sign-in must always remain reachable.
   */
  providers(): Observable<AuthProviderConfig> {
    this.config$ ??= this.http
      .get<AuthProviderConfig>(`${environment.apiUrl}/auth/config`)
      .pipe(
        catchError(() => of<AuthProviderConfig>(GoogleAuthService.DISABLED_CONFIG)),
        shareReplay(1)
      );
    return this.config$;
  }

  /**
   * Opens Google's real OAuth consent popup and resolves with the authorization
   * code it returns, or rejects if the script can't load, the user closes the
   * popup, or Google reports an error. A fresh code client per call — Google's
   * client library doesn't expose a way to await a specific popup's outcome
   * otherwise, and code clients are cheap to create.
   */
  async requestCode(clientId: string): Promise<string> {
    const loaded = await this.loadScript();
    const gsi = window.google;
    if (!loaded || !gsi) {
      throw new Error("Google sign-in couldn't load. Use your email and password instead.");
    }

    return new Promise<string>((resolve, reject) => {
      const client = gsi.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: 'openid email profile',
        ux_mode: 'popup',
        callback: (response) => {
          if (response.code) {
            resolve(response.code);
          } else {
            reject(new Error('Google sign-in was cancelled.'));
          }
        },
        error_callback: (error) => {
          reject(new Error(error.message || 'Google sign-in could not be completed.'));
        },
      });
      // Must run synchronously inside the click handler that led here, or the
      // browser's popup blocker treats it as an unsolicited popup.
      client.requestCode();
    });
  }

  /** Injects the GIS script once; concurrent callers share the same promise. */
  private loadScript(): Promise<boolean> {
    if (window.google) {
      return Promise.resolve(true);
    }
    this.scriptPromise ??= new Promise<boolean>((resolve) => {
      const existing = document.getElementById(GSI_SCRIPT_ID);
      if (existing) {
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', () => resolve(false));
        return;
      }

      const script = document.createElement('script');
      script.id = GSI_SCRIPT_ID;
      script.src = GSI_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        // Offline, or the domain is blocked. Report failure so the caller can
        // fall back to password sign-in instead of showing a dead button.
        this.scriptPromise = undefined;
        resolve(false);
      };
      document.head.appendChild(script);
    });
    return this.scriptPromise;
  }
}
