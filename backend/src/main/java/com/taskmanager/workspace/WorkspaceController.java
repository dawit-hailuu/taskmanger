package com.taskmanager.workspace;

import com.taskmanager.user.User;
import com.taskmanager.workspace.dto.AddWorkspaceMemberRequest;
import com.taskmanager.workspace.dto.CreateWorkspaceRequest;
import com.taskmanager.workspace.dto.UpdateMemberRoleRequest;
import com.taskmanager.workspace.dto.UpdateWorkspaceRequest;
import com.taskmanager.workspace.dto.WorkspaceMemberResponse;
import com.taskmanager.workspace.dto.WorkspaceResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/workspaces")
@Tag(name = "Workspaces", description = "Personal and team workspaces that contain projects")
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    public WorkspaceController(WorkspaceService workspaceService) {
        this.workspaceService = workspaceService;
    }

    @Operation(summary = "Create a team workspace")
    @PostMapping
    public ResponseEntity<WorkspaceResponse> create(@AuthenticationPrincipal User user,
                                                    @Valid @RequestBody CreateWorkspaceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workspaceService.create(user, request));
    }

    @Operation(summary = "List the workspaces the current user belongs to")
    @GetMapping
    public ResponseEntity<List<WorkspaceResponse>> list(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(workspaceService.listForUser(user));
    }

    @Operation(summary = "Get a workspace")
    @GetMapping("/{id}")
    public ResponseEntity<WorkspaceResponse> get(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return ResponseEntity.ok(workspaceService.getWorkspace(user, id));
    }

    @Operation(summary = "Update a workspace's name/description (ADMIN or OWNER)")
    @PutMapping("/{id}")
    public ResponseEntity<WorkspaceResponse> update(@AuthenticationPrincipal User user,
                                                    @PathVariable Long id,
                                                    @Valid @RequestBody UpdateWorkspaceRequest request) {
        return ResponseEntity.ok(workspaceService.update(user, id, request));
    }

    @Operation(summary = "Delete a team workspace (OWNER only)")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        workspaceService.delete(user, id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "List a workspace's members")
    @GetMapping("/{id}/members")
    public ResponseEntity<List<WorkspaceMemberResponse>> listMembers(@AuthenticationPrincipal User user,
                                                                     @PathVariable Long id) {
        return ResponseEntity.ok(workspaceService.listMembers(user, id));
    }

    @Operation(summary = "Add an existing user to the workspace by email (ADMIN or OWNER)")
    @PostMapping("/{id}/members")
    public ResponseEntity<WorkspaceMemberResponse> addMember(@AuthenticationPrincipal User user,
                                                             @PathVariable Long id,
                                                             @Valid @RequestBody AddWorkspaceMemberRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workspaceService.addMember(user, id, request));
    }

    @Operation(summary = "Remove a member from the workspace (ADMIN or OWNER)")
    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(@AuthenticationPrincipal User user,
                                             @PathVariable Long id,
                                             @PathVariable Long userId) {
        workspaceService.removeMember(user, id, userId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Change a member's role (OWNER only)")
    @PatchMapping("/{id}/members/{userId}/role")
    public ResponseEntity<WorkspaceMemberResponse> changeMemberRole(@AuthenticationPrincipal User user,
                                                                    @PathVariable Long id,
                                                                    @PathVariable Long userId,
                                                                    @Valid @RequestBody UpdateMemberRoleRequest request) {
        return ResponseEntity.ok(workspaceService.changeMemberRole(user, id, userId, request.role()));
    }
}
