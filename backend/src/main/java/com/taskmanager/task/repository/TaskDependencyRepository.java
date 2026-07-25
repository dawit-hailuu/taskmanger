package com.taskmanager.task.repository;

import com.taskmanager.task.Task;
import com.taskmanager.task.model.TaskDependency;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskDependencyRepository extends JpaRepository<TaskDependency, Long> {

    /** Tasks that this task depends on (must finish first). */
    List<TaskDependency> findByTaskOrderByCreatedAtAsc(Task task);

    /** Tasks that depend on this task (this task is blocking them). */
    List<TaskDependency> findByDependsOnOrderByCreatedAtAsc(Task dependsOn);

    Optional<TaskDependency> findByTaskAndDependsOn(Task task, Task dependsOn);

    boolean existsByTaskAndDependsOn(Task task, Task dependsOn);
}
