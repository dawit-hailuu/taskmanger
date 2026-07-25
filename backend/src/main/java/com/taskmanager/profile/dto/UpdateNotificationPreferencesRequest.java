package com.taskmanager.profile.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateNotificationPreferencesRequest(
        @NotNull Boolean emailTaskAssigned,
        @NotNull Boolean emailDeadlineApproaching,
        @NotNull Boolean emailComment,
        @NotNull Boolean emailMention,
        @NotNull Boolean emailStatusChange,
        @NotNull Boolean emailProjectInvite,
        @NotNull Boolean inAppTaskAssigned,
        @NotNull Boolean inAppDeadlineApproaching,
        @NotNull Boolean inAppComment,
        @NotNull Boolean inAppMention,
        @NotNull Boolean inAppStatusChange,
        @NotNull Boolean inAppProjectInvite
) {
}
