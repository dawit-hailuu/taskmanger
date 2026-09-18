package com.taskmanager.task;

import com.taskmanager.task.dto.DashboardResponse;
import com.taskmanager.task.dto.PageResponse;
import com.taskmanager.task.dto.TaskHistoryResponse;
import com.taskmanager.task.dto.TaskRequest;
import com.taskmanager.task.dto.TaskResponse;
import com.taskmanager.task.dto.TaskSearchCriteria;
import com.taskmanager.task.dto.TaskStatsResponse;
import com.taskmanager.task.dto.UpdateTaskStatusRequest;
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

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@Tag(name = "Tasks", description = "Personal task list, plus shared task detail for project-linked tasks")
public class TaskController {

    private final TaskService taskService;
    private final TaskHistoryService taskHistoryService;
    private final TaskDashboardService taskDashboardService;

    public TaskController(TaskService taskService,
                          TaskHistoryService taskHistoryService,
                          TaskDashboardService taskDashboardService) {
        this.taskService = taskService;
        this.taskHistoryService = taskHistoryService;
        this.taskDashboardService = taskDashboardService;
    }

    /**
     * List the current user's tasks with search, filtering, sorting and
     * pagination — all resolved by a single database query, so results stay
     * correct and cheap no matter how the three are combined.
     *
     * Examples:
     *   GET /api/tasks?search=report&status=TODO&priority=HIGH
     *   GET /api/tasks?sortBy=dueDate&direction=asc&page=0&size=10
     *   GET /api/tasks?rootsOnly=true&projectId=4
     *   GET /api/tasks?parentId=12
     */
    @Operation(summary = "List the current user's own tasks (\"My Tasks\")")
    @GetMapping
    public ResponseEntity<PageResponse<TaskResponse>> list(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long parentId,
            @RequestParam(required = false) LocalDate dueFrom,
            @RequestParam(required = false) LocalDate dueTo,
            @RequestParam(defaultValue = "false") boolean overdueOnly,
            /*
             * Defaults to false so the endpoint's original meaning — "all my
             * tasks" — is unchanged for existing clients. The tree-aware UI
             * passes true to show only top-level tasks.
             */
            @RequestParam(defaultValue = "false") boolean rootsOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {

        TaskSearchCriteria criteria = new TaskSearchCriteria(
                search, status, priority, projectId, parentId, rootsOnly, dueFrom, dueTo, overdueOnly);

        Page<Task> result = taskService.search(user, criteria, page, size, sortBy, direction);

        // One extra query for the whole page, rather than one per row.
        Map<Long, Integer> childCounts =
                taskService.childCounts(result.getContent().stream().map(Task::getId).toList());

        return ResponseEntity.ok(PageResponse.from(result,
                task -> TaskResponse.withCounts(task, childCounts)));
    }

    @Operation(summary = "Headline task statistics for the signed-in user")
    @GetMapping("/stats")
    public ResponseEntity<TaskStatsResponse> stats(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(taskDashboardService.stats(user));
    }

    @Operation(summary = "Everything the dashboard renders, in one request "
            + "(stats, due today, upcoming, overdue, recent, activity)")
    @GetMapping("/dashboard")
    public ResponseEntity<DashboardResponse> dashboard(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(taskDashboardService.dashboard(user));
    }

    @Operation(summary = "Field names accepted by the sortBy parameter")
    @GetMapping("/sortable-fields")
    public ResponseEntity<List<String>> sortableFields() {
        return ResponseEntity.ok(TaskService.sortableFields());
    }

    @Operation(summary = "Get a task (owner or any member of its project)")
    @GetMapping("/{id}")
    public ResponseEntity<TaskResponse> getById(@AuthenticationPrincipal User user,
                                                @PathVariable Long id) {
        Task task = taskService.getAccessibleTask(user, id);
        return ResponseEntity.ok(TaskResponse.from(task,
                taskService.childCounts(List.of(task.getId())).getOrDefault(task.getId(), 0)));
    }

    @Operation(summary = "Create a task, optionally within a project or nested under a parent task")
    @PostMapping
    public ResponseEntity<TaskResponse> create(@AuthenticationPrincipal User user,
                                               @Valid @RequestBody TaskRequest request) {
        Task created = taskService.create(user, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(TaskResponse.from(created, 0));
    }

    @Operation(summary = "Update a task (owner or any member of its project)")
    @PutMapping("/{id}")
    public ResponseEntity<TaskResponse> update(@AuthenticationPrincipal User user,
                                               @PathVariable Long id,
                                               @Valid @RequestBody TaskRequest request) {
        Task updated = taskService.update(user, id, request);
        return ResponseEntity.ok(TaskResponse.from(updated));
    }

    @Operation(summary = "Change only a task's status (used by the tree's completion checkbox)")
    @PatchMapping("/{id}/status")
    public ResponseEntity<TaskResponse> changeStatus(@AuthenticationPrincipal User user,
                                                    @PathVariable Long id,
                                                    @Valid @RequestBody UpdateTaskStatusRequest request) {
        return ResponseEntity.ok(TaskResponse.from(taskService.changeStatus(user, id, request.status())));
    }

    @Operation(summary = "Delete a task and its whole subtree (owner, or a MANAGER/OWNER of its project)")
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
