package com.taskmanager.task.repository;

import com.taskmanager.task.Task;
import com.taskmanager.task.model.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    List<Attachment> findByTaskOrderByCreatedAtDesc(Task task);
}
