import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../models/task.model';
import {
  LoginHistoryEntry,
  NotificationPreferences,
  Profile,
  UpdateProfileRequest,
  UserActivity,
} from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/profile`;
  private readonly accountUrl = `${environment.apiUrl}/account`;

  /** Cached current profile, kept in sync so the navbar avatar updates live. */
  private readonly _profile = signal<Profile | null>(null);
  readonly profile = this._profile.asReadonly();

  get(): Observable<Profile> {
    return this.http.get<Profile>(this.baseUrl).pipe(tap((p) => this._profile.set(p)));
  }

  update(payload: UpdateProfileRequest): Observable<Profile> {
    return this.http
      .put<Profile>(this.baseUrl, payload)
      .pipe(tap((p) => this._profile.set(p)));
  }

  uploadAvatar(file: File): Observable<Profile> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<Profile>(`${this.baseUrl}/avatar`, formData)
      .pipe(tap((p) => this._profile.set(p)));
  }

  removeAvatar(): Observable<Profile> {
    return this.http
      .delete<Profile>(`${this.baseUrl}/avatar`)
      .pipe(tap((p) => this._profile.set(p)));
  }

  getNotificationPreferences(): Observable<NotificationPreferences> {
    return this.http.get<NotificationPreferences>(`${this.baseUrl}/notifications`);
  }

  updateNotificationPreferences(
    payload: NotificationPreferences
  ): Observable<NotificationPreferences> {
    return this.http.put<NotificationPreferences>(`${this.baseUrl}/notifications`, payload);
  }

  getActivity(page = 0, size = 20): Observable<Page<UserActivity>> {
    return this.http.get<Page<UserActivity>>(`${this.baseUrl}/activity`, {
      params: { page: String(page), size: String(size) },
    });
  }

  getLoginHistory(page = 0, size = 20): Observable<Page<LoginHistoryEntry>> {
    return this.http.get<Page<LoginHistoryEntry>>(`${this.accountUrl}/login-history`, {
      params: { page: String(page), size: String(size) },
    });
  }

  clearCache(): void {
    this._profile.set(null);
  }
}
