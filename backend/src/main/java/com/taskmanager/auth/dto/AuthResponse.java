package com.taskmanager.auth.dto;

import com.taskmanager.user.User;

/**
 * Returned on successful register/login. Contains the JWT plus a safe
 * (password-free) view of the authenticated user.
 */
public record AuthResponse(
        String token,
        String tokenType,
        UserResponse user
) {
    public static AuthResponse of(String token, User user) {
        return new AuthResponse(token, "Bearer", UserResponse.from(user));
    }
}
