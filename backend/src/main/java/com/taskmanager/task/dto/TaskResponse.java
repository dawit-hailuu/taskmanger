package com.taskmanager.task.dto;

import com.taskmanager.task.Priority;
import com.taskmanager.task.RecurrenceType;
import com.taskmanager.task.Task;
import com.taskmanager.task.TaskStatus;

import java.time.Instant;
import java.time.LocalDate;

public record TaskResponse(
        Long id,
        String title,
        String description,
        Priority priority,
        TaskStatus status,
        LocalDate startDate,
        LocalDate dueDate,
        Integer estimatedMinutes,
        int actualMinutes,
        RecurrenceType recurrence,
        LocalDate recurrenceEndDate,
        Long projectId,
        String projectName,
        Long ownerId,
        String ownerName,
        Instant createdAt,
        Instant updatedAt
) {
    public static TaskResponse from(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getPriority(),
                task.getStatus(),
                task.getStartDate(),
                task.getDueDate(),
                task.getEstimatedMinutes(),
                task.getActualMinutes(),
                task.getRecurrence(),
                task.getRecurrenceEndDate(),
                task.getProject() != null ? task.getProject().getId() : null,
                task.getProject() != null ? task.getProject().getName() : null,
                task.getUser().getId(),
                task.getUser().getName(),
                task.getCreatedAt(),
                task.getUpdatedAt()
        );
    }
}
