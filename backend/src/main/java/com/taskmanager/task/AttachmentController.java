package com.taskmanager.task;

import com.taskmanager.task.dto.AttachmentResponse;
import com.taskmanager.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/tasks/{taskId}/attachments")
@Tag(name = "Task Attachments", description = "Files and images attached to a task")
public class AttachmentController {

    private final AttachmentService attachmentService;

    public AttachmentController(AttachmentService attachmentService) {
        this.attachmentService = attachmentService;
    }

    @Operation(summary = "List a task's attachments")
    @GetMapping
    public ResponseEntity<List<AttachmentResponse>> list(@AuthenticationPrincipal User user,
                                                         @PathVariable Long taskId) {
        return ResponseEntity.ok(attachmentService.list(user, taskId));
    }

    @Operation(summary = "Upload an attachment (up to 10MB)")
    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<AttachmentResponse> upload(@AuthenticationPrincipal User user,
                                                     @PathVariable Long taskId,
                                                     @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(attachmentService.upload(user, taskId, file));
    }

    @Operation(summary = "Delete an attachment (uploader or task owner)")
    @DeleteMapping("/{attachmentId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user,
                                       @PathVariable Long taskId,
                                       @PathVariable Long attachmentId) {
        attachmentService.delete(user, taskId, attachmentId);
        return ResponseEntity.noContent().build();
    }
}
