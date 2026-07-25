package com.taskmanager.task;

import com.taskmanager.tag.dto.TagResponse;
import com.taskmanager.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks/{taskId}/tags")
@Tag(name = "Task Tags", description = "Attach or remove workspace tags on a task")
public class TaskTagController {

    private final TaskTagService taskTagService;

    public TaskTagController(TaskTagService taskTagService) {
        this.taskTagService = taskTagService;
    }

    @Operation(summary = "List a task's tags")
    @GetMapping
    public ResponseEntity<List<TagResponse>> list(@AuthenticationPrincipal User user, @PathVariable Long taskId) {
        return ResponseEntity.ok(taskTagService.listForTask(user, taskId));
    }

    @Operation(summary = "Attach a tag to this task")
    @PostMapping("/{tagId}")
    public ResponseEntity<TagResponse> attach(@AuthenticationPrincipal User user,
                                              @PathVariable Long taskId,
                                              @PathVariable Long tagId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(taskTagService.attach(user, taskId, tagId));
    }

    @Operation(summary = "Remove a tag from this task")
    @DeleteMapping("/{tagId}")
    public ResponseEntity<Void> detach(@AuthenticationPrincipal User user,
                                       @PathVariable Long taskId,
                                       @PathVariable Long tagId) {
        taskTagService.detach(user, taskId, tagId);
        return ResponseEntity.noContent().build();
    }
}
