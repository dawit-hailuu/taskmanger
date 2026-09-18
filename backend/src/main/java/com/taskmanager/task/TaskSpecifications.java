package com.taskmanager.task;

import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.Collection;

/**
 * Reusable {@link Specification} building blocks for dynamic task queries.
 * Combined in the service layer to support search + filter in a type-safe way,
 * so pagination, sorting, searching and filtering all compose into one SQL
 * statement instead of being layered on in memory.
 */
public final class TaskSpecifications {

    private TaskSpecifications() {
    }

    /** Restrict to tasks owned by the given user. */
    public static Specification<Task> ownedBy(Long userId) {
        return (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
    }

    /** Case-insensitive match on title OR description. */
    public static Specification<Task> matchesKeyword(String keyword) {
        return (root, query, cb) -> {
            String like = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("title")), like),
                    cb.like(cb.lower(root.get("description")), like)
            );
        };
    }

    public static Specification<Task> hasStatus(TaskStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Task> hasPriority(Priority priority) {
        return (root, query, cb) -> cb.equal(root.get("priority"), priority);
    }

    public static Specification<Task> hasStatusIn(Collection<TaskStatus> statuses) {
        return (root, query, cb) -> root.get("status").in(statuses);
    }

    public static Specification<Task> hasStatusNotIn(Collection<TaskStatus> statuses) {
        return (root, query, cb) -> cb.not(root.get("status").in(statuses));
    }

    public static Specification<Task> inProject(Long projectId) {
        return (root, query, cb) -> cb.equal(root.get("project").get("id"), projectId);
    }

    /**
     * Only top-level tasks. This is what makes the default list a clean board:
     * nested subtasks are reached by expanding their parent, not by appearing
     * again as standalone rows.
     */
    public static Specification<Task> isRoot() {
        return (root, query, cb) -> cb.isNull(root.get("parent"));
    }

    /** Direct children of one task. */
    public static Specification<Task> childOf(Long parentId) {
        return (root, query, cb) -> cb.equal(root.get("parent").get("id"), parentId);
    }

    public static Specification<Task> dueOnOrBefore(LocalDate date) {
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("dueDate"), date);
    }

    public static Specification<Task> dueOnOrAfter(LocalDate date) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("dueDate"), date);
    }

    /** Unfinished and already past its due date. */
    public static Specification<Task> overdueAsOf(LocalDate today) {
        return (root, query, cb) -> cb.and(
                cb.isNotNull(root.get("dueDate")),
                cb.lessThan(root.get("dueDate"), today),
                cb.not(root.get("status").in(TaskStatus.TERMINAL))
        );
    }
}
