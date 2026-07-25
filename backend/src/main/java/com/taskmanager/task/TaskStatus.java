package com.taskmanager.task;

/**
 * Lifecycle state of a task. Declaration order reflects the typical
 * workflow progression (backlog → done), and is used for sorting.
 *
 * Note: the legacy {@code DONE} value was renamed to {@code COMPLETED}
 * (see Flyway migration V2). {@link #isTerminal()} identifies end states.
 */
public enum TaskStatus {
    TODO,
    IN_PROGRESS,
    REVIEW,
    COMPLETED,
    CANCELLED;

    /** True for states that close a task (no further work expected). */
    public boolean isTerminal() {
        return this == COMPLETED || this == CANCELLED;
    }
}
