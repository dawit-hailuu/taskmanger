package com.taskmanager.task;

import com.taskmanager.task.dto.CommentResponse;
import com.taskmanager.task.dto.CreateCommentRequest;
import com.taskmanager.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks/{taskId}/comments")
@Tag(name = "Comments", description = "Task comments, supporting @[Full Name] mentions")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @Operation(summary = "List a task's comments")
    @GetMapping
    public ResponseEntity<List<CommentResponse>> list(@AuthenticationPrincipal User user, @PathVariable Long taskId) {
        return ResponseEntity.ok(commentService.list(user, taskId));
    }

    @Operation(summary = "Add a comment")
    @PostMapping
    public ResponseEntity<CommentResponse> create(@AuthenticationPrincipal User user,
                                                  @PathVariable Long taskId,
                                                  @Valid @RequestBody CreateCommentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(commentService.create(user, taskId, request.content()));
    }

    @Operation(summary = "Edit your own comment")
    @PutMapping("/{commentId}")
    public ResponseEntity<CommentResponse> update(@AuthenticationPrincipal User user,
                                                  @PathVariable Long taskId,
                                                  @PathVariable Long commentId,
                                                  @Valid @RequestBody CreateCommentRequest request) {
        return ResponseEntity.ok(commentService.update(user, taskId, commentId, request.content()));
    }

    @Operation(summary = "Delete a comment (author or task owner)")
    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user,
                                       @PathVariable Long taskId,
                                       @PathVariable Long commentId) {
        commentService.delete(user, taskId, commentId);
        return ResponseEntity.noContent().build();
    }
}
