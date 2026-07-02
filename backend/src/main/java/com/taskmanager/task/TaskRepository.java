package com.taskmanager.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface TaskRepository
        extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    /** Ownership-aware lookup so users can only touch their own tasks. */
    Optional<Task> findByIdAndUserId(Long id, Long userId);
}
