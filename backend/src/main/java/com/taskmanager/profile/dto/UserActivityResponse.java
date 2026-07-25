package com.taskmanager.profile.dto;

import com.taskmanager.profile.UserActivity;

import java.time.Instant;

public record UserActivityResponse(
        Long id,
        String type,
        String description,
        Instant createdAt
) {
    public static UserActivityResponse from(UserActivity activity) {
        return new UserActivityResponse(
                activity.getId(),
                activity.getType().name(),
                activity.getDescription(),
                activity.getCreatedAt()
        );
    }
}
