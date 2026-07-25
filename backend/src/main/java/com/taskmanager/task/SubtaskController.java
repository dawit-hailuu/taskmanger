package com.taskmanager.task;

import com.taskmanager.task.dto.CreateSubtaskRequest;
import com.taskmanager.task.dto.SubtaskResponse;
import com.taskmanager.task.dto.UpdateSubtaskRequest;
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
@RequestMapping("/api/tasks/{taskId}/subtasks")
@Tag(name = "Subtasks", description = "Checklist items within a task")
public class SubtaskController {

    private final SubtaskService subtaskService;

    public SubtaskController(SubtaskService subtaskService) {
        this.subtaskService = subtaskService;
    }

    @Operation(summary = "List a task's subtasks")
    @GetMapping
    public ResponseEntity<List<SubtaskResponse>> list(@AuthenticationPrincipal User user, @PathVariable Long taskId) {
        return ResponseEntity.ok(subtaskService.list(user, taskId));
    }

    @Operation(summary = "Add a subtask")
    @PostMapping
    public ResponseEntity<SubtaskResponse> create(@AuthenticationPrincipal User user,
                                                  @PathVariable Long taskId,
                                                  @Valid @RequestBody CreateSubtaskRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(subtaskService.create(user, taskId, request.title()));
    }

    @Operation(summary = "Rename a subtask or toggle its completion")
    @PutMapping("/{subtaskId}")
    public ResponseEntity<SubtaskResponse> update(@AuthenticationPrincipal User user,
                                                  @PathVariable Long taskId,
                                                  @PathVariable Long subtaskId,
                                                  @Valid @RequestBody UpdateSubtaskRequest request) {
        return ResponseEntity.ok(
                subtaskService.update(user, taskId, subtaskId, request.title(), request.completed()));
    }

    @Operation(summary = "Delete a subtask")
    @DeleteMapping("/{subtaskId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user,
                                       @PathVariable Long taskId,
                                       @PathVariable Long subtaskId) {
        subtaskService.delete(user, taskId, subtaskId);
        return ResponseEntity.noContent().build();
    }
}
