package com.taskmanager.task.repository;

import com.taskmanager.task.Task;
import com.taskmanager.task.model.Subtask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubtaskRepository extends JpaRepository<Subtask, Long> {

    List<Subtask> findByTaskOrderByCreatedAtAsc(Task task);

    long countByTask(Task task);

    long countByTaskAndCompleted(Task task, boolean completed);
}
