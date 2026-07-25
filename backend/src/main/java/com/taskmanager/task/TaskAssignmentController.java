package com.taskmanager.task;

import com.taskmanager.task.dto.AddAssigneeRequest;
import com.taskmanager.task.dto.TaskCollaboratorResponse;
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
@RequestMapping("/api/tasks/{taskId}")
@Tag(name = "Task Assignees & Watchers", description = "Who a task is assigned to, and who is watching it")
public class TaskAssignmentController {

    private final TaskAssignmentService assignmentService;

    public TaskAssignmentController(TaskAssignmentService assignmentService) {
        this.assignmentService = assignmentService;
    }

    @Operation(summary = "List a task's assignees")
    @GetMapping("/assignees")
    public ResponseEntity<List<TaskCollaboratorResponse>> listAssignees(@AuthenticationPrincipal User user,
                                                                        @PathVariable Long taskId) {
        return ResponseEntity.ok(assignmentService.listAssignees(user, taskId));
    }

    @Operation(summary = "Assign a project member to this task")
    @PostMapping("/assignees")
    public ResponseEntity<TaskCollaboratorResponse> addAssignee(@AuthenticationPrincipal User user,
                                                                @PathVariable Long taskId,
                                                                @Valid @RequestBody AddAssigneeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(assignmentService.addAssignee(user, taskId, request.userId()));
    }

    @Operation(summary = "Unassign a user from this task")
    @DeleteMapping("/assignees/{userId}")
    public ResponseEntity<Void> removeAssignee(@AuthenticationPrincipal User user,
                                               @PathVariable Long taskId,
                                               @PathVariable Long userId) {
        assignmentService.removeAssignee(user, taskId, userId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "List a task's watchers")
    @GetMapping("/watchers")
    public ResponseEntity<List<TaskCollaboratorResponse>> listWatchers(@AuthenticationPrincipal User user,
                                                                       @PathVariable Long taskId) {
        return ResponseEntity.ok(assignmentService.listWatchers(user, taskId));
    }

    @Operation(summary = "Start watching this task (notified of its activity)")
    @PostMapping("/watchers/me")
    public ResponseEntity<TaskCollaboratorResponse> watch(@AuthenticationPrincipal User user,
                                                          @PathVariable Long taskId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assignmentService.watch(user, taskId));
    }

    @Operation(summary = "Stop watching this task")
    @DeleteMapping("/watchers/me")
    public ResponseEntity<Void> unwatch(@AuthenticationPrincipal User user, @PathVariable Long taskId) {
        assignmentService.unwatch(user, taskId);
        return ResponseEntity.noContent().build();
    }
}
