package com.taskmanager.task.repository;

import com.taskmanager.task.Task;
import com.taskmanager.task.model.TaskAssignee;
import com.taskmanager.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskAssigneeRepository extends JpaRepository<TaskAssignee, Long> {

    List<TaskAssignee> findByTaskOrderByAssignedAtAsc(Task task);

    Optional<TaskAssignee> findByTaskAndUser(Task task, User user);

    boolean existsByTaskAndUser(Task task, User user);
}
