package com.taskmanager.task.dto;

import com.taskmanager.task.Priority;
import com.taskmanager.task.TaskStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Payload for creating or fully updating a task.
 * Used for both POST and PUT.
 */
public record TaskRequest(

        @NotBlank(message = "Title is required")
        @Size(max = 150, message = "Title must not exceed 150 characters")
        String title,

        @Size(max = 5000, message = "Description must not exceed 5000 characters")
        String description,

        @NotNull(message = "Priority is required")
        Priority priority,

        @NotNull(message = "Status is required")
        TaskStatus status,

        LocalDate dueDate
) {
}
