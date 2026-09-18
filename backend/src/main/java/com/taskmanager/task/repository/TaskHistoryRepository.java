package com.taskmanager.task.repository;

import com.taskmanager.task.Task;
import com.taskmanager.task.model.TaskHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TaskHistoryRepository extends JpaRepository<TaskHistory, Long> {

    Page<TaskHistory> findByTaskOrderByCreatedAtDesc(Task task, Pageable pageable);

    /**
     * Cross-task activity feed for one user's own tasks, newest first.
     * Joins the task and actor eagerly so building the DTO can't trigger N+1
     * lazy loads once the transaction has closed.
     */
    @Query("""
            SELECT h FROM TaskHistory h
            JOIN FETCH h.task t
            JOIN FETCH h.actor
            WHERE t.user.id = :userId
            ORDER BY h.createdAt DESC
            """)
    List<TaskHistory> findRecentForUser(@Param("userId") Long userId, Pageable pageable);
}
