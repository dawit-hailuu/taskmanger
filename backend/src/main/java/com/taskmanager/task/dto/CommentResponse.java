package com.taskmanager.task.dto;

import com.taskmanager.task.model.Comment;
import com.taskmanager.user.User;

import java.time.Instant;
import java.util.List;

public record CommentResponse(
        Long id,
        Long taskId,
        Long authorId,
        String authorName,
        String content,
        List<Long> mentionedUserIds,
        Instant createdAt,
        Instant updatedAt
) {
    public static CommentResponse from(Comment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getTask().getId(),
                comment.getAuthor().getId(),
                comment.getAuthor().getName(),
                comment.getContent(),
                comment.getMentions().stream().map(User::getId).toList(),
                comment.getCreatedAt(),
                comment.getUpdatedAt()
        );
    }
}
