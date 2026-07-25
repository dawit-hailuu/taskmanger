package com.taskmanager.project.dto;

import com.taskmanager.project.ProjectRole;
import jakarta.validation.constraints.NotNull;

public record UpdateProjectMemberRoleRequest(
        @NotNull(message = "Role is required")
        ProjectRole role
) {
}
