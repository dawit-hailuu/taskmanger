package com.taskmanager.project;

import com.taskmanager.project.dto.AddProjectMemberRequest;
import com.taskmanager.project.dto.CreateProjectRequest;
import com.taskmanager.project.dto.ProjectMemberResponse;
import com.taskmanager.project.dto.ProjectResponse;
import com.taskmanager.project.dto.UpdateProjectMemberRoleRequest;
import com.taskmanager.project.dto.UpdateProjectRequest;
import com.taskmanager.task.Task;
import com.taskmanager.task.TaskService;
import com.taskmanager.task.dto.PageResponse;
import com.taskmanager.task.dto.TaskResponse;
import com.taskmanager.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Tag(name = "Projects", description = "Projects live inside a workspace and contain tasks")
public class ProjectController {

    private final ProjectService projectService;
    private final TaskService taskService;

    public ProjectController(ProjectService projectService, TaskService taskService) {
        this.projectService = projectService;
        this.taskService = taskService;
    }

    @Operation(summary = "Create a project in a workspace")
    @PostMapping("/api/workspaces/{workspaceId}/projects")
    public ResponseEntity<ProjectResponse> create(@AuthenticationPrincipal User user,
                                                  @PathVariable Long workspaceId,
                                                  @Valid @RequestBody CreateProjectRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(projectService.create(user, workspaceId, request));
    }

    @Operation(summary = "List the projects in a workspace that are visible to the current user")
    @GetMapping("/api/workspaces/{workspaceId}/projects")
    public ResponseEntity<List<ProjectResponse>> listForWorkspace(@AuthenticationPrincipal User user,
                                                                  @PathVariable Long workspaceId) {
        return ResponseEntity.ok(projectService.listForWorkspace(user, workspaceId));
    }

    @Operation(summary = "Get a project")
    @GetMapping("/api/projects/{id}")
    public ResponseEntity<ProjectResponse> get(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return ResponseEntity.ok(projectService.getProject(user, id));
    }

    @Operation(summary = "Update a project's name/description/deadline")
    @PutMapping("/api/projects/{id}")
    public ResponseEntity<ProjectResponse> update(@AuthenticationPrincipal User user,
                                                  @PathVariable Long id,
                                                  @Valid @RequestBody UpdateProjectRequest request) {
        return ResponseEntity.ok(projectService.update(user, id, request));
    }

    @Operation(summary = "Delete a project")
    @DeleteMapping("/api/projects/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        projectService.delete(user, id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "List a project's members")
    @GetMapping("/api/projects/{id}/members")
    public ResponseEntity<List<ProjectMemberResponse>> listMembers(@AuthenticationPrincipal User user,
                                                                   @PathVariable Long id) {
        return ResponseEntity.ok(projectService.listMembers(user, id));
    }

    @Operation(summary = "Add an existing user to the project by email")
    @PostMapping("/api/projects/{id}/members")
    public ResponseEntity<ProjectMemberResponse> addMember(@AuthenticationPrincipal User user,
                                                           @PathVariable Long id,
                                                           @Valid @RequestBody AddProjectMemberRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(projectService.addMember(user, id, request));
    }

    @Operation(summary = "Remove a member from the project")
    @DeleteMapping("/api/projects/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(@AuthenticationPrincipal User user,
                                             @PathVariable Long id,
                                             @PathVariable Long userId) {
        projectService.removeMember(user, id, userId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Change a project member's role")
    @PatchMapping("/api/projects/{id}/members/{userId}/role")
    public ResponseEntity<ProjectMemberResponse> changeMemberRole(@AuthenticationPrincipal User user,
                                                                  @PathVariable Long id,
                                                                  @PathVariable Long userId,
                                                                  @Valid @RequestBody UpdateProjectMemberRoleRequest request) {
        return ResponseEntity.ok(projectService.changeMemberRole(user, id, userId, request.role()));
    }

    @Operation(summary = "List the tasks that belong to a project")
    @GetMapping("/api/projects/{id}/tasks")
    public ResponseEntity<PageResponse<TaskResponse>> listTasks(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {
        Page<Task> result = taskService.searchByProject(user, id, page, size, sortBy, direction);
        return ResponseEntity.ok(PageResponse.from(result, TaskResponse::from));
    }
}
