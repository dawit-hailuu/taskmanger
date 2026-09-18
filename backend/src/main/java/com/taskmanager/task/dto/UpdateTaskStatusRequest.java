package com.taskmanager.task.dto;

import com.taskmanager.task.TaskStatus;
import jakarta.validation.constraints.NotNull;

/**
 * Changes only a task's status.
 *
 * <p>Exists so a checkbox in the tree doesn't have to send a full-replace PUT:
 * doing that would require the client to echo back every field it happens to
 * know about, silently wiping any it doesn't (time estimates, recurrence, …).
 */
public record UpdateTaskStatusRequest(

        @NotNull(message = "Status is required")
        TaskStatus status
) {
}
