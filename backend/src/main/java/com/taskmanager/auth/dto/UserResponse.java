package com.taskmanager.auth.dto;

import com.taskmanager.user.User;

/** Password-free representation of a user, safe to return to clients. */
public record UserResponse(
        Long id,
        String name,
        String email,
        String role
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name()
        );
    }
}
