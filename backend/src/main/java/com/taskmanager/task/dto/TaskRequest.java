package com.taskmanager.task.dto;

import com.taskmanager.task.Priority;
import com.taskmanager.task.RecurrenceType;
import com.taskmanager.task.TaskStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Payload for creating or fully updating a task.
 * Used for both POST and PUT.
 *
 * <p>{@code parentId} and {@code weight} are optional, so every pre-existing
 * client keeps working unchanged: omitting them creates a root task with the
 * default weight, and on update omitting them leaves the current values alone.
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

        LocalDate startDate,

        LocalDate dueDate,

        @Min(value = 0, message = "Estimated minutes cannot be negative")
        Integer estimatedMinutes,

        @Min(value = 0, message = "Actual minutes cannot be negative")
        Integer actualMinutes,

        RecurrenceType recurrence,

        LocalDate recurrenceEndDate,

        /** Optional project this task belongs to. Null keeps it a personal, unfiled task. */
        Long projectId,

        /**
         * Optional parent task, making this a subtask at any depth. Null on create
         * means "root task"; null on update leaves the existing parent untouched —
         * use {@code PATCH /api/tasks/{id}/move} to explicitly promote to a root.
         */
        Long parentId,

        /**
         * Optional share of the parent's effort. Omitted on create means "whatever
         * the parent has left"; omitted on update leaves the current weight.
         */
        @Min(value = 1, message = "Weight must be at least 1")
        @Max(value = 1_000_000, message = "Weight is unreasonably large")
        Integer weight
) {
}
