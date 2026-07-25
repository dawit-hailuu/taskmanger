package com.taskmanager.profile;

import com.taskmanager.user.User;
import jakarta.persistence.*;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

/**
 * Per-user, per-event notification channel preferences. Each event the
 * platform can raise (task assigned, deadline approaching, comment, mention,
 * status change, project invite) has an independent email and in-app toggle,
 * all defaulting to enabled.
 */
@Entity
@Table(
        name = "notification_preferences",
        uniqueConstraints = @UniqueConstraint(name = "uk_notification_prefs_user", columnNames = "user_id")
)
@EntityListeners(AuditingEntityListener.class)
public class NotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_notification_prefs_user"))
    private User user;

    @Column(name = "email_task_assigned", nullable = false)
    private boolean emailTaskAssigned = true;

    @Column(name = "email_deadline_approaching", nullable = false)
    private boolean emailDeadlineApproaching = true;

    @Column(name = "email_comment", nullable = false)
    private boolean emailComment = true;

    @Column(name = "email_mention", nullable = false)
    private boolean emailMention = true;

    @Column(name = "email_status_change", nullable = false)
    private boolean emailStatusChange = true;

    @Column(name = "email_project_invite", nullable = false)
    private boolean emailProjectInvite = true;

    @Column(name = "in_app_task_assigned", nullable = false)
    private boolean inAppTaskAssigned = true;

    @Column(name = "in_app_deadline_approaching", nullable = false)
    private boolean inAppDeadlineApproaching = true;

    @Column(name = "in_app_comment", nullable = false)
    private boolean inAppComment = true;

    @Column(name = "in_app_mention", nullable = false)
    private boolean inAppMention = true;

    @Column(name = "in_app_status_change", nullable = false)
    private boolean inAppStatusChange = true;

    @Column(name = "in_app_project_invite", nullable = false)
    private boolean inAppProjectInvite = true;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Long getId() { return id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public boolean isEmailTaskAssigned() { return emailTaskAssigned; }
    public void setEmailTaskAssigned(boolean v) { this.emailTaskAssigned = v; }

    public boolean isEmailDeadlineApproaching() { return emailDeadlineApproaching; }
    public void setEmailDeadlineApproaching(boolean v) { this.emailDeadlineApproaching = v; }

    public boolean isEmailComment() { return emailComment; }
    public void setEmailComment(boolean v) { this.emailComment = v; }

    public boolean isEmailMention() { return emailMention; }
    public void setEmailMention(boolean v) { this.emailMention = v; }

    public boolean isEmailStatusChange() { return emailStatusChange; }
    public void setEmailStatusChange(boolean v) { this.emailStatusChange = v; }

    public boolean isEmailProjectInvite() { return emailProjectInvite; }
    public void setEmailProjectInvite(boolean v) { this.emailProjectInvite = v; }

    public boolean isInAppTaskAssigned() { return inAppTaskAssigned; }
    public void setInAppTaskAssigned(boolean v) { this.inAppTaskAssigned = v; }

    public boolean isInAppDeadlineApproaching() { return inAppDeadlineApproaching; }
    public void setInAppDeadlineApproaching(boolean v) { this.inAppDeadlineApproaching = v; }

    public boolean isInAppComment() { return inAppComment; }
    public void setInAppComment(boolean v) { this.inAppComment = v; }

    public boolean isInAppMention() { return inAppMention; }
    public void setInAppMention(boolean v) { this.inAppMention = v; }

    public boolean isInAppStatusChange() { return inAppStatusChange; }
    public void setInAppStatusChange(boolean v) { this.inAppStatusChange = v; }

    public boolean isInAppProjectInvite() { return inAppProjectInvite; }
    public void setInAppProjectInvite(boolean v) { this.inAppProjectInvite = v; }

    public Instant getUpdatedAt() { return updatedAt; }
}
