package com.taskmanager.profile;

import com.taskmanager.user.User;
import jakarta.persistence.*;

import java.time.Instant;

/** An immutable record in a user's activity history (audit trail of account events). */
@Entity
@Table(
        name = "user_activity",
        indexes = {
                @Index(name = "idx_user_activity_user", columnList = "user_id"),
                @Index(name = "idx_user_activity_created", columnList = "created_at")
        }
)
public class UserActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_activity_user"))
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private UserActivityType type;

    @Column(length = 255)
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public UserActivity() {
    }

    public UserActivity(User user, UserActivityType type, String description) {
        this.user = user;
        this.type = type;
        this.description = description;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public UserActivityType getType() { return type; }
    public String getDescription() { return description; }
    public Instant getCreatedAt() { return createdAt; }
}
