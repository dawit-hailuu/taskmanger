package com.taskmanager.task.dto;

import com.taskmanager.task.Priority;
import com.taskmanager.task.RecurrenceType;
import com.taskmanager.task.Task;
import com.taskmanager.task.TaskStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

/**
 * Flat view of a single task, used by the paged list endpoints.
 *
 * <p>Carries the tree fields ({@code parentId}, {@code weight}, {@code progress},
 * {@code depth}) so a list row can render its progress bar and weight without a
 * second request. {@link TaskNodeResponse} is the nested counterpart for the
 * tree view.
 *
 * @param childCount number of direct children, or {@code null} when the caller
 *                   didn't ask for it. Batched by the service so a page of rows
 *                   costs one extra query, never one per row.
 */
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
        Long parentId,
        int weight,
        int progress,
        int depth,
        int position,
        Integer childCount,
        Instant createdAt,
        Instant updatedAt
) {
    public static TaskResponse from(Task task) {
        return from(task, (Integer) null);
    }

    /**
     * Mapper for a page of tasks whose child counts were fetched in one batch.
     * Missing ids mean "no children", i.e. 0 — not "unknown".
     */
    public static TaskResponse withCounts(Task task, Map<Long, Integer> childCounts) {
        return from(task, childCounts.getOrDefault(task.getId(), 0));
    }

    public static TaskResponse from(Task task, Integer childCount) {
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
                task.getParentId(),
                task.getWeight(),
                task.getProgress(),
                task.getDepth(),
                task.getPosition(),
                childCount,
                task.getCreatedAt(),
                task.getUpdatedAt()
        );
    }
}
