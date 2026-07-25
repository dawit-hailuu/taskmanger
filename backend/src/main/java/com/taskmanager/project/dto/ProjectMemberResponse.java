package com.taskmanager.project.dto;

import com.taskmanager.project.ProjectMember;

import java.time.Instant;

public record ProjectMemberResponse(
        Long userId,
        String name,
        String email,
        String role,
        Instant joinedAt
) {
    public static ProjectMemberResponse from(ProjectMember member) {
        return new ProjectMemberResponse(
                member.getUser().getId(),
                member.getUser().getName(),
                member.getUser().getEmail(),
                member.getRole().name(),
                member.getJoinedAt()
        );
    }
}
