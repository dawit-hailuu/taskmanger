package com.taskmanager.task.dto;

import com.taskmanager.task.model.Subtask;

import java.time.Instant;

public record SubtaskResponse(
        Long id,
        String title,
        boolean completed,
        Instant createdAt
) {
    public static SubtaskResponse from(Subtask subtask) {
        return new SubtaskResponse(subtask.getId(), subtask.getTitle(), subtask.isCompleted(), subtask.getCreatedAt());
    }
}
