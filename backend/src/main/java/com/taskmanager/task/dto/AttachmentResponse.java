package com.taskmanager.task.dto;

import com.taskmanager.task.model.Attachment;

import java.time.Instant;

public record AttachmentResponse(
        Long id,
        Long taskId,
        String fileName,
        String fileUrl,
        String contentType,
        long sizeBytes,
        Long uploadedById,
        String uploadedByName,
        Instant createdAt
) {
    public static AttachmentResponse from(Attachment attachment) {
        return new AttachmentResponse(
                attachment.getId(),
                attachment.getTask().getId(),
                attachment.getFileName(),
                attachment.getFileUrl(),
                attachment.getContentType(),
                attachment.getSizeBytes(),
                attachment.getUploadedBy().getId(),
                attachment.getUploadedBy().getName(),
                attachment.getCreatedAt()
        );
    }
}
