package com.taskmanager.auth.model;

import com.taskmanager.user.User;
import jakarta.persistence.*;

import java.time.Instant;

/**
 * An audit record of a login attempt (successful or not). Failed attempts for
 * unknown emails are still recorded (with a null user) so brute-force patterns
 * are visible.
 */
@Entity
@Table(
        name = "login_history",
        indexes = {
                @Index(name = "idx_login_user", columnList = "user_id"),
                @Index(name = "idx_login_created", columnList = "created_at")
        }
)
public class LoginHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Null when the attempt used an email that matches no account. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_login_user"))
    private User user;

    @Column(nullable = false, length = 150)
    private String email;

    @Column(nullable = false)
    private boolean success;

    @Column(name = "failure_reason", length = 100)
    private String failureReason;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public LoginHistory() {
    }

    public static LoginHistory success(User user, String ip, String userAgent) {
        LoginHistory h = new LoginHistory();
        h.user = user;
        h.email = user.getEmail();
        h.success = true;
        h.ipAddress = ip;
        h.userAgent = userAgent;
        h.createdAt = Instant.now();
        return h;
    }

    public static LoginHistory failure(User user, String email, String reason, String ip, String userAgent) {
        LoginHistory h = new LoginHistory();
        h.user = user;
        h.email = email;
        h.success = false;
        h.failureReason = reason;
        h.ipAddress = ip;
        h.userAgent = userAgent;
        h.createdAt = Instant.now();
        return h;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getEmail() { return email; }
    public boolean isSuccess() { return success; }
    public String getFailureReason() { return failureReason; }
    public String getIpAddress() { return ipAddress; }
    public String getUserAgent() { return userAgent; }
    public Instant getCreatedAt() { return createdAt; }
}
