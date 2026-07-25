package com.taskmanager.workspace.dto;

import com.taskmanager.workspace.Workspace;
import com.taskmanager.workspace.WorkspaceRole;

import java.time.Instant;

public record WorkspaceResponse(
        Long id,
        String name,
        String description,
        String type,
        String myRole,
        long memberCount,
        Instant createdAt
) {
    public static WorkspaceResponse from(Workspace workspace, WorkspaceRole myRole, long memberCount) {
        return new WorkspaceResponse(
                workspace.getId(),
                workspace.getName(),
                workspace.getDescription(),
                workspace.getType().name(),
                myRole.name(),
                memberCount,
                workspace.getCreatedAt()
        );
    }
}
