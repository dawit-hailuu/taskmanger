export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  accountStatus?: string;
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
