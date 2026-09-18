package com.taskmanager.task.dto;

import jakarta.validation.constraints.Min;

/**
 * Re-parents and/or reorders a task — the server side of drag & drop.
 *
 * @param parentId the new parent, or {@code null} to promote the task to a root.
 *                 Rejected if it would make the task its own ancestor.
 * @param position zero-based index among the new siblings. Omit to append last.
 */
public record MoveTaskRequest(

        Long parentId,

        @Min(value = 0, message = "Position cannot be negative")
        Integer position
) {
}
