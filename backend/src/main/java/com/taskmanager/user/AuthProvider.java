package com.taskmanager.user;

/**
 * Identity provider that owns an account's credentials.
 *
 * <p>{@link #LOCAL} accounts authenticate with email + BCrypt password.
 * {@link #GOOGLE} and {@link #GITHUB} accounts have no local password at all —
 * they are authenticated by verifying a token issued by that provider.
 * {@link #APPLE} is declared for schema/API completeness ahead of the actual
 * Sign in with Apple flow being built — no code path can produce it yet.
 */
public enum AuthProvider {

    LOCAL,
    GOOGLE,
    GITHUB,
    APPLE;

    /** Human-friendly label used in error messages shown to users. */
    public String displayName() {
        return switch (this) {
            case LOCAL -> "email and password";
            case GOOGLE -> "Google Sign-In";
            case GITHUB -> "GitHub Sign-In";
            case APPLE -> "Sign in with Apple";
        };
    }
}
