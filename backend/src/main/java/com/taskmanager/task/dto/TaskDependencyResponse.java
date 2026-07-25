package com.taskmanager.task.dto;

import com.taskmanager.task.Task;
import com.taskmanager.task.TaskStatus;

/** A related task shown on either side of a dependency link ("blocked by" / "blocks"). */
public record TaskDependencyResponse(
        Long taskId,
        String title,
        TaskStatus status
) {
    public static TaskDependencyResponse from(Task task) {
        return new TaskDependencyResponse(task.getId(), task.getTitle(), task.getStatus());
    }
}
