package com.taskmanager.project.dto;

import com.taskmanager.project.Project;

import java.time.Instant;
import java.time.LocalDate;

public record ProjectResponse(
        Long id,
        Long workspaceId,
        String name,
        String description,
        LocalDate deadline,
        int progressPercentage,
        long memberCount,
        long taskCount,
        /** Null when the caller sees this project via workspace ADMIN/OWNER access rather than direct membership. */
        String myRole,
        Instant createdAt,
        Instant updatedAt
) {
    public static ProjectResponse from(Project project, int progressPercentage, long memberCount,
                                       long taskCount, String myRole) {
        return new ProjectResponse(
                project.getId(),
                project.getWorkspace().getId(),
                project.getName(),
                project.getDescription(),
                project.getDeadline(),
                progressPercentage,
                memberCount,
                taskCount,
                myRole,
                project.getCreatedAt(),
                project.getUpdatedAt()
        );
    }
}
