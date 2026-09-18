package com.taskmanager.task;

import java.util.Set;

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

    /**
     * The closed states, as a reusable set. Exposed so queries can bind it as a
     * single {@code NOT IN} parameter instead of each one restating the pair.
     */
    public static final Set<TaskStatus> TERMINAL = Set.of(COMPLETED, CANCELLED);

    /** True for states that close a task (no further work expected). */
    public boolean isTerminal() {
        return TERMINAL.contains(this);
    }
}
