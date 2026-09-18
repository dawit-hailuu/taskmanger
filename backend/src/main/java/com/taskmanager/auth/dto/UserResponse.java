package com.taskmanager.auth.dto;

import com.taskmanager.user.User;

import java.time.Instant;

/** Password-free representation of a user, safe to return to clients. */
public record UserResponse(
        Long id,
        String name,
        String email,
        String role,
        boolean emailVerified,
        String accountStatus,
        /** Identity provider that owns the credentials — LOCAL, GOOGLE, or GITHUB. */
        String authProvider,
        /** Null if the user has never successfully signed in (shouldn't happen post-registration, but defensive). */
        Instant lastLoginAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.isEmailVerified(),
                user.getAccountStatus().name(),
                user.getAuthProvider().name(),
                user.getLastLoginAt()
        );
    }
}
