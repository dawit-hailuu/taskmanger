package com.taskmanager.task.dto;

import java.util.Map;

/**
 * Headline numbers for the dashboard, all computed by grouped database queries
 * rather than by fetching rows and counting them in Java.
 *
 * @param total           every task the user owns, at any depth
 * @param rootTotal       top-level tasks only — what the board view pages through
 * @param byStatus        count per {@code TaskStatus} name
 * @param openByPriority  count per {@code Priority} name, excluding closed tasks
 * @param completionRate  completed ÷ total, as a whole percentage
 * @param averageProgress mean weighted progress across root tasks — the number
 *                        that actually reflects effort, since it respects weights
 */
public record TaskStatsResponse(
        long total,
        long rootTotal,
        Map<String, Long> byStatus,
        Map<String, Long> openByPriority,
        long open,
        long completed,
        long overdue,
        long dueToday,
        long dueThisWeek,
        int completionRate,
        int averageProgress
) {
}
