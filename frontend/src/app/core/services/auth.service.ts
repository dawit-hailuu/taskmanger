import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, finalize, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  User,
} from '../models/user.model';
import { ProfileService } from './profile.service';

const ACCESS_KEY = 'taskflow.accessToken';
const REFRESH_KEY = 'taskflow.refreshToken';
const USER_KEY = 'taskflow.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly profileService = inject(ProfileService);
  private readonly authUrl = `${environment.apiUrl}/auth`;
  private readonly accountUrl = `${environment.apiUrl}/account`;

  private readonly _user = signal<User | null>(this.readStoredUser());

  /** Reactive current user (null when signed out). */
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  /** De-duplicates concurrent refresh attempts triggered by parallel 401s. */
  private refreshInFlight$: Observable<AuthResponse> | null = null;

  // ---- session-establishing calls ----

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.authUrl}/login`, credentials)
      .pipe(tap((res) => this.storeSession(res)));
  }

  /** Registration no longer signs the user in — they must verify their email first. */
  register(payload: RegisterRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.authUrl}/register`, payload);
  }

  // ---- account recovery / verification ----

  verifyEmail(token: string): Observable<MessageResponse> {
    return this.http.get<MessageResponse>(`${this.authUrl}/verify-email`, {
      params: { token },
    });
  }

  resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.authUrl}/resend-verification`, { email });
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.authUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.authUrl}/reset-password`, {
      token,
      newPassword,
    });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.accountUrl}/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  // ---- token lifecycle ----

  /** Exchange the refresh token for a fresh pair. Single-flight. */
  refresh(): Observable<AuthResponse> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      // No way to refresh; surface as an error stream the interceptor handles.
      return of<AuthResponse>(null as unknown as AuthResponse);
    }

    this.refreshInFlight$ = this.http
      .post<AuthResponse>(`${this.authUrl}/refresh`, { refreshToken })
      .pipe(
        tap((res) => this.storeSession(res)),
        shareReplay(1),
        finalize(() => (this.refreshInFlight$ = null))
      );
    return this.refreshInFlight$;
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      // Best-effort server-side revocation; ignore failures.
      this.http.post(`${this.authUrl}/logout`, { refreshToken }).subscribe({
        error: () => undefined,
      });
    }
    this.clearSession();
    this.profileService.clearCache();
    void this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  // ---- storage helpers ----

  private storeSession(res: AuthResponse): void {
    localStorage.setItem(ACCESS_KEY, res.accessToken);
    localStorage.setItem(REFRESH_KEY, res.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this._user.set(res.user);
  }

  private clearSession(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
  }

  private readStoredUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
