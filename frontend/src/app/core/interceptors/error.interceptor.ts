import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Central HTTP error handling. On 401 it clears the session and redirects to
 * login; for everything else it extracts the backend's ApiError message so
 * components can display something meaningful.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        auth.logout();
      }
      return throwError(() => normalize(error));
    })
  );
};

function normalize(error: HttpErrorResponse): Error {
  // Backend ApiError shape: { message, fieldErrors: [{ field, message }], ... }
  const body = error.error;

  if (body?.fieldErrors?.length) {
    const first = body.fieldErrors[0];
    return new Error(`${first.field}: ${first.message}`);
  }
  if (body?.message) {
    return new Error(body.message);
  }
  if (error.status === 0) {
    return new Error('Cannot reach the server. Is the backend running?');
  }
  return new Error('Something went wrong. Please try again.');
}
