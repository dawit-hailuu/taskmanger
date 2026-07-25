package com.taskmanager.task;

import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.storage.StorageService;
import com.taskmanager.task.dto.AttachmentResponse;
import com.taskmanager.task.model.Attachment;
import com.taskmanager.task.repository.AttachmentRepository;
import com.taskmanager.user.User;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;

@Service
public class AttachmentService {

    private static final String SUBFOLDER = "attachments";

    private final TaskService taskService;
    private final TaskHistoryService taskHistoryService;
    private final AttachmentRepository attachmentRepository;
    private final StorageService storageService;

    public AttachmentService(TaskService taskService, TaskHistoryService taskHistoryService,
                             AttachmentRepository attachmentRepository, StorageService storageService) {
        this.taskService = taskService;
        this.taskHistoryService = taskHistoryService;
        this.attachmentRepository = attachmentRepository;
        this.storageService = storageService;
    }

    @Transactional(readOnly = true)
    public List<AttachmentResponse> list(User user, Long taskId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        return attachmentRepository.findByTaskOrderByCreatedAtDesc(task).stream()
                .map(AttachmentResponse::from)
                .toList();
    }

    @Transactional
    public AttachmentResponse upload(User user, Long taskId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file was provided.");
        }
        Task task = taskService.getAccessibleTask(user, taskId);
        String url = storageService.store(file, SUBFOLDER);

        Attachment attachment = new Attachment();
        attachment.setTask(task);
        attachment.setUploadedBy(user);
        attachment.setFileName(file.getOriginalFilename());
        attachment.setFileUrl(url);
        attachment.setContentType(file.getContentType());
        attachment.setSizeBytes(file.getSize());
        attachment.setCreatedAt(Instant.now());
        Attachment saved = attachmentRepository.save(attachment);

        taskHistoryService.log(task, user, "Attachment added: " + attachment.getFileName());
        return AttachmentResponse.from(saved);
    }

    @Transactional
    public void delete(User user, Long taskId, Long attachmentId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found with id " + attachmentId));

        if (!attachment.getTask().getId().equals(task.getId())) {
            throw new ResourceNotFoundException("Attachment not found with id " + attachmentId);
        }

        boolean isUploader = attachment.getUploadedBy().getId().equals(user.getId());
        boolean isTaskOwner = task.getUser().getId().equals(user.getId());
        if (!isUploader && !isTaskOwner) {
            throw new AccessDeniedException("You do not have permission to delete this attachment.");
        }

        storageService.delete(attachment.getFileUrl());
        attachmentRepository.delete(attachment);
        taskHistoryService.log(task, user, "Attachment removed: " + attachment.getFileName());
    }
}
