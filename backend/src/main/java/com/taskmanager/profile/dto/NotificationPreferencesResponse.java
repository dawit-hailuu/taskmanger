package com.taskmanager.profile.dto;

import com.taskmanager.profile.NotificationPreference;

public record NotificationPreferencesResponse(
        boolean emailTaskAssigned,
        boolean emailDeadlineApproaching,
        boolean emailComment,
        boolean emailMention,
        boolean emailStatusChange,
        boolean emailProjectInvite,
        boolean inAppTaskAssigned,
        boolean inAppDeadlineApproaching,
        boolean inAppComment,
        boolean inAppMention,
        boolean inAppStatusChange,
        boolean inAppProjectInvite
) {
    public static NotificationPreferencesResponse from(NotificationPreference p) {
        return new NotificationPreferencesResponse(
                p.isEmailTaskAssigned(),
                p.isEmailDeadlineApproaching(),
                p.isEmailComment(),
                p.isEmailMention(),
                p.isEmailStatusChange(),
                p.isEmailProjectInvite(),
                p.isInAppTaskAssigned(),
                p.isInAppDeadlineApproaching(),
                p.isInAppComment(),
                p.isInAppMention(),
                p.isInAppStatusChange(),
                p.isInAppProjectInvite()
        );
    }
}
