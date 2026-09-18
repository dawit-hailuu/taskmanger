export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  accountStatus?: string;
  /** Which identity provider owns the credentials. APPLE is reserved — not issuable yet. */
  authProvider?: 'LOCAL' | 'GOOGLE' | 'GITHUB' | 'APPLE';
  /** ISO instant of the last successful sign-in, or null/undefined if never (shouldn't happen post-registration). */
  lastLoginAt?: string | null;
}

/** Returned by login / refresh. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInMs: number;
  user: User;
}

/** Generic { message } envelope returned by many auth endpoints. */
export interface MessageResponse {
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

/**
 * "Continue with Google" via a direct ID token. The backend verifies its
 * signature and audience before trusting it. Not currently sent by the web
 * frontend (which uses {@link GoogleCodeLoginRequest} instead) — kept for API
 * completeness, e.g. a native client that already holds an ID token.
 */
export interface GoogleLoginRequest {
  credential: string;
  rememberMe?: boolean;
}

/**
 * "Continue with Google" via the custom-button popup flow — what the web
 * frontend actually sends. `code` is the authorization code Google's
 * `initCodeClient` popup handed back; the backend exchanges it (with the
 * client secret, never sent to the browser) for the ID token it belongs to.
 */
export interface GoogleCodeLoginRequest {
  code: string;
  rememberMe?: boolean;
}

/**
 * "Continue with GitHub". `code` is the authorization code GitHub redirected back
 * with; the backend exchanges it (with the client secret, never sent to the
 * browser) for an access token before trusting anything about the account.
 */
export interface GithubLoginRequest {
  code: string;
  redirectUri: string;
  rememberMe?: boolean;
}
