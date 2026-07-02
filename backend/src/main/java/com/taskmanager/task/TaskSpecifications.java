package com.taskmanager.task;

import org.springframework.data.jpa.domain.Specification;

/**
 * Reusable {@link Specification} building blocks for dynamic task queries.
 * Combined in the service layer to support search + filter in a type-safe way.
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
}
