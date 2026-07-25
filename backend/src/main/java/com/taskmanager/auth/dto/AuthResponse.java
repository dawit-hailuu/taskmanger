package com.taskmanager.auth.dto;

import com.taskmanager.user.User;

/**
 * Returned on successful login/refresh. Carries a short-lived access token, a
 * long-lived rotating refresh token, and a safe (password-free) user view.
 */
public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresInMs,
        UserResponse user
) {
    public static AuthResponse of(String accessToken, String refreshToken, long expiresInMs, User user) {
        return new AuthResponse(accessToken, refreshToken, "Bearer", expiresInMs, UserResponse.from(user));
    }
}
