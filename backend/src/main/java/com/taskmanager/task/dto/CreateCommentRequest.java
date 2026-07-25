package com.taskmanager.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCommentRequest(
        @NotBlank(message = "Comment cannot be empty")
        @Size(max = 5000, message = "Comment must not exceed 5000 characters")
        String content
) {
}
