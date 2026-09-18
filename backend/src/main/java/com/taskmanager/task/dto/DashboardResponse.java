package com.taskmanager.task.dto;

import com.taskmanager.task.model.TaskHistory;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Everything the dashboard renders, in one response.
 *
 * <p>Deliberately a single aggregate rather than six endpoints: the previous
 * dashboard issued one request per card plus five more per visible task, which is
 * what made it feel slow. One call, a handful of grouped queries.
 */
public record DashboardResponse(
        TaskStatsResponse stats,
        List<TaskResponse> dueToday,
        List<TaskResponse> upcoming,
        List<TaskResponse> overdue,
        List<TaskResponse> recent,
        List<CompletionPoint> completionTrend,
        List<ActivityEntry> activity
) {
    /** One day of the completion sparkline. */
    public record CompletionPoint(LocalDate date, long completed) {
    }

    /** One line of the cross-task activity feed. */
    public record ActivityEntry(
            Long id,
            Long taskId,
            String taskTitle,
            String summary,
            String actorName,
            Instant createdAt
    ) {
        public static ActivityEntry from(TaskHistory history) {
            return new ActivityEntry(
                    history.getId(),
                    history.getTask().getId(),
                    history.getTask().getTitle(),
                    history.getSummary(),
                    history.getActor().getName(),
                    history.getCreatedAt());
        }
    }
}
