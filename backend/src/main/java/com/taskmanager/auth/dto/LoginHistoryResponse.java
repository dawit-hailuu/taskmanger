package com.taskmanager.auth.dto;

import com.taskmanager.auth.model.LoginHistory;

import java.time.Instant;

public record LoginHistoryResponse(
        Long id,
        boolean success,
        String failureReason,
        String ipAddress,
        String userAgent,
        Instant createdAt
) {
    public static LoginHistoryResponse from(LoginHistory h) {
        return new LoginHistoryResponse(
                h.getId(),
                h.isSuccess(),
                h.getFailureReason(),
                h.getIpAddress(),
                h.getUserAgent(),
                h.getCreatedAt()
        );
    }
}
