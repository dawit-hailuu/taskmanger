package com.taskmanager.task;

import com.taskmanager.task.dto.CreateChildTaskRequest;
import com.taskmanager.task.dto.MoveTaskRequest;
import com.taskmanager.task.dto.PageResponse;
import com.taskmanager.task.dto.TaskNodeResponse;
import com.taskmanager.task.dto.TaskResponse;
import com.taskmanager.task.dto.TaskSearchCriteria;
import com.taskmanager.task.dto.UpdateTaskWeightRequest;
import com.taskmanager.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Hierarchy endpoints for tasks: nested reads, adding children at any depth,
 * drag &amp; drop moves, and weight changes.
 *
 * <p>Thin by design — request mapping and status codes only. Every rule
 * (permissions, circular-reference prevention, the weight budget, the weighted
 * progress rollup) lives in the service layer.
 */
@RestController
@RequestMapping("/api/tasks")
@Tag(name = "Task tree", description = "Infinitely nested subtasks, weights, and weighted progress")
public class TaskTreeController {

    private final TaskService taskService;
    private final TaskTreeService taskTreeService;

    public TaskTreeController(TaskService taskService, TaskTreeService taskTreeService) {
        this.taskService = taskService;
        this.taskTreeService = taskTreeService;
    }

    /**
     * Paged top-level tasks, each with its full subtree nested inside.
     *
     * <p>Pagination applies to the <em>roots</em>: page size 20 means 20 trees,
     * not 20 rows spread across levels. Search, filters and sorting are applied by
     * the same query that pages, and every descendant of the page arrives in a
     * single follow-up query.
     */
    @Operation(summary = "Paged root tasks with their full subtrees nested")
    @GetMapping("/tree")
    public ResponseEntity<PageResponse<TaskNodeResponse>> tree(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) LocalDate dueFrom,
            @RequestParam(required = false) LocalDate dueTo,
            @RequestParam(defaultValue = "false") boolean overdueOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "position") String sortBy,
            @RequestParam(defaultValue = "asc") String direction) {

        TaskSearchCriteria criteria = new TaskSearchCriteria(
                search, status, priority, projectId, null, true, dueFrom, dueTo, overdueOnly);

        Page<Task> roots = taskService.search(user, criteria, page, size, sortBy, direction);
        List<Long> rootIds = roots.getContent().stream().map(Task::getId).toList();
        List<TaskNodeResponse> trees = taskTreeService.forest(rootIds);

        return ResponseEntity.ok(new PageResponse<>(
                trees,
                roots.getNumber(),
                roots.getSize(),
                roots.getTotalElements(),
                roots.getTotalPages(),
                roots.isFirst(),
                roots.isLast()));
    }

    @Operation(summary = "One task with every descendant nested, at any depth")
    @GetMapping("/{id}/tree")
    public ResponseEntity<TaskNodeResponse> subtree(@AuthenticationPrincipal User user,
                                                    @PathVariable Long id) {
        return ResponseEntity.ok(taskTreeService.tree(user, id));
    }

    @Operation(summary = "Direct children of a task (for lazy expansion of big trees)")
    @GetMapping("/{id}/children")
    public ResponseEntity<List<TaskResponse>> children(@AuthenticationPrincipal User user,
                                                       @PathVariable Long id) {
        List<Task> children = taskTreeService.children(user, id);
        var counts = taskService.childCounts(children.stream().map(Task::getId).toList());
        return ResponseEntity.ok(children.stream()
                .map(child -> TaskResponse.withCounts(child, counts))
                .toList());
    }

    @Operation(summary = "Add a subtask under a task — works at any nesting level")
    @PostMapping("/{id}/children")
    public ResponseEntity<TaskResponse> addChild(@AuthenticationPrincipal User user,
                                                 @PathVariable Long id,
                                                 @Valid @RequestBody CreateChildTaskRequest request) {
        Task created = taskTreeService.addChild(user, id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(TaskResponse.from(created, 0));
    }

    @Operation(summary = "Re-parent and/or reorder a task (drag & drop). "
            + "Rejects any move that would create a circular reference.")
    @PatchMapping("/{id}/move")
    public ResponseEntity<TaskResponse> move(@AuthenticationPrincipal User user,
                                             @PathVariable Long id,
                                             @Valid @RequestBody MoveTaskRequest request) {
        return ResponseEntity.ok(TaskResponse.from(taskTreeService.move(user, id, request)));
    }

    @Operation(summary = "Change a task's weight. Rejected if the siblings would then "
            + "exceed the parent's total weight.")
    @PatchMapping("/{id}/weight")
    public ResponseEntity<TaskResponse> reweight(@AuthenticationPrincipal User user,
                                                 @PathVariable Long id,
                                                 @Valid @RequestBody UpdateTaskWeightRequest request) {
        return ResponseEntity.ok(TaskResponse.from(taskTreeService.reweight(user, id, request.weight())));
    }
}
