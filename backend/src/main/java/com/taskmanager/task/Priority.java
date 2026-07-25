package com.taskmanager.task;

/**
 * Task priority, ordered from least to most urgent.
 * Declaration order is meaningful: it defines the natural sort order used
 * when clients sort tasks by priority.
 */
public enum Priority {
    LOW,
    MEDIUM,
    HIGH,
    URGENT
}
