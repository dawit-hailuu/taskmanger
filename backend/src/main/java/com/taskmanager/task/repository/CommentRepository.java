package com.taskmanager.task.repository;

import com.taskmanager.task.Task;
import com.taskmanager.task.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findByTaskOrderByCreatedAtAsc(Task task);
}
