package com.taskmanager.task;

import com.taskmanager.task.dto.PageResponse;
import com.taskmanager.task.dto.TaskHistoryResponse;
import com.taskmanager.task.dto.TaskRequest;
import com.taskmanager.task.dto.TaskResponse;
import com.taskmanager.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tasks")
@Tag(name = "Tasks", description = "Personal task list, plus shared task detail for project-linked tasks")
public class TaskController {

    private final TaskService taskService;
    private final TaskHistoryService taskHistoryService;

    public TaskController(TaskService taskService, TaskHistoryService taskHistoryService) {
        this.taskService = taskService;
        this.taskHistoryService = taskHistoryService;
    }

    /**
     * List the current user's tasks with optional search, filtering, sorting
     * and pagination.
     *
     * Examples:
     *   GET /api/tasks?search=report&status=TODO&priority=HIGH
     *   GET /api/tasks?sortBy=dueDate&direction=asc&page=0&size=10
     */
    @Operation(summary = "List the current user's own tasks (\"My Tasks\")")
    @GetMapping
    public ResponseEntity<PageResponse<TaskResponse>> list(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) Priority priority,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {

        Page<Task> result = taskService.search(user, search, status, priority,
                page, size, sortBy, direction);
        return ResponseEntity.ok(PageResponse.from(result, TaskResponse::from));
    }

    @Operation(summary = "Get a task (owner or any member of its project)")
    @GetMapping("/{id}")
    public ResponseEntity<TaskResponse> getById(@AuthenticationPrincipal User user,
                                                @PathVariable Long id) {
        return ResponseEntity.ok(TaskResponse.from(taskService.getAccessibleTask(user, id)));
    }

    @Operation(summary = "Create a task, optionally within a project")
    @PostMapping
    public ResponseEntity<TaskResponse> create(@AuthenticationPrincipal User user,
                                               @Valid @RequestBody TaskRequest request) {
        Task created = taskService.create(user, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(TaskResponse.from(created));
    }

    @Operation(summary = "Update a task (owner or any member of its project)")
    @PutMapping("/{id}")
    public ResponseEntity<TaskResponse> update(@AuthenticationPrincipal User user,
                                               @PathVariable Long id,
                                               @Valid @RequestBody TaskRequest request) {
        Task updated = taskService.update(user, id, request);
        return ResponseEntity.ok(TaskResponse.from(updated));
    }

    @Operation(summary = "Delete a task (owner, or a MANAGER/OWNER of its project)")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user,
                                       @PathVariable Long id) {
        taskService.delete(user, id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "List a task's audit history")
    @GetMapping("/{id}/history")
    public ResponseEntity<PageResponse<TaskHistoryResponse>> history(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Task task = taskService.getAccessibleTask(user, id);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        return ResponseEntity.ok(PageResponse.from(
                taskHistoryService.history(task, pageable), TaskHistoryResponse::from));
    }
}
