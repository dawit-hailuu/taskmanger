package com.taskmanager.task.dto;

import com.taskmanager.task.model.TaskAssignee;
import com.taskmanager.task.model.TaskWatcher;
import com.taskmanager.user.User;

import java.time.Instant;

/** A user attached to a task as either an assignee or a watcher. */
public record TaskCollaboratorResponse(
        Long userId,
        String name,
        String email,
        Instant addedAt
) {
    public static TaskCollaboratorResponse from(TaskAssignee assignee) {
        User user = assignee.getUser();
        return new TaskCollaboratorResponse(user.getId(), user.getName(), user.getEmail(), assignee.getAssignedAt());
    }

    public static TaskCollaboratorResponse from(TaskWatcher watcher) {
        User user = watcher.getUser();
        return new TaskCollaboratorResponse(user.getId(), user.getName(), user.getEmail(), watcher.getWatchedAt());
    }
}
