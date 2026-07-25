package com.taskmanager.workspace.dto;

import com.taskmanager.workspace.WorkspaceRole;
import jakarta.validation.constraints.NotNull;

public record UpdateMemberRoleRequest(
        @NotNull(message = "Role is required")
        WorkspaceRole role
) {
}
