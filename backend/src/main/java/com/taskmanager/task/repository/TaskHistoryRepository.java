package com.taskmanager.task.repository;

import com.taskmanager.task.Task;
import com.taskmanager.task.model.TaskHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskHistoryRepository extends JpaRepository<TaskHistory, Long> {

    Page<TaskHistory> findByTaskOrderByCreatedAtDesc(Task task, Pageable pageable);
}
