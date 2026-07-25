package com.taskmanager.task;

import com.taskmanager.task.dto.CreateTaskDependencyRequest;
import com.taskmanager.task.dto.TaskDependencyResponse;
import com.taskmanager.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks/{taskId}/dependencies")
@Tag(name = "Task Dependencies", description = "\"Blocked by\" links between tasks")
public class TaskDependencyController {

    private final TaskDependencyService dependencyService;

    public TaskDependencyController(TaskDependencyService dependencyService) {
        this.dependencyService = dependencyService;
    }

    @Operation(summary = "List what this task is blocked by, and what it blocks")
    @GetMapping
    public ResponseEntity<Map<String, List<TaskDependencyResponse>>> list(@AuthenticationPrincipal User user,
                                                                          @PathVariable Long taskId) {
        return ResponseEntity.ok(dependencyService.list(user, taskId));
    }

    @Operation(summary = "Mark this task as blocked by another task")
    @PostMapping
    public ResponseEntity<TaskDependencyResponse> add(@AuthenticationPrincipal User user,
                                                       @PathVariable Long taskId,
                                                       @Valid @RequestBody CreateTaskDependencyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(dependencyService.add(user, taskId, request.dependsOnTaskId()));
    }

    @Operation(summary = "Remove a \"blocked by\" link")
    @DeleteMapping("/{dependsOnTaskId}")
    public ResponseEntity<Void> remove(@AuthenticationPrincipal User user,
                                       @PathVariable Long taskId,
                                       @PathVariable Long dependsOnTaskId) {
        dependencyService.remove(user, taskId, dependsOnTaskId);
        return ResponseEntity.noContent().build();
    }
}
