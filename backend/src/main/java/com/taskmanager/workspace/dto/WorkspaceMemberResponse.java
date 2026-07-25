package com.taskmanager.workspace.dto;

import com.taskmanager.workspace.WorkspaceMember;

import java.time.Instant;

public record WorkspaceMemberResponse(
        Long userId,
        String name,
        String email,
        String role,
        Instant joinedAt
) {
    public static WorkspaceMemberResponse from(WorkspaceMember member) {
        return new WorkspaceMemberResponse(
                member.getUser().getId(),
                member.getUser().getName(),
                member.getUser().getEmail(),
                member.getRole().name(),
                member.getJoinedAt()
        );
    }
}
