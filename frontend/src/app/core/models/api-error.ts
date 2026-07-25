/**
 * Normalized client-side error. Carries the HTTP status and the backend's
 * machine-readable `code` (e.g. EMAIL_NOT_VERIFIED, RATE_LIMITED) so components
 * can branch on it instead of matching message strings.
 */
export class ApiClientError extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
    readonly code: string | null = null
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}
