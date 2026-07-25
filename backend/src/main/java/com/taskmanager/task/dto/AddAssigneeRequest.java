package com.taskmanager.task.dto;

import jakarta.validation.constraints.NotNull;

public record AddAssigneeRequest(
        @NotNull(message = "userId is required")
        Long userId
) {
}
