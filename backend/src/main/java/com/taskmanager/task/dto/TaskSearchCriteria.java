package com.taskmanager.task.dto;

import com.taskmanager.task.Priority;
import com.taskmanager.task.TaskStatus;

import java.time.LocalDate;

/**
 * Every filter the task list supports, in one value object.
 *
 * <p>Grouping them keeps the service signature stable as filters are added, and
 * makes it obvious that searching, filtering, sorting and pagination all resolve
 * into a single database query rather than being applied after the fact.
 *
 * @param keyword     free-text match on title or description
 * @param parentId    only the direct children of this task
 * @param rootsOnly   only top-level tasks — the default for the board view, so
 *                    nested subtasks don't also appear as standalone rows
 * @param overdueOnly only unfinished tasks whose due date has passed
 */
public record TaskSearchCriteria(
        String keyword,
        TaskStatus status,
        Priority priority,
        Long projectId,
        Long parentId,
        boolean rootsOnly,
        LocalDate dueFrom,
        LocalDate dueTo,
        boolean overdueOnly
) {
    /** No filters at all — every task the caller owns. */
    public static TaskSearchCriteria none() {
        return new TaskSearchCriteria(null, null, null, null, null, false, null, null, false);
    }

    /** The classic three-filter search, preserved for existing callers. */
    public static TaskSearchCriteria of(String keyword, TaskStatus status, Priority priority) {
        return new TaskSearchCriteria(keyword, status, priority, null, null, false, null, null, false);
    }
}
