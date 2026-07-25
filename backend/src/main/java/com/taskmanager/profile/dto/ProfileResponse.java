package com.taskmanager.profile.dto;

import com.taskmanager.profile.UserProfile;
import com.taskmanager.user.User;

import java.time.Instant;

public record ProfileResponse(
        Long id,
        String name,
        String email,
        String role,
        boolean emailVerified,
        String accountStatus,
        String avatarUrl,
        String bio,
        String phone,
        String timezone,
        Instant createdAt
) {
    public static ProfileResponse from(User user, UserProfile profile) {
        return new ProfileResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.isEmailVerified(),
                user.getAccountStatus().name(),
                profile.getAvatarUrl(),
                profile.getBio(),
                profile.getPhone(),
                profile.getTimezone(),
                user.getCreatedAt()
        );
    }
}
