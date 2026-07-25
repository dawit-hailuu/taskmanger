package com.taskmanager.task.dto;

import jakarta.validation.constraints.NotNull;

public record CreateTaskDependencyRequest(
        @NotNull(message = "dependsOnTaskId is required")
        Long dependsOnTaskId
) {
}
