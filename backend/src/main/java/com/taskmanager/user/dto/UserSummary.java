package com.taskmanager.user.dto;

import com.taskmanager.user.User;

import java.time.Instant;

/** Admin-facing user view, including account status fields. */
public record UserSummary(
        Long id,
        String name,
        String email,
        String role,
        boolean emailVerified,
        String accountStatus,
        Instant createdAt
) {
    public static UserSummary from(User user) {
        return new UserSummary(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.isEmailVerified(),
                user.getAccountStatus().name(),
                user.getCreatedAt()
        );
    }
}
