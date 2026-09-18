package com.taskmanager.task.dto;

import com.taskmanager.task.Task;
import com.taskmanager.task.TaskStatus;

import java.time.Instant;

/**
 * Flat legacy view of a subtask, kept so existing clients of
 * {@code /api/tasks/{id}/subtasks} keep working.
 *
 * <p>A subtask is now just a child task, so this projects one onto the original
 * shape. Richer callers should use {@link TaskNodeResponse}, which also carries
 * weight, progress and any further nesting.
 */
public record SubtaskResponse(
        Long id,
        String title,
        boolean completed,
        Instant createdAt
) {
    public static SubtaskResponse from(Task child) {
        return new SubtaskResponse(
                child.getId(),
                child.getTitle(),
                child.getStatus() == TaskStatus.COMPLETED,
                child.getCreatedAt());
    }
}
