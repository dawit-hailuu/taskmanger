import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ApiClientError } from '../models/api-error';

/**
 * Central HTTP error handling.
 *
 * On a 401 for a protected endpoint it transparently attempts a token refresh
 * and replays the original request; if the refresh fails, the session is
 * cleared. All errors are normalized to {@link ApiClientError} so components
 * get a clean message plus the backend's machine-readable `code`.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isAuthEndpoint = req.url.includes('/api/auth/');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        if (!auth.getRefreshToken()) {
          auth.logout();
          return throwError(() => normalize(error));
        }
        return auth.refresh().pipe(
          switchMap((res) => {
            if (!res?.accessToken) {
              auth.logout();
              return throwError(() => normalize(error));
            }
            const retried = req.clone({
              setHeaders: { Authorization: `Bearer ${res.accessToken}` },
            });
            return next(retried).pipe(
              catchError((e: HttpErrorResponse) => throwError(() => normalize(e)))
            );
          }),
          catchError(() => {
            auth.logout();
            return throwError(() => normalize(error));
          })
        );
      }
      return throwError(() => normalize(error));
    })
  );
};

function normalize(error: HttpErrorResponse): ApiClientError {
  // Backend ApiError shape: { message, code, fieldErrors: [{ field, message }], ... }
  const body = error.error;

  if (body?.fieldErrors?.length) {
    const first = body.fieldErrors[0];
    return new ApiClientError(`${first.message}`, error.status, body.code ?? null);
  }
  if (body?.message) {
    return new ApiClientError(body.message, error.status, body.code ?? null);
  }
  if (error.status === 0) {
    return new ApiClientError('Cannot reach the server. Is the backend running?', 0);
  }
  return new ApiClientError('Something went wrong. Please try again.', error.status);
}
