package com.taskmanager.task.repository;

import com.taskmanager.task.Task;
import com.taskmanager.task.model.TaskWatcher;
import com.taskmanager.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskWatcherRepository extends JpaRepository<TaskWatcher, Long> {

    List<TaskWatcher> findByTaskOrderByWatchedAtAsc(Task task);

    Optional<TaskWatcher> findByTaskAndUser(Task task, User user);

    boolean existsByTaskAndUser(Task task, User user);
}
