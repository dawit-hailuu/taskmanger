package com.taskmanager.task.repository;

import com.taskmanager.tag.Tag;
import com.taskmanager.task.Task;
import com.taskmanager.task.model.TaskTag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskTagRepository extends JpaRepository<TaskTag, Long> {

    List<TaskTag> findByTaskOrderByAddedAtAsc(Task task);

    Optional<TaskTag> findByTaskAndTag(Task task, Tag tag);

    boolean existsByTaskAndTag(Task task, Tag tag);
}
