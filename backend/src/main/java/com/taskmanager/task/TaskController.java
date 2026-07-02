package com.taskmanager.task;

import com.taskmanager.task.dto.PageResponse;
import com.taskmanager.task.dto.TaskRequest;
import com.taskmanager.task.dto.TaskResponse;
import com.taskmanager.user.User;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    /**
     * List the current user's tasks with optional search, filtering, sorting
     * and pagination.
     *
     * Examples:
     *   GET /api/tasks?search=report&status=TODO&priority=HIGH
     *   GET /api/tasks?sortBy=dueDate&direction=asc&page=0&size=10
     */
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

    @GetMapping("/{id}")
    public ResponseEntity<TaskResponse> getById(@AuthenticationPrincipal User user,
                                                @PathVariable Long id) {
        return ResponseEntity.ok(TaskResponse.from(taskService.getOwnedTask(user, id)));
    }

    @PostMapping
    public ResponseEntity<TaskResponse> create(@AuthenticationPrincipal User user,
                                               @Valid @RequestBody TaskRequest request) {
        Task created = taskService.create(user, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(TaskResponse.from(created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TaskResponse> update(@AuthenticationPrincipal User user,
                                               @PathVariable Long id,
                                               @Valid @RequestBody TaskRequest request) {
        Task updated = taskService.update(user, id, request);
        return ResponseEntity.ok(TaskResponse.from(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user,
                                       @PathVariable Long id) {
        taskService.delete(user, id);
        return ResponseEntity.noContent().build();
    }
}
