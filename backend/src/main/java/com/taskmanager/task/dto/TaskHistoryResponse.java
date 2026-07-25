package com.taskmanager.task.dto;

import com.taskmanager.task.model.TaskHistory;

import java.time.Instant;

public record TaskHistoryResponse(
        Long id,
        String summary,
        Long actorId,
        String actorName,
        Instant createdAt
) {
    public static TaskHistoryResponse from(TaskHistory history) {
        return new TaskHistoryResponse(
                history.getId(),
                history.getSummary(),
                history.getActor().getId(),
                history.getActor().getName(),
                history.getCreatedAt()
        );
    }
}
